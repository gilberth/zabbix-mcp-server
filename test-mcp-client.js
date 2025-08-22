import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { SSEClientTransport } from '@modelcontextprotocol/sdk/client/sse.js';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const EventSource = require('eventsource');

// Polyfill para Node.js
global.EventSource = EventSource;

// Test de cliente MCP estándar para validar SSE
async function testMCPSSE() {
  console.log('🔌 Iniciando cliente MCP con SSE...');
  
  try {
    // Crear transport SSE
    const transport = new SSEClientTransport(new URL('http://localhost:3001/sse'));
    
    // Crear cliente MCP
    const client = new Client({
      name: "test-mcp-client",
      version: "1.0.0"
    }, {
      capabilities: {}
    });
    
    console.log('📡 Conectando al servidor...');
    
    // Conectar
    await client.connect(transport);
    
    console.log('✅ Conexión establecida');
    
    // Probar tools/list
    console.log('📤 Solicitando lista de herramientas...');
    const tools = await client.request({
      method: 'tools/list'
    }, {});
    
    console.log('🛠️ Herramientas disponibles:', tools.tools.length);
    tools.tools.forEach(tool => {
      console.log(`  - ${tool.name}: ${tool.description}`);
    });
    
    // Probar tools/call
    console.log('📤 Llamando a host_get...');
    const hostResult = await client.request({
      method: 'tools/call',
      params: {
        name: 'host_get',
        arguments: {
          output: 'extend',
          limit: 2
        }
      }
    }, {});
    
    console.log('🖥️ Resultado host_get:', hostResult);
    
    // Cerrar conexión
    await client.close();
    console.log('👋 Cliente desconectado exitosamente');
    
  } catch (error) {
    console.error('❌ Error en cliente MCP:', error.message);
    console.error('Stack:', error.stack);
  }
}

// Ejecutar test
testMCPSSE().then(() => {
  console.log('✅ Test completado');
  process.exit(0);
}).catch(error => {
  console.error('💥 Test falló:', error);
  process.exit(1);
});