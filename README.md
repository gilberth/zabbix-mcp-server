# 📊 Zabbix Dashboard Automation - Proxmox Monitoring

Un servidor MCP (Model Context Protocol) para automatización de dashboards de Zabbix con monitoreo completo de Proxmox.

## 🎯 Estado del Proyecto

✅ **Dashboard Proxmox Completamente Funcional**  
✅ **6 Widgets Operativos**  
✅ **384 Items Monitoreados**  
✅ **Sin Errores de Permisos**  
✅ **Autenticación Moderna (Zabbix 7.4+)**

### 🔗 Integración MCP Completada ✅
- **Servidor MCP**: Funcional con herramientas especializadas
- **Herramientas Proxmox**: 4 nuevas herramientas integradas
- **Modo**: Read-only para seguridad
- **Estado**: Ejecutándose correctamente

## 🚀 Archivos Principales

### Scripts de Automatización
- **`crear-dashboard-stdlib.py`** - Script principal para crear dashboard inicial
- **`crear-dashboard-dual-proxmox.py`** - Script para dashboards duales
- **`mejorar-dashboard.py`** - Script para mejorar dashboard existente
- **`agregar-widgets-proxmox.py`** - Script para agregar widgets completos
- **`auto-configurar-svg-widgets.py`** - ⭐ **NUEVO**: Auto-configurador de widgets SVG
- **`test-mcp-proxmox.py`** - Script de prueba para funcionalidades MCP

### Documentación
- **`DASHBOARD-PROXMOX-COMPLETO.md`** - Guía completa de implementación
- **`GUIA-AUTOMATIZACION-DASHBOARDS.md`** - Guía técnica de automatización
- **`LOGICA-CONFIGURACION-SVG-WIDGETS.md`** - ⭐ **NUEVO**: Lógica para resolver errores SVG
- **`WIDGET-CONFIGURATION-GUIDE.md`** - Guía de configuración de widgets

## 🔧 Configuración del Servidor

```
Servidor Zabbix: 137.184.54.73
Versión: Zabbix 7.4.1
API: http://137.184.54.73/api_jsonrpc.php
Usuario: Admin
Contraseña: zabbix
```

## 📊 Dashboard Implementado

### Widgets Funcionales
1. **📋 Problemas del Sistema** - Alertas activas
2. **🔌 Estado de API** - Monitoreo del servicio
3. **🏢 Estado del Cluster** - Información del cluster
4. **📊 Información del Sistema** - Estadísticas generales
5. **📈 Gráfico de CPU** - Uso en tiempo real
6. **💾 Gráfico de Memoria** - Uso en tiempo real

### Acceso al Dashboard
🌐 **URL**: `http://137.184.54.73`  
📊 **Ruta**: Monitoring → Dashboards → Proxmox Monitoring

## 🚀 Uso Rápido

### Crear Dashboard Completo
```bash
python3 crear-dashboard-stdlib.py
```

### Mejorar Dashboard Existente
```bash
python3 mejorar-dashboard.py
```

### Agregar Widgets Adicionales
```bash
python3 agregar-widgets-proxmox.py
```

### ⭐ Auto-Configurar Widgets SVG (NUEVO)
```bash
# Resolver automáticamente errores de configuración SVG
python3 auto-configurar-svg-widgets.py http://localhost/zabbix Admin zabbix 404
```

**Errores resueltos:**
- ❌ `"Invalid parameter 'Data set1/hosts': cannot be empty"`
- ❌ `"Invalid parameter 'Data set1/items': cannot be empty"`
- ✅ **Configuración automática** de host patterns e item patterns

## 📋 Items Monitoreados

```
Total: 384 items
├── CPU: 34 items
├── Memoria: 60 items
├── Disco: 146 items
├── API: 1 item
├── Cluster: 3 items
├── LXC: 115 items
└── VMs: 25 items
```

## 🔍 Resolución de Problemas

### Problemas de Permisos
- ✅ **Resuelto**: Error "No permissions to referred object"
- ✅ **Implementado**: Autenticación moderna con `Authorization: Bearer`
- ✅ **Validado**: Verificación de items antes de crear widgets

### Autenticación
- ✅ **Zabbix 7.4+**: Usar `Authorization: Bearer` header
- ✅ **Fallback**: Soporte para método legacy si es necesario
- ✅ **Seguridad**: Logout automático al finalizar

