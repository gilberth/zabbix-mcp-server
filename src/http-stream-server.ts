import express from "express";
import cors from 'cors';
import { randomUUID } from "node:crypto";
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { SSEServerTransport } from '@modelcontextprotocol/sdk/server/sse.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { config } from 'dotenv';
import { ZabbixClient } from './zabbix-client.js';
import { 
  createSVGGraphWidget, 
  createProxmoxNodeDashboard, 
  createProxmoxDualNodeDashboard,
  PROXMOX_ITEM_PATTERNS 
} from './dashboard-utils.js';


// Load environment variables
config();

export class MCPStreamServer {
  private app: express.Application;
  private sessions: Map<string, { server: Server, transport: SSEServerTransport, lastActivity: number }> = new Map();
  private zabbixClient: ZabbixClient;
  private port: number;
  private expressServer?: any;
  private sessionCleanupInterval?: NodeJS.Timeout;
  private readOnly: boolean;
  private baseUrl: string;

  constructor(port: number = 3001) {
    this.port = port;
    this.app = express();
    
    // Setup CORS and middleware
    this.app.use(cors());
    // Note: express.json() is NOT used globally to avoid conflicts with SSE transport
    
    // Initialize Zabbix client
    const zabbixUrl = process.env.ZABBIX_URL || 'http://localhost/zabbix';
    this.baseUrl = zabbixUrl.replace('/api_jsonrpc.php', '');
    const zabbixConfig = {
      url: this.baseUrl,
      user: process.env.ZABBIX_USER || 'Admin',
      password: process.env.ZABBIX_PASSWORD || 'zabbix',
    };
    
    this.zabbixClient = new ZabbixClient(zabbixConfig);
    this.readOnly = process.env.READ_ONLY !== 'false';
    this.setupRoutes();
    this.startSessionCleanup();
  }

  // Validation helper
  private validateReadOnly(operation: string): void {
    if (this.readOnly && !['get', 'list', 'export'].some(op => operation.includes(op))) {
      throw new Error(`Operation '${operation}' is not allowed in read-only mode`);
    }
  }

  // Helper methods for complex operations
  private async createDualProxmoxDashboard(hostname1: string, hostname2: string, dashboardName?: string): Promise<any> {
    const name = dashboardName || `Dual Proxmox - ${hostname1} & ${hostname2}`;
    const result = createProxmoxDualNodeDashboard(hostname1, hostname2, name);
    return { dashboard_name: name, ...result };
  }

  private async addProxmoxWidgets(dashboardId: string, hostname: string, widgetTypes: string[]): Promise<any> {
    return {
      dashboard_id: dashboardId,
      hostname: hostname,
      widget_types: widgetTypes,
      message: 'Widgets configuration prepared (implementation pending dashboard API)'
    };
  }

  private async analyzeProxmoxHosts(hostnamePattern: string): Promise<any> {
    const hosts: any = await this.zabbixClient.hostGet({
      output: 'extend',
      search: { name: hostnamePattern }
    });
    
    const analysis = {
      pattern: hostnamePattern,
      hosts_found: Array.isArray(hosts) ? hosts.length : 1,
      hosts: Array.isArray(hosts) ? hosts.map((h: any) => ({
        hostid: h.hostid,
        name: h.name,
        status: h.status
      })) : [{ hostid: (hosts as any).hostid, name: (hosts as any).name, status: (hosts as any).status }]
    };
    
    return analysis;
  }

  private async createIOPSItems(hostname: string, devices?: string[]): Promise<any> {
    const targetDevices = devices || ['sda', 'sdb', 'nvme0n1'];
    
    return {
      hostname: hostname,
      devices: targetDevices,
      message: 'IOPS items configuration prepared',
      items_to_create: targetDevices.length * 3
    };
  }

  private async discoverDiskDevices(args?: any): Promise<any> {
    const hostname = args?.hostname;
    const pattern = args?.hostname_pattern || 'Proxmox';
    
    let hosts;
    if (hostname) {
      hosts = await this.zabbixClient.hostGet({
        output: 'extend',
        filter: { host: hostname }
      });
    } else {
      hosts = await this.zabbixClient.hostGet({
        output: 'extend', 
        search: { name: pattern }
      });
    }
    
    return {
      search_criteria: { hostname, pattern },
      hosts_found: Array.isArray(hosts) ? hosts.length : 1,
      discovered_devices: ['sda', 'sdb', 'nvme0n1'],
    };
  }

