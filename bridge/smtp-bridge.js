import { SMTPServer } from 'smtp-server';

/**
 * Local SMTP server that forwards outgoing emails via the Inboxer REST API.
 *
 * Email clients send to localhost:1025 and this bridge calls POST /api/send.
 * Authentication uses any username + the API bearer token as the password.
 */
export class SmtpBridge {
  constructor(config, apiClient) {
    this.config = config;
    this.defaultApi = apiClient;

    this.server = new SMTPServer({
      authOptional: false,
      disabledCommands: ['STARTTLS'],   // local only, no TLS needed
      onAuth: (auth, session, cb) => this.onAuth(auth, session, cb),
      onData: (stream, session, cb) => this.onData(stream, session, cb),
      logger: false,
      banner: 'Inboxer SMTP bridge',
    });
  }

  onAuth(auth, session, cb) {
    // Accept any username; password must be a valid API token.
    // We validate lazily on send — just stash the token.
    session.apiToken = auth.password;
    cb(null, { user: auth.username || 'bridge' });
  }

  async onData(stream, session, cb) {
    // Collect the raw message
    const chunks = [];
    for await (const chunk of stream) chunks.push(chunk);
    const raw = Buffer.concat(chunks).toString('utf-8');

    // Extract basic headers from the raw message
    const headerEnd = raw.indexOf('\r\n\r\n');
    const headerBlock = headerEnd >= 0 ? raw.slice(0, headerEnd) : raw;
    const body = headerEnd >= 0 ? raw.slice(headerEnd + 4) : '';

    const getHeader = (name) => {
      const re = new RegExp(`^${name}:\\s*(.+)$`, 'im');
      const m = headerBlock.match(re);
      return m ? m[1].trim() : '';
    };

    const to = session.envelope.rcptTo.map(r => r.address);
    const subject = getHeader('Subject');

    // Use session token or fallback to default
    const { ApiClient } = await import('./api-client.js');
    const api = session.apiToken
      ? new ApiClient(this.config.apiUrl, session.apiToken)
      : this.defaultApi;

    try {
      await api.sendEmail({ to, subject, body });
      cb(null);
    } catch (err) {
      console.error('[SMTP] send error:', err.message);
      cb(new Error('Failed to send email via API'));
    }
  }

  listen() {
    return new Promise((resolve, reject) => {
      this.server.on('error', reject);
      this.server.listen(this.config.smtpPort, this.config.host, () => {
        console.log(`SMTP server listening on ${this.config.host}:${this.config.smtpPort}`);
        resolve();
      });
    });
  }

  close() {
    return new Promise(resolve => this.server.close(resolve));
  }
}
