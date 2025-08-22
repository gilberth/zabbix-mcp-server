#!/usr/bin/env node

/**
 * Cliente usando el SDK oficial de MCP TypeScript
 * Requiere: npm install @modelcontextprotocol/sdk
 */

import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { SSEClientTransport } from '@modelcontextprotocol/sdk/client/sse.js';

class ZabbixMCPSDKClient {
  private client: Client;
  private transport: SSEClientTransport;
  private serverUrl: string;

  constructor(serverUrl: string = 'http://localhost:3001') {
    this.serverUrl = serverUrl;
    
    this.client = new Client({
      name: 'zabbix-mcp-sdk-client',
      version: '1.0.0'
    }, {
      capabilities: {
        roots: {
          listChanged: false
        }
      }
    });

    this.transport = new SSEClientTransport(new URL(this.serverUrl));
  }

  async connect(): Promise<void> {
    console.log('🔌 Conectando usando MCP SDK...');
    
    try {
      await this.client.connect(this.transport);
      console.log('✅ Conectado exitosamente con MCP SDK');
    } catch (error) {
      console.error('❌ Error conectando:', error);
      throw error;
    }
  }

  async listTools() {
    console.log('\n🛠️  Listando herramientas...');
    try {
      const tools = await this.client.listTools();
      console.log('📋 Herramientas disponibles:');
      tools.tools.forEach(tool => {
        console.log(`  - ${tool.name}: ${tool.description}`);
      });
      return tools;
    } catch (error) {
      console.error('❌ Error listando herramientas:', error);
      throw error;
    }
  }

  async getZabbixHosts(limit: number = 5) {
    console.log(`\n🖥️  Obteniendo ${limit} hosts de Zabbix...`);
    try {
      const result = await this.client.callTool({
        name: 'zabbix_get_hosts',
        arguments: { limit }
      });
      
      console.log('📊 Hosts obtenidos:');
      if (result.content && result.content.length > 0) {
        result.content.forEach(content => {
          if (content.type === 'text') {
            const hosts = JSON.parse(content.text);
            hosts.forEach((host: any) => {
              console.log(`  - ${host.name} (ID: ${host.hostid})`);
            });
          }
        });
      }
      return result;
    } catch (error) {
      console.error('❌ Error obteniendo hosts:', error);
      throw error;
    }
  }

  async getZabbixItems(hostids?: string[], limit: number = 10) {
    console.log(`\n📊 Obteniendo ${limit} items de Zabbix...`);
    try {
      const args: any = { limit };
      if (hostids && hostids.length > 0) {
        args.hostids = hostids;
      }

      const result = await this.client.callTool({
        name: 'zabbix_get_items',
        arguments: args
      });
      
      console.log('📈 Items obtenidos:');
      if (result.content && result.content.length > 0) {
        result.content.forEach(content => {
          if (content.type === 'text') {
            const items = JSON.parse(content.text);
            items.slice(0, 5).forEach((item: any) => {
              console.log(`  - ${item.name} (Key: ${item.key_})`);
            });
            if (items.length > 5) {
              console.log(`  ... y ${items.length - 5} más`);
            }
          }
        });
      }
      return result;
    } catch (error) {
      console.error('❌ Error obteniendo items:', error);
      throw error;
    }
  }

  async disconnect(): Promise<void> {
    console.log('\n🔌 Desconectando...');
    try {
      await this.client.close();
      console.log('👋 Desconectado exitosamente');
    } catch (error) {
      console.error('❌ Error desconectando:', error);
    }
  }
}

// Función de demostración
async function demonstrateSDKClient() {
  const client = new ZabbixMCPSDKClient();

  try {
    // Conectar
    await client.connect();

    // Listar herramientas
    await client.listTools();

    // Obtener hosts
    const hosts = await client.getZabbixHosts(3);

    // Obtener items
    await client.getZabbixItems(undefined, 10);

    // Esperar un momento
    await new Promise(resolve => setTimeout(resolve, 1000));

  } catch (error) {
    console.error('💥 Error en demostración:', error);
  } finally {
    await client.disconnect();
  }
}

// Manejo de señales
process.on('SIGINT', () => {
  console.log('\n🛑 Interrupción recibida, cerrando...');
  process.exit(0);
});

// Ejecutar si es llamado directamente
if (import.meta.url === `file://${process.argv[1]}`) {
  demonstrateSDKClient().catch(console.error);
}

export { ZabbixMCPSDKClient };