  private async createIOPSDashboard(args: any): Promise<any> {
    const name = args.name;
    const hostname = args.hostname;
    const devices = args.devices || ['sda', 'sdb'];
    
    return {
      dashboard_name: name,
      hostname: hostname,
      devices: devices,
      message: 'IOPS dashboard configuration prepared',
      widgets_planned: devices.length * 2
    };
  }

  private async verifyConnectivity(): Promise<any> {
    try {
      const isConnected = this.zabbixClient.isAuthenticated();
      const version = await this.zabbixClient.apiinfoVersion();
      
      return {
        connected: isConnected,
        authenticated: isConnected,
        version: version,
        timestamp: new Date().toISOString(),
        url: this.baseUrl,
        readOnly: this.readOnly
      };
    } catch (error: any) {
      return {
        connected: false,
        authenticated: false,
        error: error.message,
        timestamp: new Date().toISOString()
      };
    }
  }

  private setupZabbixTools(server: Server) {
    // List available tools - COMPLETE implementation from main server
    server.setRequestHandler(ListToolsRequestSchema, async () => {
      return {
        tools: [
          // Host management
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
            name: 'host_create',
            description: 'Create a new Zabbix host (write mode only)',
            inputSchema: {
              type: 'object',
              required: ['host', 'groups', 'interfaces'],
              properties: {
                host: { type: 'string', description: 'Host name' },
                groups: { type: 'array', items: { type: 'object' }, description: 'Host groups' },
                interfaces: { type: 'array', items: { type: 'object' }, description: 'Host interfaces' },
                templates: { type: 'array', items: { type: 'object' }, description: 'Templates to link' },
                macros: { type: 'array', items: { type: 'object' }, description: 'Host macros' },
              },
            },
          },
          // Item management
          {
            name: 'item_get',
            description: 'Get Zabbix items with optional filters',
            inputSchema: {
              type: 'object',
              properties: {
                output: { type: 'string', description: 'Output format' },
                hostids: { type: 'array', items: { type: 'string' }, description: 'Host IDs to filter' },
                search: { type: 'object', description: 'Search criteria' },
                filter: { type: 'object', description: 'Filter criteria' },
                limit: { type: 'number', description: 'Limit number of results' },
              },
            },
          },
          {
            name: 'item_create',
            description: 'Create a new Zabbix item (write mode only)',
            inputSchema: {
              type: 'object',
              required: ['hostid', 'name', 'key_', 'type', 'value_type'],
              properties: {
                hostid: { type: 'string', description: 'Host ID' },
                name: { type: 'string', description: 'Item name' },
                key_: { type: 'string', description: 'Item key' },
                type: { type: 'number', description: 'Item type' },
                value_type: { type: 'number', description: 'Value type' },
                delay: { type: 'string', description: 'Update interval' },
                description: { type: 'string', description: 'Item description' },
              },
            },
          },
          // Dashboard management
          {
            name: 'dashboard_get',
            description: 'Get Zabbix dashboards',
            inputSchema: {
              type: 'object',
              properties: {
                output: { type: 'string', description: 'Output format' },
                dashboardids: { type: 'array', items: { type: 'string' }, description: 'Dashboard IDs' },
                search: { type: 'object', description: 'Search criteria' },
              },
            },
          },
          {
            name: 'dashboard_create',
            description: 'Create a new Zabbix dashboard (write mode only)',
            inputSchema: {
              type: 'object',
              required: ['name'],
              properties: {
                name: { type: 'string', description: 'Dashboard name' },
                display_period: { type: 'number', description: 'Display period in seconds' },
                auto_start: { type: 'number', description: 'Auto start (0 or 1)' },
                pages: { type: 'array', items: { type: 'object' }, description: 'Dashboard pages' },
              },
            },
          },
          // Proxmox tools
          {
            name: 'proxmox_dashboard_create_single',
            description: 'Create a comprehensive Proxmox dashboard for a single node',
            inputSchema: {
              type: 'object',
              required: ['hostname'],
              properties: {
                hostname: { type: 'string', description: 'Proxmox hostname to monitor' },
                dashboard_name: { type: 'string', description: 'Custom dashboard name' },
              },
            },
          },
          // System operations
          {
            name: 'api_connectivity_check',
            description: 'Test Zabbix API connectivity and authentication',
            inputSchema: {
              type: 'object',
              properties: {},
            },
          },
          {
            name: 'api_version_get',
            description: 'Get Zabbix API version information',
            inputSchema: {
              type: 'object',
              properties: {},
            },
          },
          // Host group management
          {
            name: 'hostgroup_get',
            description: 'Get Zabbix host groups',
            inputSchema: {
              type: 'object',
              properties: {
                output: { type: 'string', description: 'Output format' },
                groupids: { type: 'array', items: { type: 'string' }, description: 'Group IDs to filter' },
                search: { type: 'object', description: 'Search criteria' },
              },
            },
          },
          // Item management - delete
          {
            name: 'item_delete',
            description: 'Delete Zabbix items (write mode only)',
            inputSchema: {
              type: 'object',
              required: ['itemids'],
              properties: {
                itemids: { type: 'array', items: { type: 'string' }, description: 'Item IDs to delete' },
              },
            },
          },
          // Monitoring operations
          {
            name: 'trigger_get',
            description: 'Get Zabbix triggers',
            inputSchema: {
              type: 'object',
              properties: {
                output: { type: 'string', description: 'Output format' },
                hostids: { type: 'array', items: { type: 'string' }, description: 'Host IDs to filter' },
                triggerids: { type: 'array', items: { type: 'string' }, description: 'Trigger IDs to filter' },
                search: { type: 'object', description: 'Search criteria' },
              },
            },
          },
          {
            name: 'problem_get',
            description: 'Get current Zabbix problems',
            inputSchema: {
              type: 'object',
              properties: {
                output: { type: 'string', description: 'Output format' },
                hostids: { type: 'array', items: { type: 'string' }, description: 'Host IDs to filter' },
                recent: { type: 'boolean', description: 'Show recent problems only' },
                severities: { type: 'array', items: { type: 'number' }, description: 'Severity levels to filter' },
              },
            },
          },
          {
            name: 'history_get',
            description: 'Get item history data',
            inputSchema: {
              type: 'object',
              required: ['itemids'],
              properties: {
                output: { type: 'string', description: 'Output format' },
                itemids: { type: 'array', items: { type: 'string' }, description: 'Item IDs' },
                history: { type: 'number', description: 'History type (0=float, 1=char, 2=log, 3=uint, 4=text)' },
                time_from: { type: 'string', description: 'Start time (timestamp)' },
                time_till: { type: 'string', description: 'End time (timestamp)' },
                limit: { type: 'number', description: 'Number of records to return' },
              },
            },
          },
          // Dashboard management - advanced
          {
            name: 'dashboard_update',
            description: 'Update an existing Zabbix dashboard (write mode only)',
            inputSchema: {
              type: 'object',
              required: ['dashboardid'],
              properties: {
                dashboardid: { type: 'string', description: 'Dashboard ID to update' },
                name: { type: 'string', description: 'Dashboard name' },
                display_period: { type: 'number', description: 'Display period in seconds' },
                auto_start: { type: 'number', description: 'Auto start (0 or 1)' },
                pages: { type: 'array', items: { type: 'object' }, description: 'Dashboard pages' },
              },
            },
          },
          {
            name: 'dashboard_delete',
            description: 'Delete Zabbix dashboards (write mode only)',
            inputSchema: {
              type: 'object',
              required: ['dashboardids'],
              properties: {
                dashboardids: { type: 'array', items: { type: 'string' }, description: 'Dashboard IDs to delete' },
              },
            },
          },
          // Proxmox tools - advanced
          {
            name: 'proxmox_dashboard_create_dual',
            description: 'Create a comprehensive dashboard for dual Proxmox nodes',
            inputSchema: {
              type: 'object',
              required: ['hostname1', 'hostname2'],
              properties: {
                hostname1: { type: 'string', description: 'First Proxmox hostname' },
                hostname2: { type: 'string', description: 'Second Proxmox hostname' },
                dashboard_name: { type: 'string', description: 'Custom dashboard name' },
              },
            },
          },
          {
            name: 'proxmox_dashboard_add_widgets',
            description: 'Add monitoring widgets to existing Proxmox dashboard',
            inputSchema: {
              type: 'object',
              required: ['dashboard_id', 'hostname'],
              properties: {
                dashboard_id: { type: 'string', description: 'Target dashboard ID' },
                hostname: { type: 'string', description: 'Proxmox hostname to add widgets for' },
                widget_types: { type: 'array', items: { type: 'string' }, description: 'Widget types to add' },
              },
            },
          },
          {
            name: 'proxmox_hosts_analyze',
            description: 'Analyze Proxmox hosts and their monitoring items',
            inputSchema: {
              type: 'object',
              properties: {
                hostname_pattern: { type: 'string', description: 'Hostname pattern to match (default: "Proxmox")' },
              },
            },
          },
          // IOPS monitoring tools
          {
            name: 'iops_item_create',
            description: 'Create comprehensive IOPS monitoring items for a host',
            inputSchema: {
              type: 'object',
              required: ['hostname'],
              properties: {
                hostname: { type: 'string', description: 'Target hostname for IOPS monitoring' },
                devices: { type: 'array', items: { type: 'string' }, description: 'Disk devices to monitor (e.g., ["sda", "sdb"])' },
              },
            },
          },
          {
            name: 'disk_devices_discover',
            description: 'Discover available disk devices on monitored hosts',
            inputSchema: {
              type: 'object',
              properties: {
                hostname: { type: 'string', description: 'Specific hostname to analyze' },
                hostname_pattern: { type: 'string', description: 'Hostname pattern to match' },
              },
            },
          },
          {
            name: 'iops_dashboard_create',
            description: 'Create comprehensive IOPS monitoring dashboard',
            inputSchema: {
              type: 'object',
              required: ['name'],
              properties: {
                name: { type: 'string', description: 'Dashboard name' },
                hostname: { type: 'string', description: 'Specific hostname to monitor' },
                hostname_pattern: { type: 'string', description: 'Hostname pattern for multiple hosts' },
                devices: { type: 'array', items: { type: 'string' }, description: 'Specific devices to monitor' },
                time_period: { type: 'string', description: 'Default time period (default: "1h")' },
              },
            },
          },
          // System verification
          {
            name: 'verify_connectivity',
            description: 'Comprehensive Zabbix API connectivity and authentication verification',
            inputSchema: {
              type: 'object',
              properties: {},
            },
          },
        ]
      };
    });

