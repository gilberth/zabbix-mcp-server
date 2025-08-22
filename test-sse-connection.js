// Simple test para validar la conexión SSE
import { EventSource } from 'undici';

const serverUrl = 'http://localhost:3001';

console.log('🔌 Iniciando test de conexión SSE...');

// Crear conexión SSE
const eventSource = new EventSource(`${serverUrl}/sse`);

let sessionId = null;

eventSource.onopen = () => {
  console.log('✅ Conexión SSE establecida');
};

eventSource.onmessage = async (event) => {
  try {
    const data = JSON.parse(event.data);
    
    if (data.type === 'session') {
      sessionId = data.sessionId;
      console.log(`🆔 Session ID recibido: ${sessionId}`);
      
      // Probar llamada a tools/list
      await testToolsList();
    } else {
      console.log(`📨 Respuesta: ${JSON.stringify(data, null, 2)}`);
    }
  } catch (error) {
    console.log(`❌ Error parseando SSE: ${error.message}`);
  }
};

eventSource.onerror = (error) => {
  console.log(`❌ Error SSE: ${error}`);
  process.exit(1);
};

async function testToolsList() {
  if (!sessionId) {
    console.log('❌ No hay sessionId disponible');
    return;
  }
  
  const message = {
    jsonrpc: '2.0',
    method: 'tools/list',
    id: 1
  };
  
  console.log(`📤 Enviando tools/list con sessionId: ${sessionId}`);
  
  try {
    const response = await fetch(`${serverUrl}/message?sessionId=${sessionId}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(message)
    });
    
    console.log(`📊 Response status: ${response.status}`);
    
    if (!response.ok) {
      const errorText = await response.text();
      console.log(`❌ Error: ${errorText}`);
    } else {
      const responseText = await response.text();
      console.log(`✅ Respuesta: ${responseText}`);
    }
    
  } catch (error) {
    console.log(`❌ Error enviando: ${error.message}`);
  }
  
  // Cerrar después de la prueba
  setTimeout(() => {
    eventSource.close();
    console.log('👋 Test completado');
    process.exit(0);
  }, 2000);
}

// Cleanup
process.on('SIGINT', () => {
  eventSource.close();
  process.exit(0);
});