## 🎉 Resultado Final

El dashboard de **Proxmox Monitoring** está **100% operativo** con:
- Monitoreo en tiempo real de CPU y memoria
- Estado del cluster y API
- Problemas activos del sistema
- Información detallada del sistema

## 📚 Documentación Adicional

Para información técnica detallada, consulta:
- `DASHBOARD-PROXMOX-COMPLETO.md` - Implementación completa
- `GUIA-AUTOMATIZACION-DASHBOARDS.md` - Guía técnica

---

*Proyecto completado exitosamente - Dashboard Proxmox v1.0*

## Features

### 🏠 Host Management
- `host_get` - Retrieve hosts with advanced filtering
- `host_create` - Create new hosts with interfaces and templates
- `host_update` - Update existing host configurations
- `host_delete` - Remove hosts from monitoring

### 👥 Host Group Management
- `hostgroup_get` - Retrieve host groups
- `hostgroup_create` - Create new host groups
- `hostgroup_update` - Modify existing host groups
- `hostgroup_delete` - Remove host groups

### 📊 Item Management
- `item_get` - Retrieve monitoring items with filtering
- `item_create` - Create new monitoring items
- `item_update` - Update existing items
- `item_delete` - Remove monitoring items

### ⚠️ Trigger Management
- `trigger_get` - Retrieve triggers and alerts
- `trigger_create` - Create new triggers
- `trigger_update` - Modify existing triggers
- `trigger_delete` - Remove triggers

### 📋 Template Management
- `template_get` - Retrieve monitoring templates
- `template_create` - Create new templates
- `template_update` - Update existing templates
- `template_delete` - Remove templates

### 🚨 Problem & Event Management
- `problem_get` - Retrieve current problems and issues
- `event_get` - Get historical events
- `event_acknowledge` - Acknowledge events and problems

### 📈 Data Retrieval
- `history_get` - Access historical monitoring data
- `trend_get` - Retrieve trend data and statistics

### 👤 User Management
- `user_get` - Retrieve user accounts
- `user_create` - Create new users
- `user_update` - Update user information
- `user_delete` - Remove user accounts

### 🔧 Maintenance Management
- `maintenance_get` - Retrieve maintenance periods
- `maintenance_create` - Schedule maintenance windows
- `maintenance_update` - Modify maintenance periods
- `maintenance_delete` - Remove maintenance schedules

### 📊 Additional Features
- `graph_get` - Retrieve graph configurations
- `discoveryrule_get` - Get discovery rules
- `itemprototype_get` - Retrieve item prototypes
- `configuration_export` - Export Zabbix configurations
- `configuration_import` - Import configurations
- `apiinfo_version` - Get API version information

### 🚀 Herramientas Especializadas para Proxmox
- `mcp_zabbix_proxmox_hosts_analyze` - Analizar hosts Proxmox y categorizar items
- `mcp_zabbix_proxmox_dashboard_create_single` - Crear dashboard para un nodo Proxmox
- `mcp_zabbix_proxmox_dashboard_create_dual` - Crear dashboard dual para dos nodos Proxmox
- `mcp_zabbix_proxmox_dashboard_add_widgets` - Agregar widgets específicos a dashboards existentes

## 🔧 Uso de Herramientas MCP Proxmox

### Analizar Hosts Proxmox
```json
{
  "tool": "mcp_zabbix_proxmox_hosts_analyze",
  "args": {
    "categorize_items": true,
    "hostname_filter": "proxmox"
  }
}
```

### Crear Dashboard Individual
```json
{
  "tool": "mcp_zabbix_proxmox_dashboard_create_single", 
  "args": {
    "hostname": "proxmox",
    "dashboard_name": "Proxmox Monitor"
  }
}
```

### Crear Dashboard Dual
```json
{
  "tool": "mcp_zabbix_proxmox_dashboard_create_dual",
  "args": {
    "hostname1": "proxmox",
    "hostname2": "serverhome", 
    "dashboard_name": "Proxmox Dual Monitor"
  }
}
```

### Agregar Widgets
```json
{
  "tool": "mcp_zabbix_proxmox_dashboard_add_widgets",
  "args": {
    "dashboard_id": "402",
    "hostname": "proxmox",
    "widget_types": ["cpu_graph", "memory_graph", "disk_graph"]
  }
}
```