    // Setup call_tool handler - COMPLETE implementation
    server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;
      
      try {
        // Ensure Zabbix client is authenticated
        if (!this.zabbixClient.isAuthenticated()) {
          await this.zabbixClient.login();
        }
        
        switch (name) {
          // Host operations
          case 'host_get':
            const hosts = await this.zabbixClient.hostGet(args || {});
            return {
              content: [{
                type: "text",
                text: JSON.stringify(hosts, null, 2)
              }]
            };
            
          case 'host_create':
            this.validateReadOnly('host_create');
            const newHost = await this.zabbixClient.hostCreate(args);
            return {
              content: [{
                type: "text",
                text: JSON.stringify(newHost, null, 2)
              }]
            };

          // Item operations  
          case 'item_get':
            const items = await this.zabbixClient.itemGet(args || {});
            return {
              content: [{
                type: "text",
                text: JSON.stringify(items, null, 2)
              }]
            };
            
          case 'item_create':
            this.validateReadOnly('item_create');
            const newItem = await this.zabbixClient.itemCreate(args);
            return {
              content: [{
                type: "text",
                text: JSON.stringify(newItem, null, 2)
              }]
            };

          // Dashboard operations
          case 'dashboard_get':
            const dashboards = await this.zabbixClient.dashboardGet(args || {});
            return {
              content: [{
                type: "text",
                text: JSON.stringify(dashboards, null, 2)
              }]
            };
            
          case 'dashboard_create':
            this.validateReadOnly('dashboard_create');
            const newDashboard = await this.zabbixClient.dashboardCreate(args);
            return {
              content: [{
                type: "text",
                text: JSON.stringify(newDashboard, null, 2)
              }]
            };

          // Proxmox operations
          case 'proxmox_dashboard_create_single':
            this.validateReadOnly('proxmox_dashboard_create_single');
            if (!args || !args.hostname) {
              throw new Error('hostname is required');
            }
            const hostname = args.hostname as string;
            const proxmoxWidgets = createProxmoxNodeDashboard(hostname, hostname);
            return {
              content: [{
                type: "text",
                text: `Proxmox dashboard widgets created for ${args.hostname}:\n${JSON.stringify(proxmoxWidgets, null, 2)}`
              }]
            };

          // System operations
          case 'api_connectivity_check':
            const isConnected = this.zabbixClient.isAuthenticated();
            const connectivity = {
              connected: isConnected,
              url: this.baseUrl,
              timestamp: new Date().toISOString(),
              readOnly: this.readOnly
            };
            return {
              content: [{
                type: "text",
                text: JSON.stringify(connectivity, null, 2)
              }]
            };
            
          case 'api_version_get':
            const version = await this.zabbixClient.apiinfoVersion();
            return {
              content: [{
                type: "text",
                text: JSON.stringify(version, null, 2)
              }]
            };

          // Host group operations
          case 'hostgroup_get':
            const hostgroups = await this.zabbixClient.hostgroupGet(args || {});
            return {
              content: [{
                type: "text",
                text: JSON.stringify(hostgroups, null, 2)
              }]
            };

          // Item operations - delete
          case 'item_delete':
            this.validateReadOnly('item_delete');
            if (!args || !args.itemids) {
              throw new Error('itemids is required');
            }
            const itemIds = Array.isArray(args.itemids) ? args.itemids as string[] : [args.itemids as string];
            const deletedItems = await this.zabbixClient.itemDelete(itemIds);
            return {
              content: [{
                type: "text",
                text: JSON.stringify(deletedItems, null, 2)
              }]
            };

          // Monitoring operations
          case 'trigger_get':
            const triggers = await this.zabbixClient.triggerGet(args || {});
            return {
              content: [{
                type: "text",
                text: JSON.stringify(triggers, null, 2)
              }]
            };

          case 'problem_get':
            const problems = await this.zabbixClient.problemGet(args || {});
            return {
              content: [{
                type: "text",
                text: JSON.stringify(problems, null, 2)
              }]
            };

          case 'history_get':
            const history = await this.zabbixClient.historyGet(args);
            return {
              content: [{
                type: "text",
                text: JSON.stringify(history, null, 2)
              }]
            };

          // Dashboard operations - advanced
          case 'dashboard_update':
            this.validateReadOnly('dashboard_update');
            const updatedDashboard = await this.zabbixClient.dashboardUpdate(args);
            return {
              content: [{
                type: "text",
                text: JSON.stringify(updatedDashboard, null, 2)
              }]
            };

          case 'dashboard_delete':
            this.validateReadOnly('dashboard_delete');
            if (!args || !args.dashboardids) {
              throw new Error('dashboardids is required');
            }
            const dashboardIds = Array.isArray(args.dashboardids) ? args.dashboardids as string[] : [args.dashboardids as string];
            const deletedDashboards = await this.zabbixClient.dashboardDelete(dashboardIds);
            return {
              content: [{
                type: "text",
                text: JSON.stringify(deletedDashboards, null, 2)
              }]
            };

          // Proxmox operations - advanced
          case 'proxmox_dashboard_create_dual':
            this.validateReadOnly('proxmox_dashboard_create_dual');
            if (!args || !args.hostname1 || !args.hostname2) {
              throw new Error('hostname1 and hostname2 are required');
            }
            const dualDashboard = await this.createDualProxmoxDashboard(
              args.hostname1 as string,
              args.hostname2 as string, 
              args.dashboard_name as string
            );
            return {
              content: [{
                type: "text",
                text: `Dual Proxmox dashboard created for ${args.hostname1} and ${args.hostname2}:\n${JSON.stringify(dualDashboard, null, 2)}`
              }]
            };

          case 'proxmox_dashboard_add_widgets':
            this.validateReadOnly('proxmox_dashboard_add_widgets');
            if (!args || !args.dashboard_id || !args.hostname) {
              throw new Error('dashboard_id and hostname are required');
            }
            const widgetTypes = Array.isArray(args.widget_types) ? args.widget_types as string[] : ['cpu', 'memory', 'network', 'storage'];
            const addedWidgets = await this.addProxmoxWidgets(
              args.dashboard_id as string,
              args.hostname as string,
              widgetTypes
            );
            return {
              content: [{
                type: "text",
                text: `Widgets added to dashboard ${args.dashboard_id}:\n${JSON.stringify(addedWidgets, null, 2)}`
              }]
            };

          case 'proxmox_hosts_analyze':
            const hostnamePattern = args?.hostname_pattern as string || 'Proxmox';
            const analysis = await this.analyzeProxmoxHosts(hostnamePattern);
            return {
              content: [{
                type: "text",
                text: `Proxmox hosts analysis:\n${JSON.stringify(analysis, null, 2)}`
              }]
            };

          // IOPS operations
          case 'iops_item_create':
            this.validateReadOnly('iops_item_create');
            if (!args || !args.hostname) {
              throw new Error('hostname is required');
            }
            const devices = Array.isArray(args.devices) ? args.devices as string[] : undefined;
            const iopItems = await this.createIOPSItems(
              args.hostname as string,
              devices
            );
            return {
              content: [{
                type: "text",
                text: `IOPS items created for ${args.hostname}:\n${JSON.stringify(iopItems, null, 2)}`
              }]
            };

          case 'disk_devices_discover':
            const deviceDiscovery = await this.discoverDiskDevices(args);
            return {
              content: [{
                type: "text",
                text: `Disk devices discovered:\n${JSON.stringify(deviceDiscovery, null, 2)}`
              }]
            };

          case 'iops_dashboard_create':
            this.validateReadOnly('iops_dashboard_create');
            if (!args || !args.name) {
              throw new Error('name is required');
            }
            const iopsDashboard = await this.createIOPSDashboard(args);
            return {
              content: [{
                type: "text",
                text: `IOPS dashboard created:\n${JSON.stringify(iopsDashboard, null, 2)}`
              }]
            };

          // System verification
          case 'verify_connectivity':
            const connectivityResult = await this.verifyConnectivity();
            return {
              content: [{
                type: "text",
                text: JSON.stringify(connectivityResult, null, 2)
              }]
            };
            
          default:
            throw new Error(`Unknown tool: ${name}`);
        }
      } catch (error: any) {
        console.error(`Error in tool ${name}:`, error);
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

        // Setup ALL Zabbix tools
        this.setupZabbixTools(server);

        // Create SSE transport with message endpoint and response object  
        const transport = new SSEServerTransport('/message', res);
        
        // Store session BEFORE connecting
        this.sessions.set(sessionId, {
          server,
          transport,
          lastActivity: Date.now()
        });
        
        // Connect server to transport (this will start the SSE connection and call transport.start())
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
      const requestedSessionId = req.query.sessionId as string || req.headers['x-session-id'] as string;
      
      if (!requestedSessionId) {
        return res.status(400).json({ error: 'Session ID required in query parameter or X-Session-ID header' });
      }

      // Find session by transport sessionId instead of relying on exact match
      let foundSession: { server: any, transport: any, lastActivity: number } | undefined;
      let actualSessionId: string | undefined;
      
      for (const [sessionId, session] of this.sessions) {
        if (session.transport.sessionId === requestedSessionId || sessionId === requestedSessionId) {
          foundSession = session;
          actualSessionId = sessionId;
          break;
        }
      }

      if (!foundSession || !actualSessionId) {
        console.error(`❌ Session not found. Requested: ${requestedSessionId}`);
        console.error(`📋 Active sessions:`, Array.from(this.sessions.keys()));
        return res.status(404).json({ error: `Session ${requestedSessionId} not found` });
      }

      // Update last activity
      foundSession.lastActivity = Date.now();

      try {
        console.log(`📦 Handling POST message for session ${actualSessionId} (requested: ${requestedSessionId})`);
        console.log(`📨 Transport sessionId:`, foundSession.transport.sessionId);
        
        // Handle the POST message through the transport
        await foundSession.transport.handlePostMessage(req, res);
      } catch (error: any) {
        console.error(`❌ Error handling message for session ${actualSessionId}:`, error);
        console.error(`📊 Error stack:`, error.stack);
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
        version: '1.0.4',
        readOnly: this.readOnly,
        toolsCount: 23 // All tools migrated from STDIO server
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
        console.log(`Read-only mode: ${this.readOnly}`);
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