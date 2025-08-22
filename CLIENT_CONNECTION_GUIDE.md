# Guía de Conexión de Clientes - Zabbix MCP Server

## Opciones de Cliente Disponibles

### 1. 🧪 Testing Rápido con curl
```bash
# Iniciar servidor
npm run dev:stream

# Ejecutar script de testing automático
./test-client.sh
```

### 2. 📝 Cliente JavaScript/Node.js
```bash
cd examples
npm install
node client-example.js
```

**Características:**
- ✅ Conexión SSE automática
- ✅ Manejo de sessionId
- ✅ Llamadas a herramientas Zabbix
- ✅ Cleanup automático

### 3. 🔧 Cliente con MCP SDK TypeScript
```bash
cd examples
npm install @modelcontextprotocol/sdk
npx tsx mcp-sdk-client.ts
```

**Características:**
- ✅ SDK oficial de MCP
- ✅ Tipado TypeScript completo
- ✅ Manejo automático de protocolo
- ✅ Soporte para todas las operaciones MCP

### 4. 🌐 Cliente Web (Browser)
```bash
# Abrir examples/web-client.html en navegador
open examples/web-client.html
```

**Características:**
- ✅ Interface gráfica intuitiva
- ✅ Log en tiempo real
- ✅ Conexión SSE del navegador
- ✅ Testing interactivo

## Flujo de Conexión SSE

### Paso 1: Establecer Conexión
```javascript
const eventSource = new EventSource('http://localhost:3001/sse');

eventSource.onmessage = (event) => {
  const data = JSON.parse(event.data);
  if (data.type === 'session') {
    sessionId = data.sessionId; // Guardar para uso posterior
  }
};
```

### Paso 2: Enviar Mensajes
```javascript
const message = {
  jsonrpc: '2.0',
  method: 'tools/list',
  id: 1
};

await fetch(`http://localhost:3001/message?sessionId=${sessionId}`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(message)
});
```

### Paso 3: Recibir Respuestas
Las respuestas llegan via SSE en el mismo EventSource:
```javascript
eventSource.onmessage = (event) => {
  const response = JSON.parse(event.data);
  console.log('Respuesta recibida:', response);
};
```

## Herramientas Disponibles

### `zabbix_get_hosts`
Obtiene lista de hosts de Zabbix:
```json
{
  "jsonrpc": "2.0",
  "method": "tools/call",
  "params": {
    "name": "zabbix_get_hosts",
    "arguments": {
      "limit": 10,
      "groupids": ["1", "2"]
    }
  },
  "id": 1
}
```

### `zabbix_get_items`
Obtiene items de monitoreo:
```json
{
  "jsonrpc": "2.0",
  "method": "tools/call",
  "params": {
    "name": "zabbix_get_items",
    "arguments": {
      "limit": 20,
      "hostids": ["10001", "10002"]
    }
  },
  "id": 2
}
```

## Configuración de Variables de Entorno

Antes de conectar, asegúrate de que el servidor tenga configurado:

```bash
# Variables requeridas para Zabbix
export ZABBIX_URL="https://your-zabbix-server.com"
export ZABBIX_USER="your-username"
export ZABBIX_PASSWORD="your-password"

# Variables opcionales
export READ_ONLY="true"          # Modo solo lectura
export PORT="3001"              # Puerto del servidor
export DEBUG="zabbix-mcp-server" # Logging detallado
```

## Ejemplos de Respuestas

### Lista de Herramientas
```json
{
  "jsonrpc": "2.0",
  "result": {
    "tools": [
      {
        "name": "zabbix_get_hosts",
        "description": "Get hosts from Zabbix",
        "inputSchema": {
          "type": "object",
          "properties": {
            "limit": {"type": "number"},
            "groupids": {"type": "array"}
          }
        }
      }
    ]
  },
  "id": 1
}
```

### Respuesta de Hosts
```json
{
  "jsonrpc": "2.0",
  "result": {
    "content": [{
      "type": "text",
      "text": "[{\"hostid\":\"10001\",\"name\":\"Server-01\"},{\"hostid\":\"10002\",\"name\":\"Server-02\"}]"
    }]
  },
  "id": 2
}
```

## Troubleshooting

### Error: Session ID requerido
```bash
# Verificar que estás enviando sessionId
curl -X POST "http://localhost:3001/message?sessionId=YOUR_SESSION_ID"
# O usar header
curl -H "X-Session-ID: YOUR_SESSION_ID"
```

### Error: Sesión no encontrada
```bash
# Verificar sesiones activas
curl http://localhost:3001/health

# Reconectar si es necesario
curl -N -H "Accept: text/event-stream" http://localhost:3001/sse
```

### Error: Zabbix no conectado
```bash
# Verificar configuración de Zabbix
echo $ZABBIX_URL
echo $ZABBIX_USER

# Verificar estado del servidor
curl http://localhost:3001/health
```

## Mejores Prácticas

1. **Manejo de Sesiones:**
   - Siempre captura el sessionId del primer mensaje SSE
   - Incluye sessionId en todas las requests posteriores
   - Termina sesiones explícitamente con DELETE

2. **Manejo de Errores:**
   - Implementa reconexión automática en caso de fallo
   - Maneja timeouts de sesión (30 minutos)
   - Log errores para debugging

3. **Performance:**
   - Reutiliza conexiones SSE
   - Implementa batching de requests si es necesario
   - Usa límites apropiados en consultas

4. **Seguridad:**
   - No expongas credenciales de Zabbix en el frontend
   - Usa HTTPS en producción
   - Implementa autenticación adicional si es necesario

## Próximos Pasos

1. Prueba la conexión básica con curl o el script de testing
2. Implementa tu cliente usando el ejemplo más apropiado
3. Personaliza las consultas según tus necesidades
4. Implementa manejo de errores robusto
5. Añade autenticación si es necesario para producción

Para más detalles, consulta la documentación en `CLAUDE.md` y los ejemplos en la carpeta `examples/`.