## Installation

```bash
npm install -g @thelord/zabbix-mcp-server
```

### Prerequisites

- Node.js 18 or higher
- npm (comes with Node.js)
- [Conda](https://docs.conda.io/en/latest/) (recommended for environment management)
- Access to a Zabbix server with API enabled

### Quick Start

1. **Clone the repository:**
   ```bash
   git clone https://github.com/mpeirone/zabbix-mcp-server.git
   cd zabbix-mcp-server
   ```

2. **Set up the environment:**
   ```bash
   # Create conda environment
   conda create -n zabbix-mcp-server -c conda-forge nodejs -y
   
   # Activate environment (or use the included script)
   source activate.sh
   ```

3. **Install dependencies:**
   ```bash
   npm install
   ```

4. **Build the project:**
   ```bash
   npm run build
   ```

5. **Configure environment variables:**
   ```bash
   cp .env.example .env
   # Edit .env with your Zabbix server details
   ```

6. **Test the installation:**
   ```bash
   npm test
   ```

## Configuration

### Standard MCP Server (stdio)

Create a `.env` file in your project directory:

```env
ZABBIX_URL=http://your-zabbix-server/zabbix
ZABBIX_USER=your-username
ZABBIX_PASSWORD=your-password
READ_ONLY=false
```

### SSE Server (Server-Sent Events)

For remote access and real-time communication, use the SSE server. Create a `.env` file:

```env
# Zabbix API Configuration
ZABBIX_URL=http://your-zabbix-server/zabbix
ZABBIX_USER=your-username
ZABBIX_PASSWORD=your-password

# SSE Server Configuration
PORT=3000

# CORS Configuration (comma-separated origins)
ALLOWED_ORIGINS=http://localhost:3001,http://localhost:8080

# Security
READ_ONLY=false
```

### Required Environment Variables

- `ZABBIX_URL` - Your Zabbix server API endpoint (e.g., `https://zabbix.example.com`)

### Authentication (choose one method)

**Method 1: API Token (Recommended)**
- `ZABBIX_TOKEN` - Your Zabbix API token

**Method 2: Username/Password**
- `ZABBIX_USER` - Your Zabbix username
- `ZABBIX_PASSWORD` - Your Zabbix password

### Optional Configuration

- `READ_ONLY` - Set to `true`, `1`, or `yes` to enable read-only mode (only GET operations allowed)

## Usage

### Standard MCP Server (stdio)

#### As a standalone server

```bash
npx @thelord/zabbix-mcp-server
```

#### With Claude Desktop

Add to your Claude Desktop configuration:

```json
{
  "mcpServers": {
    "zabbix": {
      "command": "npx",
      "args": ["@thelord/zabbix-mcp-server"]
    }
  }
}
```

### SSE Server (Server-Sent Events)

#### Start the SSE server

```bash
# Development mode
npm run dev:sse

# Production mode
npm run build
npm run start:sse
```

#### Configure MCP clients for SSE

**VS Code with MCP extension:**
```json
{
  "mcpServers": {
    "zabbix-sse": {
      "transport": {
        "type": "sse",
        "url": "http://localhost:3000/sse",
        "postUrl": "http://localhost:3000/message"
      }
    }
  }
}
```

**Cursor IDE:**
```json
{
  "mcpServers": {
    "zabbix-sse": {
      "transport": "sse",
      "url": "http://localhost:3000/sse",
      "postUrl": "http://localhost:3000/message"
    }
  }
}
```

**Neovim with MCPHub.nvim:**
```lua
require('mcphub').setup({
  servers = {
    ['zabbix-sse'] = {
      transport = 'sse',
      url = 'http://localhost:3000/sse',
      post_url = 'http://localhost:3000/message'
    }
  }
})
```

### Running the Server

**Production mode:**
```bash
npm start
```

**Development mode (with auto-reload):**
```bash
npm run dev
```

**Direct execution:**
```bash
node dist/index.js
```

### Testing

**Run test suite:**
```bash
npm test
```

### Available Scripts

- `npm run build` - Compile TypeScript to JavaScript
- `npm start` - Run the compiled server
- `npm run dev` - Run in development mode with auto-reload
- `npm test` - Run tests and verify configuration

### Read-Only Mode

When `READ_ONLY=true`, the server will only expose GET operations (retrieve data) and block all create, update, and delete operations. This is useful for:

- 📊 Monitoring dashboards
- 🔍 Read-only integrations
- 🔒 Security-conscious environments
- 🛡️ Preventing accidental modifications

### Example Tool Calls

**Get all hosts:**
```python
host_get()
```

**Get hosts in specific group:**
```python
host_get(groupids=["1"])
```

**Create a new host:**
```python
host_create(
    host="server-01",
    groups=[{"groupid": "1"}],
    interfaces=[{
        "type": 1,
        "main": 1,
        "useip": 1,
        "ip": "192.168.1.100",
        "dns": "",
        "port": "10050"
    }]
)
```

**Get recent problems:**
```python
problem_get(recent=True, limit=10)
```

**Get history data:**
```python
history_get(
    itemids=["12345"],
    time_from=1640995200,
    limit=100
)
```

## MCP Integration

This server is designed to work with MCP-compatible clients like Claude Desktop. See [MCP_SETUP.md](MCP_SETUP.md) for detailed integration instructions.

## Docker Support

### Using Docker Compose

1. **Configure environment:**
   ```bash
   cp config/.env.example .env
   # Edit .env with your settings
   ```

2. **Run with Docker Compose:**
   ```bash
   docker compose up -d
   ```

### Building Docker Image

```bash
docker build -t zabbix-mcp-server .
```

## Development

### Project Structure

```
zabbix-mcp-server/
├── src/
│   └── zabbix_mcp_server.py    # Main server implementation
├── scripts/
│   ├── start_server.py         # Startup script with validation
│   └── test_server.py          # Test script
├── config/
│   ├── .env.example           # Environment configuration template
│   └── mcp.json               # MCP client configuration example
├── pyproject.toml             # Python project configuration
├── requirements.txt           # Dependencies
├── Dockerfile                 # Docker configuration
├── docker-compose.yml         # Docker Compose setup
├── README.md                  # This file
├── MCP_SETUP.md              # MCP integration guide
├── CONTRIBUTING.md           # Contribution guidelines
├── CHANGELOG.md              # Version history
└── LICENSE                   # MIT license
```

### Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

### Running Tests

```bash
# Test server functionality
uv run python scripts/test_server.py

# Test with Docker
docker-compose exec zabbix-mcp python scripts/test_server.py
```

## Error Handling

The server includes comprehensive error handling:

- ✅ Authentication errors are clearly reported
- 🔒 Read-only mode violations are blocked with descriptive messages
- ✔️ Invalid parameters are validated
- 🌐 Network and API errors are properly formatted
- 📝 Detailed logging for troubleshooting

## Security Considerations

- 🔑 Use API tokens instead of username/password when possible
- 🔒 Enable read-only mode for monitoring-only use cases
- 🛡️ Secure your environment variables
- 🔐 Use HTTPS for Zabbix server connections
- 🔄 Regularly rotate API tokens
- 📁 Store configuration files securely

## Troubleshooting

### Common Issues

**Connection Failed:**
- Verify `ZABBIX_URL` is correct and accessible
- Check authentication credentials
- Ensure Zabbix API is enabled

**Permission Denied:**
- Verify user has sufficient Zabbix permissions
- Check if read-only mode is enabled when trying to modify data

**Tool Not Found:**
- Ensure all dependencies are installed: `uv sync`
- Verify Python version compatibility (3.10+)

### Debug Mode

Set environment variable for detailed logging:
```bash
export DEBUG=1
uv run python scripts/start_server.py
```

## Dependencies

- [FastMCP](https://github.com/jlowin/fastmcp) - MCP server framework
- [python-zabbix-utils](https://github.com/zabbix/python-zabbix-utils) - Official Zabbix Python library

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Acknowledgments

- [Zabbix](https://www.zabbix.com/) for the monitoring platform
- [Model Context Protocol](https://modelcontextprotocol.io/) for the integration standard
- [FastMCP](https://github.com/jlowin/fastmcp) for the server framework

## Support

- 📖 [Documentation](README.md)
- 🐛 [Issue Tracker](https://github.com/mpeirone/zabbix-mcp-server/issues)
- 💬 [Discussions](https://github.com/mpeirone/zabbix-mcp-server/discussions)

---

**Made with ❤️ for the Zabbix and MCP communities**