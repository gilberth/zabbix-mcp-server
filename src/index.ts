#!/usr/bin/env node

/**
 * Zabbix MCP Server - TypeScript Implementation
 * Provides Zabbix API access through the Model Context Protocol
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { config } from 'dotenv';
import { ZabbixClient } from './zabbix-client.js';

// Load environment variables
config();

// Initialize Zabbix client
const zabbixUrl = process.env.ZABBIX_URL || 'http://localhost/zabbix';
const baseUrl = zabbixUrl.replace('/api_jsonrpc.php', ''); // Remove endpoint if present
const zabbixConfig = {
  url: baseUrl,
  // Use username/password authentication instead of token for better compatibility
  user: process.env.ZABBIX_USER || 'Admin',
  password: process.env.ZABBIX_PASSWORD || 'zabbix',
  // token: process.env.ZABBIX_TOKEN, // Commented out due to authorization issues
};

const client = new ZabbixClient(zabbixConfig);
const readOnly = process.env.READ_ONLY !== 'false';

// Validation helper
function validateReadOnly(operation: string): void {
  if (readOnly && !['get', 'list', 'export'].some(op => operation.includes(op))) {
    throw new Error(`Operation '${operation}' is not allowed in read-only mode`);
  }
}

// Create server instance
const server = new Server(
  {
    name: 'zabbix-mcp-server',
    version: '1.0.0',
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

// List available tools
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
        description: 'Create a new Zabbix host',
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
      // Host groups
      {
        name: 'hostgroup_get',
        description: 'Get Zabbix host groups',
        inputSchema: {
          type: 'object',
          properties: {
            output: { type: 'string', description: 'Output format' },
            groupids: { type: 'array', items: { type: 'string' }, description: 'Group IDs' },
            search: { type: 'object', description: 'Search criteria' },
          },
        },
      },
      // Items
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
      // Triggers
      {
        name: 'trigger_get',
        description: 'Get Zabbix triggers',
        inputSchema: {
          type: 'object',
          properties: {
            output: { type: 'string', description: 'Output format' },
            triggerids: { type: 'array', items: { type: 'string' }, description: 'Trigger IDs' },
            hostids: { type: 'array', items: { type: 'string' }, description: 'Host IDs' },
            search: { type: 'object', description: 'Search criteria' },
          },
        },
      },
      // Problems
      {
        name: 'problem_get',
        description: 'Get Zabbix problems',
        inputSchema: {
          type: 'object',
          properties: {
            output: { type: 'string', description: 'Output format' },
            hostids: { type: 'array', items: { type: 'string' }, description: 'Host IDs' },
            severities: { type: 'array', items: { type: 'number' }, description: 'Problem severities' },
            acknowledged: { type: 'boolean', description: 'Filter by acknowledgment status' },
          },
        },
      },
      // History
      {
        name: 'history_get',
        description: 'Get historical data',
        inputSchema: {
          type: 'object',
          required: ['history', 'itemids'],
          properties: {
            history: { type: 'number', description: 'Value type (0-4)' },
            itemids: { type: 'array', items: { type: 'string' }, description: 'Item IDs' },
            time_from: { type: 'number', description: 'Start timestamp' },
            time_till: { type: 'number', description: 'End timestamp' },
            limit: { type: 'number', description: 'Maximum number of records' },
          },
        },
      },
      // API Info
      {
        name: 'apiinfo_version',
        description: 'Get Zabbix API version information',
        inputSchema: {
          type: 'object',
          properties: {},
        },
      },
    ],
  };
});

// Handle tool calls
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    switch (name) {
      case 'host_get': {
        const params: Record<string, any> = { output: args?.output || 'extend' };
        if (args?.hostids) params.hostids = args.hostids;
        if (args?.groupids) params.groupids = args.groupids;
        if (args?.search) params.search = args.search;
        if (args?.filter) params.filter = args.filter;
        
        const result = await client.hostGet(params);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(result, null, 2),
            },
          ],
        };
      }

      case 'host_create': {
        validateReadOnly('host_create');
        if (!args?.host || !args?.groups || !args?.interfaces) {
          throw new Error('Missing required parameters: host, groups, interfaces');
        }
        
        const result = await client.hostCreate({
          host: args.host,
          groups: args.groups,
          interfaces: args.interfaces,
          templates: args.templates || [],
          macros: args.macros || [],
        });
        
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(result, null, 2),
            },
          ],
        };
      }

      case 'hostgroup_get': {
        const params: Record<string, any> = { output: args?.output || 'extend' };
        if (args?.groupids) params.groupids = args.groupids;
        if (args?.search) params.search = args.search;
        
        const result = await client.hostgroupGet(params);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(result, null, 2),
            },
          ],
        };
      }

      case 'item_get': {
        const params: Record<string, any> = { output: args?.output || 'extend' };
        if (args?.itemids) params.itemids = args.itemids;
        if (args?.hostids) params.hostids = args.hostids;
        if (args?.search) params.search = args.search;
        
        const result = await client.itemGet(params);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(result, null, 2),
            },
          ],
        };
      }

      case 'trigger_get': {
        const params: Record<string, any> = { output: args?.output || 'extend' };
        if (args?.triggerids) params.triggerids = args.triggerids;
        if (args?.hostids) params.hostids = args.hostids;
        if (args?.search) params.search = args.search;
        
        const result = await client.triggerGet(params);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(result, null, 2),
            },
          ],
        };
      }

      case 'problem_get': {
        const params: Record<string, any> = { output: args?.output || 'extend' };
        if (args?.hostids) params.hostids = args.hostids;
        if (args?.severities) params.severities = args.severities;
        if (args?.acknowledged !== undefined) params.acknowledged = args.acknowledged;
        
        const result = await client.problemGet(params);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(result, null, 2),
            },
          ],
        };
      }

      case 'history_get': {
        if (args?.history === undefined || args?.history === null || !args?.itemids) {
          throw new Error('Missing required parameters: history, itemids');
        }
        
        const params: Record<string, any> = {
          history: args.history,
          itemids: args.itemids,
        };
        if (args?.time_from) params.time_from = args.time_from;
        if (args?.time_till) params.time_till = args.time_till;
        if (args?.limit) params.limit = args.limit;
        
        const result = await client.historyGet(params);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(result, null, 2),
            },
          ],
        };
      }

      case 'apiinfo_version': {
        // Create a separate client without authentication for apiinfo.version
        const unauthenticatedClient = new ZabbixClient({
          url: zabbixConfig.url,
          user: zabbixConfig.user,
          password: zabbixConfig.password,
        });
        const result = await unauthenticatedClient.apiinfoVersion();
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(result, null, 2),
            },
          ],
        };
      }

      default:
        throw new Error(`Unknown tool: ${name}`);
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return {
      content: [
        {
          type: 'text',
          text: `Error: ${errorMessage}`,
        },
      ],
      isError: true,
    };
  }
});

// Start the server
async function main() {
  try {
    // Test Zabbix connection
     await client.login();
    console.error('✅ Zabbix MCP Server started successfully');
    console.error(`📡 Connected to: ${zabbixConfig.url}`);
    console.error(`🔒 Read-only mode: ${readOnly}`);
    
    const transport = new StdioServerTransport();
    await server.connect(transport);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(`❌ Failed to start server: ${errorMessage}`);
    process.exit(1);
  }
}

// Handle graceful shutdown
process.on('SIGINT', async () => {
  console.error('\n🛑 Shutting down Zabbix MCP Server...');
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.error('\n🛑 Shutting down Zabbix MCP Server...');
  process.exit(0);
});

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(`❌ Server error: ${errorMessage}`);
    process.exit(1);
  });
}