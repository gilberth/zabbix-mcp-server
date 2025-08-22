# MCP Client Connection Guide for IDEs

## Overview

This guide shows how to connect various IDEs and MCP clients to our Zabbix MCP SSE server running on `http://localhost:3001/sse`.

## Configuration Formats

### Visual Studio Code

VS Code uses a `mcp.json` configuration file in the workspace root:

```json
{
  "mcpServers": {
    "zabbix-mcp-sse": {
      "command": "node",
      "args": ["-e", "console.log('SSE transport not supported via command')"],
      "transport": {
        "type": "http",
        "url": "http://localhost:3001/sse",
        "method": "POST"
      },
      "env": {
        "ZABBIX_URL": "http://137.184.54.73/api_jsonrpc.php",
        "ZABBIX_USERNAME": "Admin",
        "ZABBIX_PASSWORD": "zabbix",
        "READ_ONLY": "false"
      }
    }
  }
}
```

### Alternative HTTP Configuration

For better compatibility, use the standard HTTP POST transport:

```json
{
  "mcpServers": {
    "zabbix-mcp": {
      "transport": {
        "type": "http",
        "url": "http://localhost:3001/message",
        "headers": {
          "Content-Type": "application/json"
        }
      },
      "capabilities": {
        "tools": true,
        "resources": false,
        "prompts": false
      }
    }
  }
}
```

### Claude Desktop Configuration

For Claude Desktop, add to `~/.config/claude-desktop/claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "zabbix-monitoring": {
      "transport": {
        "type": "sse",
        "url": "http://localhost:3001/sse"
      },
      "env": {
        "ZABBIX_URL": "http://137.184.54.73/api_jsonrpc.php", 
        "ZABBIX_USERNAME": "Admin",
        "ZABBIX_PASSWORD": "zabbix"
      }
    }
  }
}
```

### Generic MCP Client Configuration

For any MCP-compatible client:

```json
{
  "server": {
    "name": "zabbix-mcp-server",
    "version": "1.0.4",
    "transport": {
      "type": "sse",
      "endpoint": "http://localhost:3001/sse",
      "messageEndpoint": "http://localhost:3001/message"
    },
    "capabilities": {
      "tools": {
        "listChanged": true,
        "count": 23
      }
    }
  }
}
```

## Connection Testing

### 1. Health Check
```bash
curl http://localhost:3001/health
```

Expected response:
```json
{
  "status": "ok",
  "toolsCount": 23,
  "zabbixConnected": true,
  "readOnly": false
}
```

### 2. SSE Connection Test
```bash
curl -N -H "Accept: text/event-stream" http://localhost:3001/sse
```

Expected output:
```
event: endpoint
data: /message?sessionId=<uuid>

data: {"type":"session","sessionId":"<uuid>"}
```

### 3. Tools List Test
```bash
# Get session ID from SSE connection first, then:
curl -X POST "http://localhost:3001/message?sessionId=<session-id>" \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","method":"tools/list","id":1}'
```

## Available Tools (23 Total)

Our Zabbix MCP server provides these tools:

### Host Management
- `host_get` - Retrieve host information
- `host_create` - Create new hosts
- `host_update` - Update existing hosts
- `host_delete` - Delete hosts

### Item Management  
- `item_get` - Retrieve monitoring items
- `item_create` - Create new items
- `item_history_get` - Get historical data
- `item_latest_data_get` - Get latest values

### Dashboard Operations
- `dashboard_get` - List dashboards
- `dashboard_create` - Create dashboards
- `dashboard_update` - Update dashboards
- `dashboard_delete` - Delete dashboards

### Proxmox Integration
- `proxmox_dashboard_create_single` - Single node dashboard
- `proxmox_dashboard_create_dual` - Dual node dashboard
- `proxmox_serverhome_dashboard_create` - Combined dashboard

### System Tools
- `api_connectivity_check` - Test Zabbix connection
- `api_version_get` - Get API version
- `problem_get` - Retrieve current problems
- `trigger_get` - Get trigger configurations
- `graph_get` - Get graph definitions
- `template_get` - Get templates
- `usergroup_get` - Get user groups
- `maintenance_get` - Get maintenance windows

