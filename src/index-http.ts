#!/usr/bin/env node

/**
 * Zabbix MCP Server - HTTP/SSE Transport Implementation
 * Provides Zabbix API access through the Model Context Protocol via HTTP
 */

import { MCPStreamServer } from './http-stream-server.js';
import { config } from 'dotenv';

// Load environment variables
config();

async function main() {
  try {
    console.error('🚀 Starting Zabbix MCP HTTP Server...');
    
    const port = parseInt(process.env.PORT || '3001');
    console.error(`🌐 Server will start on port: ${port}`);
    
    const server = new MCPStreamServer(port);
    await server.start();
    
    console.error('✅ Zabbix MCP HTTP Server started successfully');
    console.error(`📊 Server ready for HTTP/SSE connections`);
    console.error(`🔧 Available endpoints:`);
    console.error(`   - GET /sse - SSE connection for MCP`);
    console.error(`   - POST /message - MCP message handling`);
    console.error(`   - DELETE /session/:id - Session termination`);
    console.error(`   - GET /health - Health check`);
    
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(`❌ Failed to start HTTP server: ${errorMessage}`);
    console.error('💡 Check your configuration and port availability');
    process.exit(1);
  }
}

// Handle graceful shutdown
process.on('SIGINT', async () => {
  console.error('\n🛑 Shutting down Zabbix MCP HTTP Server...');
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.error('\n🛑 Shutting down Zabbix MCP HTTP Server...');
  process.exit(0);
});

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(`❌ HTTP Server error: ${errorMessage}`);
    process.exit(1);
  });
}