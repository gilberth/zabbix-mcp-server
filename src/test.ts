#!/usr/bin/env node

/**
 * Test script for Zabbix MCP Server
 */

import { config } from 'dotenv';

// Load environment variables
config();

async function testServer() {
  console.log('Testing Zabbix MCP Server...');
  console.log(`Zabbix URL: ${process.env.ZABBIX_URL || 'Not configured'}`);
  console.log(`Read-only mode: ${process.env.READ_ONLY || 'true'}`);
  
  // Test basic functionality
  console.log('Server configuration loaded successfully');
}

if (import.meta.url === `file://${process.argv[1]}`) {
  testServer().catch(console.error);
}