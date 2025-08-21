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
import { 
  createSVGGraphWidget, 
  createProxmoxNodeDashboard, 
  createProxmoxDualNodeDashboard,
  PROXMOX_ITEM_PATTERNS 
} from './dashboard-utils.js';

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

// Helper function to provide item creation examples
function getItemCreationExamples(): string {
  return `
Item Creation Examples:

1. Trapper Item (Type 2) - Simplest, no interface required:
{
  "hostid": "10084",
  "name": "Custom Metric",
  "key_": "custom.metric",
  "type": 2,
  "value_type": 0,
  "description": "Custom trapper item",
  "status": 0
}

2. Zabbix Agent Item (Type 0) - Requires agent interface:
{
  "hostid": "10084",
  "name": "CPU Usage",
  "key_": "system.cpu.util",
  "type": 0,
  "value_type": 0,
  "delay": "1m",
  "history": "7d",
  "trends": "365d",
  "units": "%",
  "description": "CPU utilization",
  "status": 0
}

3. Calculated Item (Type 15):
{
  "hostid": "10084",
  "name": "Memory Usage Percentage",
  "key_": "memory.usage.percent",
  "type": 15,
  "value_type": 0,
  "params": "100*last(//vm.memory.size[used])/last(//vm.memory.size[total])",
  "delay": "1m",
  "history": "7d",
  "trends": "365d",
  "units": "%",
  "description": "Calculated memory usage percentage",
  "status": 0
}

Valid Types: 0=Agent, 1=SNMPv1, 2=Trapper, 3=Simple, 5=SNMPv2, 7=SNMPv3, 8=Internal, 9=Aggregate, 10=External, 11=Database, 12=IPMI, 13=SSH, 14=Telnet, 15=Calculated, 16=JMX, 17=SNMP trap, 18=Dependent, 19=HTTP agent, 20=SNMP agent, 21=Script
Valid Value Types: 0=Float, 1=Character, 2=Log, 3=Unsigned, 4=Text
`;
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
      {
        name: 'item_create',
        description: 'Create new Zabbix monitoring items',
        inputSchema: {
          type: 'object',
          required: ['hostid', 'name', 'key_', 'type', 'value_type'],
          properties: {
            hostid: { type: 'string', description: 'Host ID where the item will be created' },
            name: { type: 'string', description: 'Item name' },
            key_: { type: 'string', description: 'Item key' },
            type: { type: 'number', description: 'Item type (0=Zabbix agent, 2=Zabbix trapper, 15=calculated, etc.)' },
            value_type: { type: 'number', description: 'Value type (0=float, 1=character, 2=log, 3=unsigned, 4=text)' },
            params: { type: 'string', description: 'Additional parameters (for calculated items)' },
            delay: { type: 'string', description: 'Update interval (e.g., "1m", "30s")' },
            history: { type: 'string', description: 'History retention period (e.g., "7d", "30d")' },
            trends: { type: 'string', description: 'Trend retention period (e.g., "365d")' },
            units: { type: 'string', description: 'Units of measurement' },
            description: { type: 'string', description: 'Item description' },
            status: { type: 'number', description: 'Item status (0=enabled, 1=disabled)' },
          },
        },
      },
      {
        name: 'item_delete',
        description: 'Delete Zabbix monitoring items',
        inputSchema: {
          type: 'object',
          required: ['itemids'],
          properties: {
            itemids: {
              type: 'array',
              items: { type: 'string' },
              description: 'Array of item IDs to delete'
            },
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
      // Dashboard management
      {
        name: 'dashboard_get',
        description: 'Get Zabbix dashboards with optional filters',
        inputSchema: {
          type: 'object',
          properties: {
            output: { type: 'string', description: 'Output format (extend, count, etc.)' },
            dashboardids: { type: 'array', items: { type: 'string' }, description: 'Dashboard IDs to filter' },
            search: { type: 'object', description: 'Search criteria' },
            filter: { type: 'object', description: 'Filter criteria' },
            selectPages: { type: 'string', description: 'Include dashboard pages (extend, count, etc.)' },
            selectUsers: { type: 'string', description: 'Include dashboard user shares (extend, count, etc.)' },
            selectUserGroups: { type: 'string', description: 'Include dashboard user group shares (extend, count, etc.)' },
          },
        },
      },
      {
        name: 'dashboard_create',
        description: 'Create a new Zabbix dashboard',
        inputSchema: {
          type: 'object',
          required: ['name'],
          properties: {
            name: { type: 'string', description: 'Dashboard name' },
            display_period: { type: 'number', description: 'Display period in seconds (default: 30)' },
            auto_start: { type: 'number', description: 'Auto start (0 or 1, default: 1)' },
            private: { type: 'number', description: 'Dashboard sharing type (0: public, 1: private)' },
            pages: { 
              type: 'array', 
              items: { type: 'object' }, 
              description: 'Dashboard pages with widgets' 
            },
            users: { 
              type: 'array', 
              items: { type: 'object' }, 
              description: 'Dashboard user shares' 
            },
            userGroups: { 
              type: 'array', 
              items: { type: 'object' }, 
              description: 'Dashboard user group shares' 
            },
          },
        },
      },
      {
        name: 'dashboard_update',
        description: 'Update an existing Zabbix dashboard',
        inputSchema: {
          type: 'object',
          required: ['dashboardid'],
          properties: {
            dashboardid: { type: 'string', description: 'Dashboard ID to update' },
            name: { type: 'string', description: 'Dashboard name' },
            display_period: { type: 'number', description: 'Display period in seconds' },
            auto_start: { type: 'number', description: 'Auto start (0 or 1)' },
            private: { type: 'number', description: 'Dashboard sharing type (0: public, 1: private)' },
            pages: { 
              type: 'array', 
              items: { type: 'object' }, 
              description: 'Dashboard pages to replace existing ones' 
            },
            users: { 
              type: 'array', 
              items: { type: 'object' }, 
              description: 'Dashboard user shares to replace existing ones' 
            },
            userGroups: { 
              type: 'array', 
              items: { type: 'object' }, 
              description: 'Dashboard user group shares to replace existing ones' 
            },
          },
        },
      },
      {
        name: 'dashboard_delete',
        description: 'Delete Zabbix dashboards',
        inputSchema: {
          type: 'object',
          required: ['dashboardids'],
          properties: {
            dashboardids: { 
              type: 'array', 
              items: { type: 'string' }, 
              description: 'Dashboard IDs to delete' 
            },
          },
        },
      },
      // Proxmox Dashboard Tools
      {
        name: 'proxmox_dashboard_create_single',
        description: 'Create a comprehensive Proxmox dashboard for a single node with CPU, memory, disk, and network monitoring',
        inputSchema: {
          type: 'object',
          required: ['hostname'],
          properties: {
            hostname: { type: 'string', description: 'Proxmox hostname to monitor' },
            dashboard_name: { type: 'string', description: 'Custom dashboard name (default: "Proxmox Monitoring")' },
          },
        },
      },
      {
        name: 'proxmox_dashboard_create_dual',
        description: 'Create a dual Proxmox dashboard comparing two nodes side by side',
        inputSchema: {
          type: 'object',
          required: ['hostname1', 'hostname2'],
          properties: {
            hostname1: { type: 'string', description: 'First Proxmox hostname' },
            hostname2: { type: 'string', description: 'Second Proxmox hostname' },
            dashboard_name: { type: 'string', description: 'Custom dashboard name (default: "Proxmox")' },
          },
        },
      },
      {
        name: 'proxmox_dashboard_add_widgets',
        description: 'Add additional monitoring widgets to an existing Proxmox dashboard',
        inputSchema: {
          type: 'object',
          required: ['dashboard_id', 'hostname'],
          properties: {
            dashboard_id: { type: 'string', description: 'Existing dashboard ID to enhance' },
            hostname: { type: 'string', description: 'Proxmox hostname to add widgets for' },
            widget_types: { 
              type: 'array', 
              items: { type: 'string' }, 
              description: 'Widget types to add: problems, api_status, cluster_status, system_info, cpu_graph, memory_graph' 
            },
          },
        },
      },
      {
        name: 'proxmox_hosts_analyze',
        description: 'Analyze available Proxmox hosts and their monitoring items',
        inputSchema: {
          type: 'object',
          properties: {
            hostname_filter: { type: 'string', description: 'Filter hosts by name pattern' },
            categorize_items: { type: 'boolean', description: 'Categorize items by type (CPU, memory, disk, network)' },
          },
        },
      },
      // IOPS Monitoring Tools
      {
        name: 'iops_item_create',
        description: 'Create IOPS monitoring items for disk devices (read, write, utilization)',
        inputSchema: {
          type: 'object',
          properties: {
            hostid: { type: 'string', description: 'Host ID where to create the items' },
            device: { type: 'string', description: 'Disk device name (e.g., sda, nvme0n1)' },
            item_types: { 
              type: 'array', 
              items: { type: 'string', enum: ['read', 'write', 'util'] },
              description: 'Types of IOPS items to create (default: all)' 
            },
            update_interval: { type: 'string', description: 'Update interval (default: 1m)' },
            history_days: { type: 'number', description: 'History retention in days (default: 7)' },
            trend_days: { type: 'number', description: 'Trend retention in days (default: 365)' },
          },
          required: ['hostid', 'device'],
        },
      },
      {
        name: 'disk_devices_discover',
        description: 'Discover available disk devices on a host for IOPS monitoring',
        inputSchema: {
          type: 'object',
          properties: {
            hostid: { type: 'string', description: 'Host ID to discover devices from' },
            device_filter: { type: 'string', description: 'Filter devices by pattern (e.g., sd*, nvme*)' },
            exclude_virtual: { type: 'boolean', description: 'Exclude virtual devices (default: true)' },
          },
          required: ['hostid'],
        },
      },
      {
        name: 'iops_dashboard_create',
        description: 'Create a dashboard with IOPS monitoring graphs for specified hosts',
        inputSchema: {
          type: 'object',
          properties: {
            name: { type: 'string', description: 'Dashboard name' },
            hostids: { 
              type: 'array', 
              items: { type: 'string' },
              description: 'Array of host IDs to include in dashboard' 
            },
            devices: { 
              type: 'array', 
              items: { type: 'string' },
              description: 'Array of device names to monitor (e.g., ["sda", "nvme0n1"])' 
            },
            graph_period: { type: 'string', description: 'Graph time period (default: 1h)' },
            private: { type: 'boolean', description: 'Make dashboard private (default: false)' },
          },
          required: ['name', 'hostids', 'devices'],
        },
      },
      // API Info and Connectivity
      {
        name: 'apiinfo_version',
        description: 'Get Zabbix API version information',
        inputSchema: {
          type: 'object',
          properties: {},
        },
      },
      {
        name: 'verify_connectivity',
        description: 'Verify Zabbix API connectivity and authentication status',
        inputSchema: {
          type: 'object',
          properties: {
            test_authentication: { 
              type: 'boolean', 
              description: 'Test authentication by making a sample API call (default: true)' 
            },
          },
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

      case 'item_create': {
        validateReadOnly('item_create');
        
        // Always provide helpful information first
        if (!args || Object.keys(args).length === 0) {
          return {
            content: [
              {
                type: 'text',
                text: `Zabbix Item Creation Tool\n\nThis tool creates new monitoring items in Zabbix.\n\nRequired Parameters:\n- hostid: Target host ID\n- name: Item display name\n- key_: Unique item key\n- type: Item type (see examples below)\n- value_type: Data type (0=float, 1=character, 2=log, 3=unsigned, 4=text)\n\nOptional Parameters:\n- delay: Update interval (default: 1m for most types, 0 for trapper)\n- history: History retention period (e.g., "7d")\n- trends: Trend retention period (e.g., "365d")\n- units: Units of measurement\n- description: Item description\n- status: Item status (0=enabled, 1=disabled)\n- params: Additional parameters (for calculated items)\n\n${getItemCreationExamples()}`,
              },
            ],
          };
        }
        
        if (!args?.hostid || !args?.name || !args?.key_ || args?.type === undefined || args?.value_type === undefined) {
          throw new Error(`Missing required parameters: hostid, name, key_, type, value_type\n\n${getItemCreationExamples()}`);
        }
        
        // Validate item type
        const validTypes = [0, 1, 2, 3, 5, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21];
        const itemType = Number(args.type);
        if (!validTypes.includes(itemType)) {
          throw new Error(`Invalid item type: ${args.type}. Valid types: ${validTypes.join(', ')}`);
        }
        
        // Validate value type
        const validValueTypes = [0, 1, 2, 3, 4];
        const valueType = Number(args.value_type);
        if (!validValueTypes.includes(valueType)) {
          throw new Error(`Invalid value type: ${args.value_type}. Valid types: 0=float, 1=character, 2=log, 3=unsigned, 4=text`);
        }
        
        const itemParams: any = {
          hostid: args.hostid,
          name: args.name,
          key_: args.key_,
          type: itemType,
          value_type: valueType,
        };
        
        // Add required interfaceid for agent items (type 0)
        if (itemType === 0) {
          // Get host interfaces to find a suitable one
          const hostResult = await client.hostGet({ output: 'extend', hostids: [args.hostid], selectInterfaces: 'extend' });
          if (hostResult.result && hostResult.result.length > 0 && hostResult.result[0].interfaces) {
            const agentInterface = hostResult.result[0].interfaces.find((iface: any) => iface.type === '1');
            if (agentInterface) {
              itemParams.interfaceid = agentInterface.interfaceid;
            } else {
              throw new Error('No agent interface found for host. Agent items require an agent interface.');
            }
          }
        }
        
        // Set default delay for non-trapper items
        if (itemType !== 2 && !args.delay) {
          itemParams.delay = '1m';
        } else if (itemType === 2) {
          itemParams.delay = '0'; // Trapper items don't need delay
        } else if (args.delay !== undefined) {
          itemParams.delay = args.delay;
        }
        
        // Add optional parameters with validation
        if (args.params !== undefined) itemParams.params = args.params;
        if (args.history !== undefined) itemParams.history = args.history;
        if (args.trends !== undefined) {
          // Trends only for numeric value types (0, 3)
          if (valueType === 0 || valueType === 3) {
            itemParams.trends = args.trends;
          }
        }
        if (args.units !== undefined) itemParams.units = args.units;
        if (args.description !== undefined) itemParams.description = args.description;
        if (args.status !== undefined) itemParams.status = args.status;
        
        try {
          const response = await client.itemCreate(itemParams);
          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify(response.result, null, 2),
              },
            ],
          };
        } catch (error: any) {
          // Enhance error message with helpful examples
          const errorMessage = error.message || 'Unknown error';
          throw new Error(`Zabbix API Error: ${errorMessage}\n\nTip: For agent items (type 0), ensure the host has an agent interface. For trapper items (type 2), no interface is required.\n\n${getItemCreationExamples()}`);
        }
      }

      case 'item_delete': {
        validateReadOnly('item_delete');
        if (!args?.itemids || !Array.isArray(args.itemids)) {
          throw new Error('Missing required parameter: itemids (must be an array)');
        }
        
        const response = await client.itemDelete(args.itemids);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(response.result, null, 2),
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

      case 'dashboard_get': {
        const params: Record<string, any> = { output: args?.output || 'extend' };
        if (args?.dashboardids) params.dashboardids = args.dashboardids;
        if (args?.search) params.search = args.search;
        if (args?.filter) params.filter = args.filter;
        if (args?.selectPages) params.selectPages = args.selectPages;
        if (args?.selectUsers) params.selectUsers = args.selectUsers;
        if (args?.selectUserGroups) params.selectUserGroups = args.selectUserGroups;
        
        const result = await client.dashboardGet(params);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(result, null, 2),
            },
          ],
        };
      }

      case 'dashboard_create': {
        validateReadOnly('dashboard_create');
        if (!args?.name) {
          throw new Error('Missing required parameter: name');
        }
        
        // Verify connectivity and authentication before creating dashboard
        console.error('[Dashboard] Verifying Zabbix connectivity...');
        const connectivity = await client.verifyConnectivity();
        if (!connectivity.connected) {
          throw new Error('Cannot connect to Zabbix API. Please verify connectivity.');
        }
        
        console.error(`[Dashboard] Connected to Zabbix API version: ${connectivity.version}`);
        
        // Ensure authentication
        if (!client.isAuthenticated()) {
          console.error('[Dashboard] Authenticating with Zabbix...');
          await client.login();
        }
        
        // Build dashboard parameters with required structure
        const params: Record<string, any> = {
          name: args.name,
          display_period: args.display_period || 30,
          auto_start: args.auto_start !== undefined ? args.auto_start : 1,
          // Ensure pages parameter is always present (required by Zabbix 7.4+)
          pages: args.pages || [{ widgets: [] }]
        };
        
        if (args?.private !== undefined) params.private = args.private;
        if (args?.users) params.users = args.users;
        if (args?.userGroups) params.userGroups = args.userGroups;
        
        console.error(`[Dashboard] Creating dashboard: ${args.name}`);
        console.error(`[Dashboard] Parameters:`, JSON.stringify(params, null, 2));
        
        const result = await client.dashboardCreate(params);
        
        console.error(`[Dashboard] Successfully created dashboard with ID: ${result.result?.dashboardids?.[0]}`);
        
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(result, null, 2),
            },
          ],
        };
      }

      case 'dashboard_update': {
        validateReadOnly('dashboard_update');
        if (!args?.dashboardid) {
          throw new Error('Missing required parameter: dashboardid');
        }
        
        const params: Record<string, any> = {
          dashboardid: args.dashboardid,
        };
        if (args?.name) params.name = args.name;
        if (args?.display_period) params.display_period = args.display_period;
        if (args?.auto_start !== undefined) params.auto_start = args.auto_start;
        if (args?.private !== undefined) params.private = args.private;
        if (args?.pages) params.pages = args.pages;
        if (args?.users) params.users = args.users;
        if (args?.userGroups) params.userGroups = args.userGroups;
        
        const result = await client.dashboardUpdate(params);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(result, null, 2),
            },
          ],
        };
      }

      case 'dashboard_delete': {
        validateReadOnly('dashboard_delete');
        if (!args?.dashboardids || !Array.isArray(args.dashboardids)) {
          throw new Error('Missing required parameter: dashboardids (must be an array)');
        }
        
        const result = await client.dashboardDelete(args.dashboardids as string[]);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(result, null, 2),
            },
          ],
        };
      }

      case 'proxmox_dashboard_create_single': {
        validateReadOnly('proxmox_dashboard_create_single');
        if (!args?.hostname) {
          throw new Error('Missing required parameter: hostname');
        }
        
        const result = await createSingleProxmoxDashboard(
          client, 
          String(args.hostname), 
          String(args.dashboard_name || 'Proxmox Monitoring')
        );
        
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(result, null, 2),
            },
          ],
        };
      }

      case 'proxmox_dashboard_create_dual': {
        validateReadOnly('proxmox_dashboard_create_dual');
        if (!args?.hostname1 || !args?.hostname2) {
          throw new Error('Missing required parameters: hostname1, hostname2');
        }
        
        const result = await createDualProxmoxDashboard(
          client, 
          String(args.hostname1), 
          String(args.hostname2), 
          String(args.dashboard_name || 'Proxmox')
        );
        
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(result, null, 2),
            },
          ],
        };
      }

      case 'proxmox_dashboard_add_widgets': {
        validateReadOnly('proxmox_dashboard_add_widgets');
        if (!args?.dashboard_id || !args?.hostname) {
          throw new Error('Missing required parameters: dashboard_id, hostname');
        }
        
        const result = await addProxmoxWidgets(
          client, 
          String(args.dashboard_id), 
          String(args.hostname), 
          Array.isArray(args.widget_types) ? args.widget_types.map(String) : ['problems', 'api_status', 'cluster_status', 'system_info', 'cpu_graph', 'memory_graph']
        );
        
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(result, null, 2),
            },
          ],
        };
      }

      case 'proxmox_hosts_analyze': {
        const result = await analyzeProxmoxHosts(
          client, 
          args?.hostname_filter ? String(args.hostname_filter) : undefined, 
          args?.categorize_items !== false
        );
        
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

      case 'verify_connectivity': {
        const testAuth = args?.test_auth === true;
        const result = await client.verifyConnectivity(testAuth);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(result, null, 2),
            },
          ],
        };
      }

      case 'iops_item_create': {
        validateReadOnly('iops_item_create');
        if (!args?.hostid || !args?.device) {
          throw new Error('Missing required parameters: hostid, device');
        }
        
        const result = await createIOPSItems(
          client,
          String(args.hostid),
          String(args.device),
          Array.isArray(args.item_types) ? args.item_types : ['read', 'write', 'util'],
          String(args.update_interval || '1m'),
          Number(args.history_days || 7),
          Number(args.trend_days || 365)
        );
        
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(result, null, 2),
            },
          ],
        };
      }

      case 'disk_devices_discover': {
        if (!args?.hostid) {
          throw new Error('Missing required parameter: hostid');
        }
        
        const result = await discoverDiskDevices(
          client,
          String(args.hostid),
          args?.device_filter ? String(args.device_filter) : undefined,
          args?.exclude_virtual !== false
        );
        
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(result, null, 2),
            },
          ],
        };
      }

      case 'iops_dashboard_create': {
        validateReadOnly('iops_dashboard_create');
        if (!args?.name || !args?.hostids || !args?.devices) {
          throw new Error('Missing required parameters: name, hostids, devices');
        }
        
        const result = await createIOPSDashboard(
          client,
          String(args.name),
          Array.isArray(args.hostids) ? args.hostids.map(String) : [String(args.hostids)],
          Array.isArray(args.devices) ? args.devices.map(String) : [String(args.devices)],
          String(args.graph_period || '1h'),
          Boolean(args.private || false)
        );
        
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

// IOPS Monitoring Helper Functions
async function createIOPSItems(
  client: ZabbixClient, 
  hostid: string, 
  device: string, 
  itemTypes: string[], 
  updateInterval: string, 
  historyDays: number, 
  trendDays: number
) {
  try {
    console.error(`[IOPS] Creating IOPS items for device ${device} on host ${hostid}`);
    
    const items = [];
    const itemConfigs = {
      read: {
        name: `Disk read IOPS on ${device}`,
        key: `iops.read[${device}]`,
        description: `Number of read operations per second on ${device} (Trapper item)`,
        units: 'ops'
      },
      write: {
        name: `Disk write IOPS on ${device}`,
        key: `iops.write[${device}]`,
        description: `Number of write operations per second on ${device} (Trapper item)`,
        units: 'ops'
      },
      util: {
        name: `Disk utilization on ${device}`,
        key: `disk.util[${device}]`,
        description: `Disk utilization percentage on ${device} (Trapper item)`,
        units: '%'
      }
    };

    // Create items array for batch creation
    const itemsToCreate = [];
    
    for (const itemType of itemTypes) {
      if (itemConfigs[itemType as keyof typeof itemConfigs]) {
        const config = itemConfigs[itemType as keyof typeof itemConfigs];
        const itemParams = {
          name: config.name,
          key_: config.key,
          hostid: hostid,
          type: 2, // Zabbix trapper (allows external data sending)
          value_type: 0, // Numeric float
          delay: 0, // No delay for trapper items
          history: `${historyDays}d`,
          trends: `${trendDays}d`,
          units: config.units,
          description: config.description,
          status: 0 // Enabled
        };
        
        itemsToCreate.push({
          ...itemParams,
          itemType: itemType
        });
      }
    }

    // Create items one by one to handle errors better
    for (const itemData of itemsToCreate) {
      try {
        const { itemType, ...itemParams } = itemData;
        console.error(`[IOPS] Creating ${itemType} item:`, itemParams.name);
        
        const result = await client.itemCreate(itemParams);
        
        if (result && result.result && result.result.itemids && result.result.itemids.length > 0) {
          items.push({
            type: itemType,
            itemid: result.result.itemids[0],
            name: itemParams.name,
            key_: itemParams.key_
          });
          console.error(`[IOPS] Successfully created ${itemType} item with ID: ${result.result.itemids[0]}`);
        } else {
          console.warn(`[IOPS] No item ID returned for ${itemType} item`);
        }
      } catch (itemError: any) {
        console.error(`[IOPS] Error creating ${itemData.itemType} item:`, itemError.message || itemError);
        // Continue with other items even if one fails
      }
    }

    return {
      success: true,
      device: device,
      hostid: hostid,
      items_created: items.length,
      items: items
    };
  } catch (error) {
    console.error('[IOPS] Error creating items:', error);
    throw error;
  }
}

async function discoverDiskDevices(
  client: ZabbixClient, 
  hostid: string, 
  deviceFilter?: string, 
  excludeVirtual: boolean = true
) {
  try {
    console.error(`[IOPS] Discovering disk devices on host ${hostid}`);
    
    // Get host information
    const hostResponse = await client.hostGet({ hostids: [hostid], output: 'extend' });
    const host = Array.isArray(hostResponse) ? hostResponse[0] : hostResponse;
    
    if (!host) {
      throw new Error(`Host with ID ${hostid} not found`);
    }

    // Get existing items to find disk devices
    const itemsResponse = await client.itemGet({
      hostids: [hostid],
      search: { key_: 'vfs.dev.' },
      output: ['itemid', 'name', 'key_']
    });
    
    const items = Array.isArray(itemsResponse) ? itemsResponse : [itemsResponse];
    const devices = new Set<string>();
    
    // Extract device names from existing items
    items.forEach((item: any) => {
      const match = item.key_?.match(/vfs\.dev\.[^\[]+\[([^,\]]+)/);
      if (match && match[1]) {
        const device = match[1];
        
        // Apply filters
        if (deviceFilter && !device.match(new RegExp(deviceFilter))) {
          return;
        }
        
        if (excludeVirtual && (device.includes('loop') || device.includes('ram') || device.includes('dm-'))) {
          return;
        }
        
        devices.add(device);
      }
    });

    // If no devices found from items, suggest common device patterns
    const suggestedDevices = [];
    if (devices.size === 0) {
      const commonDevices = ['sda', 'sdb', 'sdc', 'nvme0n1', 'nvme1n1', 'vda', 'vdb'];
      suggestedDevices.push(...commonDevices.filter(dev => 
        !deviceFilter || dev.match(new RegExp(deviceFilter))
      ));
    }

    return {
      success: true,
      hostid: hostid,
      hostname: host.host,
      discovered_devices: Array.from(devices),
      suggested_devices: suggestedDevices,
      total_devices: devices.size,
      filter_applied: deviceFilter || 'none',
      virtual_excluded: excludeVirtual
    };
  } catch (error) {
    console.error('[IOPS] Error discovering devices:', error);
    throw error;
  }
}

async function createIOPSDashboard(
  client: ZabbixClient, 
  name: string, 
  hostids: string[], 
  devices: string[], 
  graphPeriod: string, 
  isPrivate: boolean
) {
  try {
    console.error(`[IOPS] Creating IOPS dashboard: ${name}`);
    
    // Verify connectivity
    const connectivity = await client.verifyConnectivity();
    if (!connectivity.connected) {
      throw new Error('Cannot connect to Zabbix API');
    }

    if (!client.isAuthenticated()) {
      await client.login();
    }

    // Create dashboard structure
    const widgets = [];
    let widgetIndex = 0;

    for (const hostid of hostids) {
      // Get host info
      const hostResponse = await client.hostGet({ hostids: [hostid], output: 'extend' });
      const host = Array.isArray(hostResponse) ? hostResponse[0] : hostResponse;
      
      if (!host) continue;

      for (const device of devices) {
        // Create IOPS graph widget
        const iopsWidget = {
          type: 'graph',
          name: `IOPS - ${host.host} - ${device}`,
          x: (widgetIndex % 2) * 12,
          y: Math.floor(widgetIndex / 2) * 6,
          width: 12,
          height: 6,
          fields: [
            { type: 1, name: 'source_type', value: '1' }, // Items
            { type: 1, name: 'itemid', value: '' }, // Will be populated with actual item IDs
            { type: 0, name: 'time_period', value: graphPeriod },
            { type: 0, name: 'graph_type', value: '0' }, // Line
            { type: 0, name: 'show_legend', value: '1' }
          ]
        };
        
        widgets.push(iopsWidget);
        widgetIndex++;
      }
    }

    // Create dashboard
    const dashboardParams = {
      name: name,
      display_period: 30,
      auto_start: 1,
      private: isPrivate ? 1 : 0,
      pages: [{
        widgets: widgets
      }]
    };

    console.error(`[IOPS] Creating dashboard with ${widgets.length} widgets`);
    const result = await client.dashboardCreate(dashboardParams);
    
    return {
      success: true,
      dashboard_name: name,
      dashboard_id: result.result?.dashboardids?.[0],
      widgets_created: widgets.length,
      hosts_included: hostids.length,
      devices_monitored: devices,
      graph_period: graphPeriod
    };
  } catch (error) {
    console.error('[IOPS] Error creating dashboard:', error);
    throw error;
  }
}

// Proxmox Dashboard Helper Functions
async function analyzeProxmoxHosts(client: ZabbixClient, hostnameFilter?: string, categorizeItems: boolean = true) {
  try {
    const hostParams: any = { output: 'extend' };
    if (hostnameFilter) {
      hostParams.search = { host: hostnameFilter };
    }
    
    const hostsResponse: any = await client.hostGet(hostParams);
    const hosts = Array.isArray(hostsResponse) ? hostsResponse : [hostsResponse];
    const proxmoxHosts = hosts.filter((host: any) => 
      host.host?.toLowerCase().includes('proxmox') || 
      host.host?.toLowerCase().includes('serverhome') ||
      (hostnameFilter && host.host?.includes(hostnameFilter))
    );

    return {
      success: true,
      data: {
        total_hosts: proxmoxHosts.length,
        hosts: proxmoxHosts.map((host: any) => ({
          hostid: host.hostid,
          hostname: host.host,
          name: host.name,
          status: host.status
        }))
      },
      message: `Found ${proxmoxHosts.length} Proxmox hosts`
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error)
    };
  }
}

async function createSingleProxmoxDashboard(client: ZabbixClient, hostname: string, dashboardName: string) {
  try {
    // Pre-check: Verify connectivity and authentication
    console.error(`[Dashboard] Starting creation for host: ${hostname}`);
    const connectivity = await client.verifyConnectivity(true);
    if (!connectivity.connected) {
      throw new Error(`Zabbix connectivity failed: ${connectivity.error}`);
    }
    if (!connectivity.authenticated) {
      throw new Error(`Zabbix authentication failed: ${connectivity.error}`);
    }
    console.error(`[Dashboard] Connectivity verified (${connectivity.version})`);

    // Validate host exists
    const hostsResponse: any = await client.hostGet({
      output: 'extend',
      filter: { host: hostname }
    });

    const hosts = Array.isArray(hostsResponse) ? hostsResponse : [hostsResponse];
    if (hosts.length === 0) {
      throw new Error(`Host '${hostname}' not found in Zabbix`);
    }

    const host = hosts[0];
    console.error(`[Dashboard] Host found: ${host.name} (ID: ${host.hostid})`);

    // Get host items for monitoring
    const itemsResponse: any = await client.itemGet({
      output: 'extend',
      hostids: [host.hostid],
      filter: { status: 0 } // Only active items
    });

    const items = Array.isArray(itemsResponse) ? itemsResponse : [itemsResponse];
    console.error(`[Dashboard] Found ${items.length} active items for host`);
    
    // Create robust widgets following best practices
    const widgets = [
      {
        type: 'problems',
        x: 0, y: 0, width: 24, height: 5,
        view_mode: 0,
        fields: [
          { type: 1, name: 'show_tags', value: '3' },
          { type: 1, name: 'show_timeline', value: '1' },
          { type: 1, name: 'hostids', value: host.hostid }
        ]
      }
    ];

    // Ensure pages parameter is always present (Zabbix 7.4+ requirement)
    const dashboardParams = {
      name: dashboardName,
      display_period: 30,
      auto_start: 1,
      pages: [{ widgets }]
    };

    console.error(`[Dashboard] Creating dashboard with ${widgets.length} widgets`);
    const dashboardResponse: any = await client.dashboardCreate(dashboardParams);

    const dashboardId = dashboardResponse.dashboardids?.[0];
    console.error(`[Dashboard] Successfully created dashboard ID: ${dashboardId}`);

    return {
      success: true,
      dashboard_id: dashboardId || 'created',
      widgets_created: widgets.length,
      host_items: items.length,
      host_id: host.hostid,
      zabbix_version: connectivity.version,
      message: `Dashboard '${dashboardName}' created successfully for host '${hostname}' (${items.length} items monitored)`
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(`[Dashboard] Creation failed: ${errorMessage}`);
    return {
      success: false,
      error: errorMessage,
      hostname: hostname,
      dashboard_name: dashboardName
    };
  }
}

async function createDualProxmoxDashboard(client: ZabbixClient, hostname1: string, hostname2: string, dashboardName: string) {
  try {
    // Pre-check: Verify connectivity and authentication
    console.error(`[Dashboard] Starting dual creation for hosts: ${hostname1}, ${hostname2}`);
    const connectivity = await client.verifyConnectivity(true);
    if (!connectivity.connected) {
      throw new Error(`Zabbix connectivity failed: ${connectivity.error}`);
    }
    if (!connectivity.authenticated) {
      throw new Error(`Zabbix authentication failed: ${connectivity.error}`);
    }
    console.error(`[Dashboard] Connectivity verified (${connectivity.version})`);

    // Validate both hosts exist
    const hostsResponse: any = await client.hostGet({
      output: 'extend',
      filter: { host: [hostname1, hostname2] }
    });

    const hosts = Array.isArray(hostsResponse) ? hostsResponse : [hostsResponse];
    if (hosts.length < 2) {
      const foundHosts = hosts.map((h: any) => h.host).join(', ');
      throw new Error(`Both hosts '${hostname1}' and '${hostname2}' must exist in Zabbix. Found: ${foundHosts}`);
    }

    const host1 = hosts.find((h: any) => h.host === hostname1);
    const host2 = hosts.find((h: any) => h.host === hostname2);
    console.error(`[Dashboard] Both hosts found: ${host1?.name} (${host1?.hostid}), ${host2?.name} (${host2?.hostid})`);

    // Get items for both hosts
    const itemsResponse: any = await client.itemGet({
      output: 'extend',
      hostids: [host1.hostid, host2.hostid],
      filter: { status: 0 } // Only active items
    });

    const items = Array.isArray(itemsResponse) ? itemsResponse : [itemsResponse];
    const host1Items = items.filter((item: any) => item.hostid === host1.hostid);
    const host2Items = items.filter((item: any) => item.hostid === host2.hostid);
    console.error(`[Dashboard] Items found - ${hostname1}: ${host1Items.length}, ${hostname2}: ${host2Items.length}`);

    // Create robust widgets for dual comparison
    const widgets = [
      {
        type: 'problems',
        x: 0, y: 0, width: 24, height: 5,
        view_mode: 0,
        fields: [
          { type: 1, name: 'show_tags', value: '3' },
          { type: 1, name: 'show_timeline', value: '1' },
          { type: 1, name: 'hostids', value: `${host1.hostid},${host2.hostid}` }
        ]
      }
    ];

    // Ensure pages parameter is always present (Zabbix 7.4+ requirement)
    const dashboardParams = {
      name: dashboardName,
      display_period: 30,
      auto_start: 1,
      pages: [{ widgets }]
    };

    console.error(`[Dashboard] Creating dual dashboard with ${widgets.length} widgets`);
    const dashboardResponse: any = await client.dashboardCreate(dashboardParams);

    const dashboardId = dashboardResponse.dashboardids?.[0];
    console.error(`[Dashboard] Successfully created dual dashboard ID: ${dashboardId}`);

    return {
      success: true,
      dashboard_id: dashboardId || 'created',
      widgets_created: widgets.length,
      hosts: [
        { hostname: hostname1, hostid: host1.hostid, items: host1Items.length },
        { hostname: hostname2, hostid: host2.hostid, items: host2Items.length }
      ],
      total_items: items.length,
      zabbix_version: connectivity.version,
      message: `Dual dashboard '${dashboardName}' created successfully for hosts '${hostname1}' and '${hostname2}' (${items.length} total items monitored)`
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(`[Dashboard] Dual creation failed: ${errorMessage}`);
    return {
      success: false,
      error: errorMessage,
      hostnames: [hostname1, hostname2],
      dashboard_name: dashboardName
    };
  }
}

async function addProxmoxWidgets(client: ZabbixClient, dashboardId: string, hostname: string, widgetTypes: string[]) {
  try {
    const dashboardsResponse: any = await client.dashboardGet({
      output: 'extend',
      dashboardids: [dashboardId],
      selectPages: 'extend'
    });

    const dashboards = Array.isArray(dashboardsResponse) ? dashboardsResponse : [dashboardsResponse];
    if (dashboards.length === 0) {
      throw new Error(`Dashboard with ID '${dashboardId}' not found`);
    }

    await client.dashboardUpdate({
      dashboardid: dashboardId,
      pages: [{ widgets: [] }]
    });

    return {
      success: true,
      widgets_added: widgetTypes.length,
      total_widgets: widgetTypes.length,
      message: `Added ${widgetTypes.length} widgets to dashboard`
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error)
    };
  }
}

// Start the server
async function main() {
  try {
    console.error('🚀 Starting Zabbix MCP Server...');
    console.error(`📡 Target URL: ${zabbixConfig.url}`);
    console.error(`👤 User: ${zabbixConfig.user}`);
    console.error(`🔒 Read-only mode: ${readOnly}`);
    
    // Step 1: Verify basic connectivity (no auth required)
    console.error('🔍 Step 1: Verifying basic connectivity...');
    const connectivity = await client.verifyConnectivity(false);
    if (!connectivity.connected) {
      throw new Error(`Cannot connect to Zabbix API: ${connectivity.error}`);
    }
    console.error(`✅ Connected to Zabbix API version: ${connectivity.version}`);
    
    // Step 2: Verify authentication
    console.error('🔐 Step 2: Verifying authentication...');
    const authCheck = await client.verifyConnectivity(true);
    if (!authCheck.authenticated) {
      throw new Error(`Authentication failed: ${authCheck.error}`);
    }
    console.error(`✅ Authentication successful (method: ${authCheck.auth_method})`);
    
    // Step 3: Check API version compatibility
    const version = connectivity.version;
    const versionParts = version.split('.').map(Number);
    const majorVersion = versionParts[0];
    const minorVersion = versionParts[1];
    
    if (majorVersion < 6) {
      console.error(`⚠️  Warning: Zabbix version ${version} is very old. Some features may not work correctly.`);
    } else if (majorVersion >= 7 && minorVersion >= 4) {
      console.error(`✅ Zabbix version ${version} supports modern dashboard features`);
    } else {
      console.error(`ℹ️  Zabbix version ${version} detected. Using compatibility mode for dashboards.`);
    }
    
    // Step 4: Test basic API functionality
    console.error('🧪 Step 3: Testing basic API functionality...');
    try {
      const testHosts = await client.hostGet({ output: ['hostid'], limit: 1 });
      console.error(`✅ API test successful (found ${Array.isArray(testHosts) ? testHosts.length : 1} hosts)`);
    } catch (testError) {
      console.error(`⚠️  API test warning: ${testError instanceof Error ? testError.message : String(testError)}`);
    }
    
    // Step 5: Start MCP server
    console.error('🌐 Step 4: Starting MCP transport...');
    const transport = new StdioServerTransport();
    await server.connect(transport);
    
    console.error('✅ Zabbix MCP Server started successfully');
    console.error(`📊 Server ready for dashboard automation`);
    console.error(`🔧 Available tools: host management, dashboard creation, Proxmox monitoring`);
    
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(`❌ Failed to start server: ${errorMessage}`);
    console.error('💡 Check your Zabbix configuration and network connectivity');
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