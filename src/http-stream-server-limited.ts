import express from "express";
import cors from 'cors';
import { randomUUID } from "node:crypto";
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { SSEServerTransport } from '@modelcontextprotocol/sdk/server/sse.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  InitializeRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { ZabbixClient } from './zabbix-client.js';

const PORT = process.env.PORT || 3001;

export class MCPStreamServer {
  private app: express.Application;
  private sessions: Map<string, { server: Server, transport: SSEServerTransport, lastActivity: number }> = new Map();
  private zabbixClient: ZabbixClient;
  private port: number;
  private expressServer?: any;
  private sessionCleanupInterval?: NodeJS.Timeout;

  constructor(port: number = 3001) {
    this.port = port;
    this.app = express();
    
    // Setup CORS and middleware
    this.app.use(cors());
    this.app.use(express.json());
    
    // Initialize Zabbix client
    const zabbixUrl = process.env.ZABBIX_URL || 'http://localhost/zabbix';
    const baseUrl = zabbixUrl.replace('/api_jsonrpc.php', '');
    const zabbixConfig = {
      url: baseUrl,
      user: process.env.ZABBIX_USER || 'Admin',
      password: process.env.ZABBIX_PASSWORD || 'zabbix',
    };
    
    this.zabbixClient = new ZabbixClient(zabbixConfig);
    this.setupRoutes();
    this.startSessionCleanup();
  }

