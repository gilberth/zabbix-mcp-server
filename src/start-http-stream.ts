#!/usr/bin/env node

import { MCPStreamServer } from './http-stream-server.js';

const port = parseInt(process.env.PORT || '3001');
const server = new MCPStreamServer(port);

server.start().then(() => {
  console.log(`Zabbix MCP HTTP Stream Server started on port ${port}`);
}).catch((error) => {
  console.error('Failed to start server:', error);
  process.exit(1);
});