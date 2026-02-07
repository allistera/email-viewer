#!/usr/bin/env node
import config from './config.js';
import { ApiClient } from './api-client.js';
import { IMAPServer } from './imap-server.js';
import { SmtpBridge } from './smtp-bridge.js';

if (!config.apiToken) {
  console.error('Error: INBOXER_API_TOKEN environment variable is required.');
  console.error('');
  console.error('Usage:');
  console.error('  INBOXER_API_TOKEN=<token> INBOXER_API_URL=<url> npm start');
  console.error('');
  console.error('Environment variables:');
  console.error('  INBOXER_API_TOKEN  (required) API bearer token');
  console.error('  INBOXER_API_URL    API base URL (default: http://localhost:8787)');
  console.error('  IMAP_PORT          IMAP listen port (default: 1143)');
  console.error('  SMTP_PORT          SMTP listen port (default: 1025)');
  console.error('  BRIDGE_HOST        Listen address (default: 127.0.0.1)');
  process.exit(1);
}

const api = new ApiClient(config.apiUrl, config.apiToken);

// Validate connection on startup
try {
  await api.health();
  console.log(`Connected to API at ${config.apiUrl}`);
} catch (err) {
  console.error(`Failed to connect to API at ${config.apiUrl}: ${err.message}`);
  process.exit(1);
}

const imap = new IMAPServer(config, api);
const smtp = new SmtpBridge(config, api);

await Promise.all([imap.listen(), smtp.listen()]);

console.log('');
console.log('Inboxer bridge is running. Configure your email client:');
console.log(`  IMAP server: ${config.host}  port: ${config.imapPort}  security: none`);
console.log(`  SMTP server: ${config.host}  port: ${config.smtpPort}  security: none`);
console.log('  Username: (anything)  Password: your API token');
console.log('');

// Graceful shutdown
const shutdown = () => {
  console.log('\nShutting down...');
  Promise.all([imap.close(), smtp.close()]).then(() => process.exit(0));
};
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