  private setupZabbixTools(server: Server) {
    // Setup list_tools handler
    server.setRequestHandler(ListToolsRequestSchema, async () => {
      return {
        tools: [
          {
            name: "zabbix_get_hosts",
            description: "Get hosts from Zabbix",
            inputSchema: {
              type: "object",
              properties: {
                groupids: {
                  type: "array",
                  items: { type: "string" },
                  description: "Filter by host group IDs"
                },
                limit: {
                  type: "number",
                  description: "Limit number of results"
                }
              }
            }
          },
          {
            name: "zabbix_get_items",
            description: "Get items from Zabbix",
            inputSchema: {
              type: "object",
              properties: {
                hostids: {
                  type: "array",
                  items: { type: "string" },
                  description: "Filter by host IDs"
                },
                search: {
                  type: "object",
                  description: "Search criteria"
                }
              }
            }
          }
        ]
      };
    });

    // Setup call_tool handler
    server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;
      
      try {
         if (!this.zabbixClient.isAuthenticated()) {
           await this.zabbixClient.login();
         }
         
         switch (name) {
           case "zabbix_get_hosts":
             const hosts = await this.zabbixClient.hostGet(args);
             return {
               content: [{
                 type: "text",
                 text: JSON.stringify(hosts, null, 2)
               }]
             };
             
           case "zabbix_get_items":
             const items = await this.zabbixClient.itemGet(args);
             return {
               content: [{
                 type: "text", 
                 text: JSON.stringify(items, null, 2)
               }]
             };
             
           default:
             throw new Error(`Unknown tool: ${name}`);
         }
       } catch (error: any) {
         throw new Error(`Zabbix API error: ${error.message}`);
       }
    });
  }

  private setupRoutes() {
    // SSE endpoint for establishing connections
    this.app.get('/sse', async (req, res) => {
      const sessionId = randomUUID();

      try {
        console.log(`Creating new SSE session: ${sessionId}`);
        
        // Set SSE headers
        res.setHeader('Content-Type', 'text/event-stream');
        res.setHeader('Cache-Control', 'no-cache');
        res.setHeader('Connection', 'keep-alive');
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Access-Control-Allow-Headers', 'Cache-Control');

        // Create new MCP server instance for this session
        const server = new Server({
          name: "zabbix-mcp-server",
          version: "1.0.0",
        }, {
          capabilities: {
            logging: {},
            tools: {
              listChanged: false
            }
          }
        });

        // Setup Zabbix tools
        this.setupZabbixTools(server);

        // Create SSE transport with message endpoint and response object
        const transport = new SSEServerTransport('/message', res);
        
        // Store session
        this.sessions.set(sessionId, {
          server,
          transport,
          lastActivity: Date.now()
        });
        
        // Connect server to transport (this will start the SSE connection)
        await server.connect(transport);

        // Send session ID to client
        res.write(`data: ${JSON.stringify({ type: 'session', sessionId })}\n\n`);

        // Handle client disconnect
        req.on('close', () => {
          console.log(`SSE connection closed for session: ${sessionId}`);
          this.cleanupSession(sessionId);
        });
        
        req.on('error', (error) => {
          console.error(`SSE connection error for session ${sessionId}:`, error);
          this.cleanupSession(sessionId);
        });
        
      } catch (error) {
        console.error('Error creating SSE session:', error);
        if (!res.headersSent) {
          res.status(500).json({ error: 'Failed to create SSE session' });
        }
      }
    });

    // POST endpoint for MCP messages
    this.app.post('/message', async (req, res) => {
      const sessionId = req.query.sessionId as string || req.headers['x-session-id'] as string;
      
      if (!sessionId) {
        return res.status(400).json({ error: 'Session ID required in query parameter or X-Session-ID header' });
      }

      const session = this.sessions.get(sessionId);
      if (!session) {
        return res.status(404).json({ error: `Session ${sessionId} not found` });
      }

      // Update last activity
      session.lastActivity = Date.now();

      try {
        // Handle the POST message through the transport
        await session.transport.handlePostMessage(req, res);
      } catch (error: any) {
        console.error(`Error handling message for session ${sessionId}:`, error);
        if (!res.headersSent) {
          res.status(500).json({ error: error.message });
        }
      }
    });

    // DELETE endpoint for session termination
    this.app.delete('/session/:id', (req, res) => {
      const sessionId = req.params.id;
      
      if (this.sessions.has(sessionId)) {
        this.cleanupSession(sessionId);
        res.json({ message: `Session ${sessionId} terminated successfully` });
      } else {
        res.status(404).json({ error: `Session ${sessionId} not found` });
      }
    });

    // Health check endpoint
    this.app.get('/health', (req, res) => {
      const uptime = process.uptime();
      const uptimeFormatted = new Date(uptime * 1000).toISOString().substr(11, 8);
      
      res.json({ 
        status: 'ok', 
        timestamp: new Date().toISOString(),
        activeSessions: this.sessions.size,
        zabbixConnected: this.zabbixClient.isAuthenticated(),
        uptime: uptimeFormatted,
        version: '1.0.4'
      });
    });
  }

  private cleanupSession(sessionId: string): void {
    const session = this.sessions.get(sessionId);
    if (session) {
      try {
        console.log(`Cleaning up session: ${sessionId}`);
        session.server.close();
      } catch (error) {
        console.error(`Error closing session ${sessionId}:`, error);
      } finally {
        this.sessions.delete(sessionId);
      }
    }
  }

  private startSessionCleanup(): void {
    // Clean up inactive sessions every 5 minutes
    this.sessionCleanupInterval = setInterval(() => {
      const now = Date.now();
      const sessionTimeout = 30 * 60 * 1000; // 30 minutes
      
      for (const [sessionId, session] of this.sessions) {
        if (now - session.lastActivity > sessionTimeout) {
          console.log(`Session ${sessionId} timed out, cleaning up`);
          this.cleanupSession(sessionId);
        }
      }
    }, 5 * 60 * 1000);
  }

  public start(): Promise<void> {
    return new Promise((resolve) => {
      this.expressServer = this.app.listen(this.port, () => {
        console.log(`Zabbix MCP HTTP Stream Server listening on port ${this.port}`);
        console.log(`Endpoints:`);
        console.log(`  GET /sse - SSE connection for MCP sessions`);
        console.log(`  POST /message?sessionId=<id> - MCP message handling`);
        console.log(`  DELETE /session/:id - Session termination`);
        console.log(`  GET /health - Health check and server status`);
        resolve();
      });

      // Handle server shutdown
      process.on('SIGINT', async () => {
        console.log('Shutting down server...');

        // Clear session cleanup interval
        if (this.sessionCleanupInterval) {
          clearInterval(this.sessionCleanupInterval);
        }

        // Close all active sessions to properly clean up resources
        for (const [sessionId] of this.sessions) {
          this.cleanupSession(sessionId);
        }
        
        if (this.expressServer) {
          this.expressServer.close(() => {
            console.log('Server shutdown complete');
            process.exit(0);
          });
        } else {
          console.log('Server shutdown complete');
          process.exit(0);
        }
      });
    });
  }
}

// Start server if this file is run directly
if (import.meta.url === `file://${process.argv[1]}`) {
  const server = new MCPStreamServer();
  server.start().catch(console.error);
}