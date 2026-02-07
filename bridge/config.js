import { homedir } from 'os';
import { join } from 'path';
import { mkdirSync } from 'fs';

const dataDir = process.env.BRIDGE_DATA_DIR || join(homedir(), '.inboxer-bridge');
mkdirSync(dataDir, { recursive: true });

export default {
  apiUrl: (process.env.INBOXER_API_URL || 'http://localhost:8787').replace(/\/+$/, ''),
  apiToken: process.env.INBOXER_API_TOKEN || '',
  imapPort: parseInt(process.env.IMAP_PORT) || 1143,
  smtpPort: parseInt(process.env.SMTP_PORT) || 1025,
  host: process.env.BRIDGE_HOST || '127.0.0.1',
  dataDir,
};
