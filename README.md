# Zabbix MCP Server

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0+-blue.svg)](https://www.typescriptlang.org/)
[![Node.js](https://img.shields.io/badge/Node.js-18+-green.svg)](https://nodejs.org/)

A comprehensive Model Context Protocol (MCP) server for Zabbix integration built with TypeScript and Node.js. This server provides complete access to Zabbix API functionality through MCP-compatible tools with full type safety and modern development features.

<a href="https://glama.ai/mcp/servers/@mpeirone/zabbix-mcp-server">
  <img width="380" height="200" src="https://glama.ai/mcp/servers/@mpeirone/zabbix-mcp-server/badge" alt="zabbix-mcp-server MCP server" />
</a>

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

## Installation

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