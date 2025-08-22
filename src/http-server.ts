import express from 'express';
import cors from 'cors';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { SSEServerTransport } from '@modelcontextprotocol/sdk/server/sse.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { ZabbixClient } from './zabbix-client.js';

export class MCPSSEServer {
  private app: express.Application;
  private servers: Server[] = [];
  private sessions: Map<string, { server: Server, transport: SSEServerTransport, lastActivity: number }> = new Map();
  private zabbixClient: ZabbixClient;
  private port: number;

  constructor(port: number = 3000) {
    this.port = port;
    this.app = express();
    
    const zabbixUrl = process.env.ZABBIX_URL || 'http://localhost/zabbix';
    const baseUrl = zabbixUrl.replace('/api_jsonrpc.php', '');
    const zabbixConfig = {
      url: baseUrl,
      user: process.env.ZABBIX_USER || 'Admin',
      password: process.env.ZABBIX_PASSWORD || 'zabbix',
    };
    
    this.zabbixClient = new ZabbixClient(zabbixConfig);

    this.setupMiddleware();
    this.setupRoutes();
  }

  private setupMiddleware(): void {
    // Configurar CORS para permitir conexiones desde clientes MCP
    this.app.use(cors({
      origin: process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:3001'],
      credentials: true,
      methods: ['GET', 'POST', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization', 'Cache-Control']
    }));

    this.app.use(express.json({ limit: '10mb' }));
    this.app.use(express.text());
  }

  private setupRoutes(): void {
    // Endpoint de salud
    this.app.get('/health', (req, res) => {
      res.json({ status: 'ok', timestamp: new Date().toISOString() });
    });

    // Endpoint SSE para MCP
    this.app.get('/sse', async (req, res) => {
      try {
        console.log('Nueva conexión SSE establecida');
        const transport = new SSEServerTransport('/message', res);
        const server = new Server(
          {
            name: 'zabbix-mcp-server-sse',
            version: '1.0.0',
          },
          {
            capabilities: {
              tools: {},
            },
          }
        );

        this.servers.push(server);
        
        // Registrar la sesión
        const sessionId = transport.sessionId;
        this.sessions.set(sessionId, {
          server,
          transport,
          lastActivity: Date.now()
        });
        console.log(`📝 Sesión registrada: ${sessionId}`);
        
        server.onclose = () => {
          console.log(`Conexión SSE cerrada para sesión: ${sessionId}`);
          this.servers = this.servers.filter(s => s !== server);
          // No eliminar la sesión inmediatamente, mantenerla por un tiempo
          setTimeout(() => {
            if (this.sessions.has(sessionId)) {
              const session = this.sessions.get(sessionId)!;
              if (Date.now() - session.lastActivity > 300000) { // 5 minutos
                this.sessions.delete(sessionId);
                console.log(`🗑️ Sesión expirada eliminada: ${sessionId}`);
              }
            }
          }, 60000); // Verificar después de 1 minuto
        };

        await this.setupMCPHandlers(server);
        await server.connect(transport);
      } catch (error) {
        console.error('Error setting up SSE:', error);
        if (!res.headersSent) {
          res.status(500).json({ error: 'Failed to establish SSE connection' });
        }
      }
    });

    // Endpoint POST para recibir mensajes del cliente MCP
    this.app.post('/message', async (req, res) => {
      try {
        console.log('Mensaje recibido');
        const sessionId = req.query.sessionId as string;
        
        if (!sessionId) {
          console.log('❌ Missing sessionId parameter');
          res.status(400).send('Missing sessionId parameter');
          return;
        }
        
        console.log(`🔍 Buscando sesión: ${sessionId}`);
        console.log(`📋 Sesiones disponibles: ${Array.from(this.sessions.keys())}`);

        const sessionData = this.sessions.get(sessionId);
        if (!sessionData) {
          console.log(`❌ Sesión no encontrada: ${sessionId}`);
          res.status(404).json({ error: 'Session not found' });
          return;
        }

        // Actualizar última actividad
         sessionData.lastActivity = Date.now();
         const transport = sessionData.transport as any;
         
         console.log(`✅ Sesión encontrada: ${sessionId}`);
        
        // El transport debe manejar el POST message directamente
        await transport.handlePostMessage(req, res);
      } catch (error) {
        console.error('Error handling POST message:', error);
        if (!res.headersSent) {
          res.status(500).json({ error: 'Failed to process message' });
        }
      }
    });
  }

  private async setupMCPHandlers(server: Server): Promise<void> {
    try {
      console.log('Setting up MCP handlers, server:', !!server);
      
      if (!server) {
        throw new Error('Server parameter is undefined');
      }
      
      // Conectar a Zabbix
      const connectivity = await this.zabbixClient.verifyConnectivity(true);
      if (!connectivity.authenticated) {
        throw new Error(`Authentication failed: ${connectivity.error}`);
      }
      console.log('Conectado a Zabbix API exitosamente');

      // Registrar manejador de lista de herramientas
      server.setRequestHandler(ListToolsRequestSchema, async () => {
        return {
          tools: [
            {
              name: 'host_get',
              description: 'Get Zabbix hosts with optional filters',
              inputSchema: {
                type: 'object',
                properties: {
                  output: { type: 'string', description: 'Output format (extend, count, etc.)' },
                  hostids: { type: 'array', items: { type: 'string' }, description: 'Host IDs to filter' },
                  groupids: { type: 'array', items: { type: 'string' }, description: 'Group IDs to filter' },
                  search: { type: 'object', description: 'Search criteria' },
                  filter: { type: 'object', description: 'Filter criteria' },
                },
              },
            },
            {
              name: 'item_get',
              description: 'Get Zabbix items',
              inputSchema: {
                type: 'object',
                properties: {
                  output: { type: 'string', description: 'Output format' },
                  itemids: { type: 'array', items: { type: 'string' }, description: 'Item IDs' },
                  hostids: { type: 'array', items: { type: 'string' }, description: 'Host IDs' },
                  search: { type: 'object', description: 'Search criteria' },
                },
              },
            },
            {
              name: 'dashboard_get',
              description: 'Get Zabbix dashboards',
              inputSchema: {
                type: 'object',
                properties: {
                  output: { type: 'string', description: 'Output format' },
                  dashboardids: { type: 'array', items: { type: 'string' }, description: 'Dashboard IDs' },
                },
              },
            }
          ]
        };
      });

      // Registrar manejador de llamadas a herramientas
      server.setRequestHandler(CallToolRequestSchema, async (request) => {
        const { name, arguments: args } = request.params;
        
        try {
          let result: any;
          
          switch (name) {
            case 'host_get':
              result = await this.zabbixClient.hostGet(args || {});
              break;
            case 'item_get':
              result = await this.zabbixClient.itemGet(args || {});
              break;
            case 'dashboard_get':
              result = await this.zabbixClient.dashboardGet(args || {});
              break;
            default:
              throw new Error(`Herramienta no encontrada: ${name}`);
          }

          return {
            content: [
              {
                type: 'text',
                text: typeof result === 'string' ? result : JSON.stringify(result, null, 2)
              }
            ]
          };
        } catch (error) {
          throw new Error(`Error ejecutando herramienta ${name}: ${error instanceof Error ? error.message : String(error)}`);
        }
      });

    } catch (error) {
      console.error('Error configurando manejadores MCP:', error);
      throw error;
    }
  }

  public async start(): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        this.app.listen(this.port, () => {
          console.log(`Servidor MCP SSE ejecutándose en puerto ${this.port}`);
          console.log(`Endpoint SSE: http://localhost:${this.port}/sse`);
          console.log(`Endpoint POST: http://localhost:${this.port}/message`);
          console.log(`Health check: http://localhost:${this.port}/health`);
          resolve();
        });
      } catch (error) {
        reject(error);
      }
    });
  }

  public async stop(): Promise<void> {
    // Implementar cierre graceful si es necesario
    console.log('Cerrando servidor MCP SSE...');
  }
}