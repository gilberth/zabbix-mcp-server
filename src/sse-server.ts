#!/usr/bin/env node

/**
 * Zabbix MCP Server SSE - TypeScript Implementation
 * Provides Zabbix API access through the Model Context Protocol with Server-Sent Events
 */

import { config } from 'dotenv';
import { MCPSSEServer } from './http-server.js';

// Load environment variables
config();

async function main() {
  try {
    console.log('🚀 Starting Zabbix MCP Server with SSE support...');
    
    const port = parseInt(process.env.PORT || '3000', 10);
    const server = new MCPSSEServer(port);
    
    await server.start();
    
    console.log('✅ Zabbix MCP SSE Server started successfully');
    console.log('📡 Server ready for SSE connections');
    console.log('🔧 Available endpoints:');
    console.log(`   - SSE: http://localhost:${port}/sse`);
    console.log(`   - POST: http://localhost:${port}/message`);
    console.log(`   - Health: http://localhost:${port}/health`);
    
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(`❌ Failed to start SSE server: ${errorMessage}`);
    console.error('💡 Check your Zabbix configuration and network connectivity');
    process.exit(1);
  }
}

// Handle graceful shutdown
process.on('SIGINT', async () => {
  console.log('\n🛑 Shutting down Zabbix MCP SSE Server...');
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('\n🛑 Shutting down Zabbix MCP SSE Server...');
  process.exit(0);
});

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(`❌ SSE Server error: ${errorMessage}`);
    process.exit(1);
  });
}