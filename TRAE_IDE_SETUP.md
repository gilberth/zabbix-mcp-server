# 🎯 Configuración para Trae AI IDE

## 📋 Configuración MCP para Trae AI

Para configurar el servidor MCP de Zabbix con SSE en **Trae AI**, sigue estos pasos:

### 1. ⚙️ Configuración en Trae AI

Agrega la siguiente configuración en tu archivo de configuración MCP de Trae AI:

```json
{
  "mcpServers": {
    "zabbix-sse": {
      "transport": "sse",
      "url": "http://localhost:3001/sse",
      "env": {
        "ZABBIX_URL": "http://137.184.54.73/api_jsonrpc.php",
        "ZABBIX_USERNAME": "Admin",
        "ZABBIX_PASSWORD": "zabbix"
      }
    }
  }
}
```

### 2. 🚀 Iniciar el Servidor SSE

Antes de usar el servidor en Trae AI, asegúrate de que esté ejecutándose:

```bash
# Navegar al directorio del proyecto
cd /Users/gilberth/Documents/DEV/zabbix-mcp-server

# Iniciar el servidor SSE en puerto 3001
PORT=3001 npm run dev:sse
```

### 3. ✅ Verificación

Puedes verificar que el servidor esté funcionando:

```bash
# Verificar que el puerto esté en uso
lsof -i :3001

# Probar el endpoint de salud
curl http://localhost:3001/health

# Probar el endpoint SSE
curl http://localhost:3001/sse
```

### 4. 🔧 Endpoints Disponibles

- **SSE:** `http://localhost:3001/sse` - Conexión Server-Sent Events
- **Health:** `http://localhost:3001/health` - Verificación de estado
- **Messages:** `http://localhost:3001/message` - Endpoint para mensajes POST

### 5. 🐛 Solución de Problemas

#### Error: "SSE error: undefined"

**Causa:** El servidor SSE no está ejecutándose o se detuvo.

**Solución:**
1. Verificar si el proceso está corriendo: `lsof -i :3001`
2. Si no está corriendo, reiniciar: `PORT=3001 npm run dev:sse`
3. Verificar logs del servidor para errores

#### Error de Conexión

**Causa:** Puerto incorrecto en la configuración.

**Solución:**
- Asegúrate de usar puerto **3001** (no 3000 como en algunos ejemplos)
- Verificar que la URL sea exactamente: `http://localhost:3001/sse`

#### Variables de Entorno

**Causa:** Credenciales de Zabbix incorrectas.

**Solución:**
- Verificar que las credenciales en `env` sean correctas
- Probar conexión manual a Zabbix API

### 6. 📝 Configuración Alternativa

Si prefieres usar variables de entorno locales en lugar de incluirlas en la configuración:

```json
{
  "mcpServers": {
    "zabbix-sse": {
      "transport": "sse",
      "url": "http://localhost:3001/sse"
    }
  }
}
```

Y crear un archivo `.env` en el directorio del proyecto:

```bash
ZABBIX_URL=http://137.184.54.73/api_jsonrpc.php
ZABBIX_USERNAME=Admin
ZABBIX_PASSWORD=zabbix
SSE_PORT=3001
```

### 7. 🎯 Herramientas Disponibles

Una vez configurado correctamente, tendrás acceso a estas herramientas en Trae AI:

- `get_hosts` - Obtener información de hosts
- `get_host_problems` - Problemas de hosts específicos
- `get_triggers` - Información de triggers
- `get_items` - Items de monitoreo
- `create_dashboard` - Crear dashboards
- `get_dashboard_info` - Información de dashboards
- Y muchas más...

### 8. 📞 Soporte

Si continúas teniendo problemas:

1. Verifica los logs del servidor SSE
2. Asegúrate de que Trae AI tenga acceso a localhost:3001
3. Revisa la configuración MCP en Trae AI
4. Prueba la conexión manualmente con curl

---

**Nota:** Esta configuración es específica para el servidor Zabbix en `137.184.54.73`. Ajusta las credenciales según tu entorno.