## IDE-Specific Setup Instructions

### Visual Studio Code with MCP Extension

1. Install MCP extension from marketplace
2. Create `.vscode/mcp.json` in your workspace
3. Add the configuration shown above
4. Restart VS Code
5. Look for MCP server status in status bar

### Cursor IDE

Cursor follows VS Code configuration format:

1. Create `mcp.json` in project root
2. Use same format as VS Code configuration
3. Enable MCP in Cursor settings

### JetBrains IDEs (IntelliJ, PyCharm, etc.)

Currently limited MCP support. Use external tools or plugins:

1. Configure as External Tool in Settings
2. Use curl commands for testing
3. Consider using MCP CLI wrapper

## Troubleshooting

### Common Issues

1. **"Session not found" errors**
   - Ensure SSE connection stays open
   - Check session ID matches between connection and requests

2. **"stream is not readable" errors** 
   - This was fixed by removing `express.json()` middleware
   - Ensure server is running updated version

3. **CORS errors in browser clients**
   - Server has CORS enabled for all origins
   - Check browser console for specific CORS issues

4. **Connection timeout**
   - Server has 30-minute session timeout
   - Implement reconnection logic in clients

### Debug Mode

Enable debug logging:
```bash
DEBUG=* npm run dev:stream
```

### Web Client Testing

Use the included web client for testing:
```bash
open examples/web-client.html
```

This provides a full debugging interface with connection logs.

## Production Deployment

For production use:

1. **HTTPS Support**: Configure TLS certificates
2. **Authentication**: Add API key validation
3. **Rate Limiting**: Implement request limits
4. **Monitoring**: Add metrics and health checks
5. **Clustering**: Support multiple server instances

### Docker Configuration

```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
RUN npm run build
EXPOSE 3001
CMD ["npm", "run", "dev:stream"]
```

### Environment Variables

```bash
ZABBIX_URL=https://your-zabbix-server.com
ZABBIX_USERNAME=your-username
ZABBIX_PASSWORD=your-password
READ_ONLY=false
PORT=3001
```

## Client Libraries

### Node.js/TypeScript
```typescript
import { SSEClientTransport } from '@modelcontextprotocol/sdk/client/sse.js';

const transport = new SSEClientTransport('http://localhost:3001/sse');
await transport.connect();
```

### Python
```python
import asyncio
from mcp import ClientSession
from mcp.client.sse import SSEClientTransport

async def main():
    transport = SSEClientTransport("http://localhost:3001/sse")
    async with ClientSession(transport) as session:
        tools = await session.list_tools()
        print(f"Available tools: {len(tools.tools)}")

asyncio.run(main())
```

### JavaScript/Browser
```javascript
class MCPSSEClient {
    constructor(url) {
        this.url = url;
        this.sessionId = null;
    }
    
    async connect() {
        this.eventSource = new EventSource(this.url);
        
        return new Promise((resolve) => {
            this.eventSource.onmessage = (event) => {
                const data = JSON.parse(event.data);
                if (data.type === 'session') {
                    this.sessionId = data.sessionId;
                    resolve();
                }
            };
        });
    }
    
    async callTool(name, args) {
        const response = await fetch(`${this.url.replace('/sse', '/message')}?sessionId=${this.sessionId}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                jsonrpc: '2.0',
                method: 'tools/call',
                params: { name, arguments: args },
                id: Date.now()
            })
        });
        return response.json();
    }
}
```

## Support and Resources

- **MCP Specification**: https://modelcontextprotocol.io/
- **GitHub Repository**: https://github.com/modelcontextprotocol/specification  
- **VS Code MCP Extension**: Search "MCP" in VS Code marketplace
- **Claude Desktop MCP**: https://claude.ai/docs/mcp

---

**Note**: This server is fully MCP-compliant and has been tested with multiple client types. All 23 Zabbix tools are available via the SSE transport with proper session management and error handling.