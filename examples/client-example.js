#!/usr/bin/env node

/**
 * Ejemplo de cliente MCP para servidor SSE de Zabbix
 * Uso: node examples/client-example.js
 */

import { EventSource } from 'eventsource';
import fetch from 'node-fetch';

// Configuración
const SERVER_URL = 'http://localhost:3001';
let sessionId = null;

class ZabbixMCPClient {
  constructor(serverUrl) {
    this.serverUrl = serverUrl;
    this.sessionId = null;
    this.eventSource = null;
    this.requestId = 1;
  }

  async connect() {
    console.log('🔌 Conectando al servidor MCP SSE...');
    
    return new Promise((resolve, reject) => {
      this.eventSource = new EventSource(`${this.serverUrl}/sse`);
      
      this.eventSource.onopen = () => {
        console.log('✅ Conexión SSE establecida');
      };
      
      this.eventSource.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          
          if (data.type === 'session') {
            this.sessionId = data.sessionId;
            console.log(`🆔 Session ID recibido: ${this.sessionId}`);
            resolve();
          } else {
            console.log('📨 Mensaje recibido:', data);
          }
        } catch (error) {
          console.error('❌ Error parseando mensaje SSE:', error);
        }
      };
      
      this.eventSource.onerror = (error) => {
        console.error('❌ Error en conexión SSE:', error);
        reject(error);
      };
      
      // Timeout de conexión
      setTimeout(() => {
        if (!this.sessionId) {
          reject(new Error('Timeout esperando sessionId'));
        }
      }, 5000);
    });
  }

  async sendMessage(method, params = {}) {
    if (!this.sessionId) {
      throw new Error('No hay sesión activa. Conecta primero.');
    }

    const message = {
      jsonrpc: '2.0',
      method: method,
      params: params,
      id: this.requestId++
    };

    console.log(`📤 Enviando: ${method}`);
    
    try {
      const response = await fetch(`${this.serverUrl}/message?sessionId=${this.sessionId}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(message)
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const result = await response.json();
      console.log(`📥 Respuesta de ${method}:`, result);
      return result;
    } catch (error) {
      console.error(`❌ Error enviando ${method}:`, error);
      throw error;
    }
  }

  async listTools() {
    return this.sendMessage('tools/list');
  }

  async callTool(name, arguments = {}) {
    return this.sendMessage('tools/call', {
      name: name,
      arguments: arguments
    });
  }

  async getServerInfo() {
    return this.sendMessage('initialize', {
      protocolVersion: '2024-11-05',
      capabilities: {
        roots: {
          listChanged: false
        }
      },
      clientInfo: {
        name: 'zabbix-test-client',
        version: '1.0.0'
      }
    });
  }

  async disconnect() {
    if (this.sessionId) {
      console.log(`🔌 Desconectando sesión: ${this.sessionId}`);
      
      try {
        await fetch(`${this.serverUrl}/session/${this.sessionId}`, {
          method: 'DELETE'
        });
      } catch (error) {
        console.error('❌ Error desconectando:', error);
      }
    }
    
    if (this.eventSource) {
      this.eventSource.close();
    }
    
    console.log('👋 Desconectado');
  }
}

// Función principal de demostración
async function main() {
  const client = new ZabbixMCPClient(SERVER_URL);
  
  try {
    // Conectar
    await client.connect();
    
    // Verificar servidor
    console.log('\n🔍 Verificando servidor...');
    await client.getServerInfo();
    
    // Listar herramientas disponibles
    console.log('\n🛠️  Listando herramientas...');
    await client.listTools();
    
    // Obtener hosts de Zabbix
    console.log('\n🖥️  Obteniendo hosts de Zabbix...');
    await client.callTool('zabbix_get_hosts', { limit: 3 });
    
    // Obtener items de Zabbix
    console.log('\n📊 Obteniendo items de Zabbix...');
    await client.callTool('zabbix_get_items', { limit: 5 });
    
    // Esperar un momento para ver respuestas
    await new Promise(resolve => setTimeout(resolve, 2000));
    
  } catch (error) {
    console.error('💥 Error en cliente:', error);
  } finally {
    // Desconectar
    await client.disconnect();
  }
}

// Manejo de señales para cleanup
process.on('SIGINT', async () => {
  console.log('\n🛑 Interrupción recibida, cerrando...');
  process.exit(0);
});

// Ejecutar si es llamado directamente
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(console.error);
}

export { ZabbixMCPClient };