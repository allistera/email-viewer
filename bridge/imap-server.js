import net from 'net';
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join } from 'path';

/**
 * Minimal IMAP4rev1 server that bridges to the Inboxer REST API.
 *
 * Supported commands: CAPABILITY, LOGIN, LOGOUT, NAMESPACE, ID, NOOP,
 * LIST, LSUB, STATUS, SELECT, EXAMINE, CLOSE, EXPUNGE,
 * FETCH, UID FETCH, STORE, UID STORE, SEARCH, UID SEARCH, IDLE.
 */

// ---------------------------------------------------------------------------
// UID persistence
// ---------------------------------------------------------------------------

class UidStore {
  constructor(dataDir) {
    this.path = join(dataDir, 'uid-map.json');
    this.data = { uidValidity: Date.now(), mailboxes: {} };
    this.load();
  }

  load() {
    try {
      if (existsSync(this.path)) {
        this.data = JSON.parse(readFileSync(this.path, 'utf-8'));
      }
    } catch { /* start fresh */ }
  }

  save() {
    writeFileSync(this.path, JSON.stringify(this.data), 'utf-8');
  }

  /** Return or create the UID entry for a mailbox. */
  mailbox(name) {
    if (!this.data.mailboxes[name]) {
      this.data.mailboxes[name] = { nextUid: 1, map: {} };
    }
    return this.data.mailboxes[name];
  }

  /** Assign UIDs to a list of message UUIDs (in received_at ASC order). */
  assignUids(mailboxName, uuids) {
    const mb = this.mailbox(mailboxName);
    for (const uuid of uuids) {
      if (!mb.map[uuid]) {
        mb.map[uuid] = mb.nextUid++;
      }
    }
    this.save();
    return mb;
  }

  getUid(mailboxName, uuid) {
    return this.mailbox(mailboxName).map[uuid] || 0;
  }

  get uidValidity() {
    return this.data.uidValidity;
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function imapQuote(s) {
  if (s === null || s === undefined) return 'NIL';
  const str = String(s);
  if (str.length === 0) return '""';
  // Use literal for strings with special chars
  if (/[\r\n"\\]/.test(str)) {
    const buf = Buffer.from(str, 'utf-8');
    return `{${buf.length}}\r\n${str}`;
  }
  return `"${str}"`;
}

function imapDate(dateStr) {
  const d = new Date(dateStr || Date.now());
  if (isNaN(d.getTime())) return imapQuote(new Date().toUTCString());
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  const day = String(d.getUTCDate()).padStart(2, '0');
  const mon = months[d.getUTCMonth()];
  const year = d.getUTCFullYear();
  const hh = String(d.getUTCHours()).padStart(2, '0');
  const mm = String(d.getUTCMinutes()).padStart(2, '0');
  const ss = String(d.getUTCSeconds()).padStart(2, '0');
  return `"${day}-${mon}-${year} ${hh}:${mm}:${ss} +0000"`;
}

function parseAddress(raw) {
  if (!raw) return 'NIL';
  // raw can be "Foo <foo@bar.com>" or "foo@bar.com" or "foo@bar.com, baz@q.com"
  const addrs = String(raw).split(',').map(s => s.trim()).filter(Boolean);
  if (addrs.length === 0) return 'NIL';
  const parts = addrs.map(a => {
    const m = a.match(/^(.*?)\s*<(.+?)>$/);
    let personal = null, email;
    if (m) {
      personal = m[1].replace(/^"|"$/g, '').trim() || null;
      email = m[2];
    } else {
      email = a.replace(/^<|>$/g, '');
    }
    const [user, host] = email.split('@');
    return `(${personal ? imapQuote(personal) : 'NIL'} NIL ${imapQuote(user || '')} ${imapQuote(host || '')})`;
  });
  return `(${parts.join('')})`;
}

function buildEnvelope(msg) {
  const date = imapQuote(msg.date_header || new Date(msg.received_at).toUTCString());
  const subject = imapQuote(msg.subject);
  const from = parseAddress(msg.from_addr);
  const sender = from; // same
  const replyTo = from; // fallback
  const to = parseAddress(msg.to_addr);
  const cc = 'NIL';
  const bcc = 'NIL';

  let inReplyTo = 'NIL';
  let messageId = 'NIL';
  try {
    const headers = JSON.parse(msg.headers_json || '{}');
    if (headers['In-Reply-To']) inReplyTo = imapQuote(headers['In-Reply-To']);
    if (headers['Message-ID'] || headers['Message-Id']) {
      messageId = imapQuote(headers['Message-ID'] || headers['Message-Id']);
    }
  } catch { /* ignore */ }
  if (messageId === 'NIL') {
    messageId = imapQuote(`<${msg.id}@inboxer.local>`);
  }

  return `(${date} ${subject} ${from} ${sender} ${replyTo} ${to} ${cc} ${bcc} ${inReplyTo} ${messageId})`;
}

/** Reconstruct an RFC 5322 message from API data (fallback when raw .eml unavailable). */
function buildRfc822(msg) {
  let headers = '';
  try {
    const hj = JSON.parse(msg.headers_json || '{}');
    if (hj['Message-ID'] || hj['Message-Id']) {
      headers += `Message-ID: ${hj['Message-ID'] || hj['Message-Id']}\r\n`;
    }
  } catch { /* ignore */ }

  if (!headers.includes('Message-ID')) {
    headers += `Message-ID: <${msg.id}@inboxer.local>\r\n`;
  }
  headers += `From: ${msg.from_addr || 'unknown@unknown'}\r\n`;
  headers += `To: ${msg.to_addr || 'unknown@unknown'}\r\n`;
  headers += `Subject: ${msg.subject || ''}\r\n`;
  headers += `Date: ${msg.date_header || new Date(msg.received_at).toUTCString()}\r\n`;
  headers += `MIME-Version: 1.0\r\n`;

  const hasText = !!msg.text_body;
  const hasHtml = !!msg.html_body;

  if (hasText && hasHtml) {
    const boundary = `----=_Part_${msg.id.replace(/-/g, '').slice(0, 16)}`;
    headers += `Content-Type: multipart/alternative; boundary="${boundary}"\r\n`;
    let body = `\r\n--${boundary}\r\n`;
    body += `Content-Type: text/plain; charset=utf-8\r\n\r\n`;
    body += msg.text_body + '\r\n';
    body += `--${boundary}\r\n`;
    body += `Content-Type: text/html; charset=utf-8\r\n\r\n`;
    body += msg.html_body + '\r\n';
    body += `--${boundary}--\r\n`;
    return headers + body;
  } else if (hasHtml) {
    headers += `Content-Type: text/html; charset=utf-8\r\n`;
    return headers + `\r\n` + msg.html_body + '\r\n';
  } else {
    headers += `Content-Type: text/plain; charset=utf-8\r\n`;
    return headers + `\r\n` + (msg.text_body || '') + '\r\n';
  }
}

/** Parse a sequence set like "1:*", "1,3:5", "2:4" relative to a list length. */
function parseSequenceSet(setStr, total) {
  const result = [];
  for (const part of setStr.split(',')) {
    if (part.includes(':')) {
      let [a, b] = part.split(':');
      a = a === '*' ? total : parseInt(a);
      b = b === '*' ? total : parseInt(b);
      if (isNaN(a) || isNaN(b)) continue;
      const lo = Math.max(1, Math.min(a, b));
      const hi = Math.min(total, Math.max(a, b));
      for (let i = lo; i <= hi; i++) result.push(i);
    } else {
      const n = part === '*' ? total : parseInt(part);
      if (!isNaN(n) && n >= 1 && n <= total) result.push(n);
    }
  }
  return [...new Set(result)].sort((a, b) => a - b);
}

/** Map a mailbox name used in the bridge to API query filters. */
function mailboxToFilters(name) {
  const n = name.toUpperCase();
  if (n === 'INBOX') return { archived: false, excludeTag: 'Spam' };
  if (n === 'SENT') return { tag: 'Sent' };
  if (n === 'SPAM' || n === 'JUNK') return { tag: 'Spam' };
  if (n === 'ARCHIVE' || n === 'TRASH') return { archived: true };
  if (n === 'DRAFTS') return { tag: '__never_match__' };
  // Tag folder: Tags/Something
  if (name.startsWith('Tags/')) {
    return { tag: name.slice(5), archived: false };
  }
  return { tag: name, archived: false };
}

// ---------------------------------------------------------------------------
// IMAP Connection
// ---------------------------------------------------------------------------

class IMAPConnection {
  constructor(socket, server) {
    this.socket = socket;
    this.server = server;
    this.api = server.api;
    this.uidStore = server.uidStore;

    this.state = 'NOT_AUTHENTICATED';
    this.selectedMailbox = null;
    this.readOnly = false;
    this.messages = [];   // { uuid, uid, seqNum, flags, msg (full detail cached) }
    this.buffer = '';
    this.idling = false;
    this.idleTag = null;
    this.literalExpected = 0;
    this.commandParts = [];
    this.destroyed = false;

    const remote = `${socket.remoteAddress}:${socket.remotePort}`;
    this.log = (msg) => console.log(`[IMAP ${remote}] ${msg}`);

    socket.on('data', (chunk) => this.onData(chunk));
    socket.on('close', () => { this.destroyed = true; });
    socket.on('error', (err) => { this.log(`socket error: ${err.message}`); });

    this.send(`* OK [CAPABILITY IMAP4rev1 IDLE NAMESPACE ID] Inboxer IMAP bridge ready`);
  }

  send(line) {
    if (this.destroyed) return;
    try {
      this.socket.write(line + '\r\n');
    } catch { /* connection gone */ }
  }

  sendRaw(data) {
    if (this.destroyed) return;
    try {
      this.socket.write(data);
    } catch { /* connection gone */ }
  }

  // ---- Protocol parsing ----

  onData(chunk) {
    this.buffer += chunk.toString('binary');
    this.processBuffer();
  }

  processBuffer() {
    while (this.buffer.length > 0) {
      if (this.literalExpected > 0) {
        if (this.buffer.length < this.literalExpected) return; // wait
        const litData = this.buffer.slice(0, this.literalExpected);
        this.buffer = this.buffer.slice(this.literalExpected);
        this.commandParts.push(litData);
        this.literalExpected = 0;
        continue;
      }

      const idx = this.buffer.indexOf('\r\n');
      if (idx === -1) return; // wait

      const line = this.buffer.slice(0, idx);
      this.buffer = this.buffer.slice(idx + 2);

      // Check for literal at end of line: {123}
      const litMatch = line.match(/\{(\d+)\}$/);
      if (litMatch) {
        this.commandParts.push(line.slice(0, -litMatch[0].length));
        this.literalExpected = parseInt(litMatch[1]);
        this.send('+ Ready');
        continue;
      }

      this.commandParts.push(line);
      const fullCommand = this.commandParts.join('');
      this.commandParts = [];
      this.handleCommand(fullCommand);
    }
  }

  handleCommand(raw) {
    // Handle IDLE done
    if (this.idling && raw.toUpperCase() === 'DONE') {
      this.idling = false;
      this.send(`${this.idleTag} OK IDLE completed`);
      this.idleTag = null;
      return;
    }

    const spaceIdx = raw.indexOf(' ');
    if (spaceIdx === -1) {
      this.send('* BAD Invalid command');
      return;
    }

    const tag = raw.slice(0, spaceIdx);
    const rest = raw.slice(spaceIdx + 1);
    const cmdSpaceIdx = rest.indexOf(' ');
    let command, args;
    if (cmdSpaceIdx === -1) {
      command = rest.toUpperCase();
      args = '';
    } else {
      command = rest.slice(0, cmdSpaceIdx).toUpperCase();
      args = rest.slice(cmdSpaceIdx + 1);
    }

    this.log(`${tag} ${command} ${args.slice(0, 100)}${args.length > 100 ? '...' : ''}`);

    this.dispatch(tag, command, args).catch(err => {
      this.log(`Error handling ${command}: ${err.message}`);
      this.send(`${tag} BAD Internal error`);
    });
  }

  async dispatch(tag, command, args) {
    // UID prefix
    if (command === 'UID') {
      const sub = args.indexOf(' ');
      if (sub === -1) { this.send(`${tag} BAD UID requires a subcommand`); return; }
      const subCmd = args.slice(0, sub).toUpperCase();
      const subArgs = args.slice(sub + 1);
      if (subCmd === 'FETCH') return this.cmdFetch(tag, subArgs, true);
      if (subCmd === 'STORE') return this.cmdStore(tag, subArgs, true);
      if (subCmd === 'SEARCH') return this.cmdSearch(tag, subArgs, true);
      this.send(`${tag} BAD Unknown UID subcommand`);
      return;
    }

    switch (command) {
      case 'CAPABILITY': return this.cmdCapability(tag);
      case 'LOGIN': return this.cmdLogin(tag, args);
      case 'LOGOUT': return this.cmdLogout(tag);
      case 'NAMESPACE': return this.cmdNamespace(tag);
      case 'ID': return this.cmdId(tag, args);
      case 'NOOP': return this.cmdNoop(tag);
      case 'LIST': return this.cmdList(tag, args);
      case 'LSUB': return this.cmdList(tag, args); // treat same as LIST
      case 'STATUS': return this.cmdStatus(tag, args);
      case 'SELECT': return this.cmdSelect(tag, args, false);
      case 'EXAMINE': return this.cmdSelect(tag, args, true);
      case 'CLOSE': return this.cmdClose(tag);
      case 'EXPUNGE': return this.cmdExpunge(tag);
      case 'FETCH': return this.cmdFetch(tag, args, false);
      case 'STORE': return this.cmdStore(tag, args, false);
      case 'SEARCH': return this.cmdSearch(tag, args, false);
      case 'IDLE': return this.cmdIdle(tag);
      case 'CHECK': this.send(`${tag} OK CHECK completed`); return;
      default:
        this.send(`${tag} BAD Unknown command ${command}`);
    }
  }

  // ---- Command handlers ----

  cmdCapability(tag) {
    this.send('* CAPABILITY IMAP4rev1 IDLE NAMESPACE ID');
    this.send(`${tag} OK CAPABILITY completed`);
  }

  async cmdLogin(tag, args) {
    // args: username password (both possibly quoted or literal)
    const { tokens } = tokenize(args);
    if (tokens.length < 2) {
      this.send(`${tag} BAD LOGIN requires user and password`);
      return;
    }
    const password = tokens[1];

    // Verify token by calling health endpoint
    const testApi = new (await import('./api-client.js')).ApiClient(
      this.server.config.apiUrl, password
    );
    try {
      await testApi.health();
    } catch {
      this.send(`${tag} NO LOGIN failed`);
      return;
    }

    // Authenticated — override the API client for this session
    this.api = testApi;
    this.state = 'AUTHENTICATED';
    this.log('authenticated');
    this.send(`${tag} OK LOGIN completed`);
  }

  cmdLogout(tag) {
    this.send('* BYE Inboxer IMAP bridge logging out');
    this.send(`${tag} OK LOGOUT completed`);
    this.state = 'LOGOUT';
    this.socket.end();
  }

  cmdNamespace(tag) {
    if (this.state === 'NOT_AUTHENTICATED') {
      this.send(`${tag} NO Not authenticated`);
      return;
    }
    // Personal namespace "" with "/" separator
    this.send('* NAMESPACE (("" "/")) NIL NIL');
    this.send(`${tag} OK NAMESPACE completed`);
  }

  cmdId(tag) {
    this.send('* ID ("name" "Inboxer Bridge" "version" "1.0.0")');
    this.send(`${tag} OK ID completed`);
  }

  async cmdNoop(tag) {
    // Could refresh message counts here
    this.send(`${tag} OK NOOP completed`);
  }

  async cmdList(tag, args) {
    if (this.state === 'NOT_AUTHENTICATED') {
      this.send(`${tag} NO Not authenticated`);
      return;
    }

    const { tokens } = tokenize(args);
    const reference = tokens[0] || '';
    const pattern = tokens[1] || '*';

    // Special case: empty reference + empty pattern = separator query
    if (pattern === '') {
      this.send('* LIST (\\Noselect) "/" ""');
      this.send(`${tag} OK LIST completed`);
      return;
    }

    // Build mailbox list
    const mailboxes = [
      { name: 'INBOX', attrs: '' },
      { name: 'Sent', attrs: '\\Sent' },
      { name: 'Spam', attrs: '\\Junk' },
      { name: 'Archive', attrs: '\\Archive' },
      { name: 'Drafts', attrs: '\\Drafts \\Noselect' },
    ];

    // Add tag folders
    try {
      const tags = await this.api.getTags();
      for (const t of tags) {
        if (t.name === 'Spam' || t.name === 'Sent') continue;
        mailboxes.push({ name: `Tags/${t.name}`, attrs: '' });
      }
    } catch { /* skip tag folders on error */ }

    // Apply pattern filter (support * and % wildcards)
    const full = reference + pattern;
    const regex = new RegExp(
      '^' + full.replace(/[.+^${}()|[\]\\]/g, '\\$&')
               .replace(/\*/g, '.*')
               .replace(/%/g, '[^/]*') + '$',
      'i'
    );

    for (const mb of mailboxes) {
      if (regex.test(mb.name)) {
        this.send(`* LIST (${mb.attrs}) "/" ${imapQuote(mb.name)}`);
      }
    }
    this.send(`${tag} OK LIST completed`);
  }

  async cmdStatus(tag, args) {
    if (this.state === 'NOT_AUTHENTICATED') {
      this.send(`${tag} NO Not authenticated`);
      return;
    }
    const { tokens } = tokenize(args);
    const mailboxName = tokens[0] || 'INBOX';
    // Fetch messages to get counts
    try {
      const filters = mailboxToFilters(mailboxName);
      const msgs = await this.api.listAllMessages(filters);
      const unseen = msgs.filter(m => !m.is_read).length;
      this.send(`* STATUS ${imapQuote(mailboxName)} (MESSAGES ${msgs.length} UNSEEN ${unseen} UIDVALIDITY ${this.uidStore.uidValidity} UIDNEXT ${this.uidStore.mailbox(mailboxName).nextUid})`);
    } catch {
      this.send(`* STATUS ${imapQuote(mailboxName)} (MESSAGES 0 UNSEEN 0)`);
    }
    this.send(`${tag} OK STATUS completed`);
  }

  async cmdSelect(tag, args, readOnly) {
    if (this.state === 'NOT_AUTHENTICATED') {
      this.send(`${tag} NO Not authenticated`);
      return;
    }

    const { tokens } = tokenize(args);
    const mailboxName = tokens[0] || 'INBOX';
    this.log(`SELECT ${mailboxName}`);

    const filters = mailboxToFilters(mailboxName);

    try {
      const msgs = await this.api.listAllMessages(filters);

      // Sort by received_at ASC so oldest = seqNum 1
      msgs.sort((a, b) => a.received_at - b.received_at);

      // Assign UIDs
      const uuids = msgs.map(m => m.id);
      this.uidStore.assignUids(mailboxName, uuids);

      this.messages = msgs.map((m, i) => ({
        uuid: m.id,
        uid: this.uidStore.getUid(mailboxName, m.id),
        seqNum: i + 1,
        flags: m.is_read ? ['\\Seen'] : [],
        receivedAt: m.received_at,
        detail: null,   // lazy-loaded
        summary: m,      // list-level data
      }));

      this.selectedMailbox = mailboxName;
      this.readOnly = readOnly;
      this.state = 'SELECTED';

      const total = this.messages.length;
      const recent = 0;
      const unseen = this.messages.filter(m => !m.flags.includes('\\Seen')).length;
      const firstUnseen = this.messages.findIndex(m => !m.flags.includes('\\Seen'));
      const mb = this.uidStore.mailbox(mailboxName);

      this.send(`* ${total} EXISTS`);
      this.send(`* ${recent} RECENT`);
      this.send('* FLAGS (\\Seen \\Answered \\Flagged \\Deleted \\Draft)');
      this.send('* OK [PERMANENTFLAGS (\\Seen \\Deleted \\Flagged)]');
      if (firstUnseen >= 0) {
        this.send(`* OK [UNSEEN ${firstUnseen + 1}]`);
      }
      this.send(`* OK [UIDVALIDITY ${this.uidStore.uidValidity}]`);
      this.send(`* OK [UIDNEXT ${mb.nextUid}]`);
      this.send(`${tag} OK [${readOnly ? 'READ-ONLY' : 'READ-WRITE'}] SELECT completed`);
    } catch (err) {
      this.log(`SELECT error: ${err.message}`);
      this.send(`${tag} NO SELECT failed`);
    }
  }

  cmdClose(tag) {
    this.selectedMailbox = null;
    this.messages = [];
    this.state = 'AUTHENTICATED';
    this.send(`${tag} OK CLOSE completed`);
  }

  cmdExpunge(tag) {
    // We don't support real deletion; just acknowledge
    this.send(`${tag} OK EXPUNGE completed`);
  }

  async cmdFetch(tag, args, isUid) {
    if (this.state !== 'SELECTED') {
      this.send(`${tag} NO No mailbox selected`);
      return;
    }

    // Parse: <sequence-set> <fetch-items>
    const spIdx = args.indexOf(' ');
    if (spIdx === -1) { this.send(`${tag} BAD FETCH syntax error`); return; }
    const seqSetStr = args.slice(0, spIdx);
    let itemsStr = args.slice(spIdx + 1).trim();

    // Resolve sequence set
    let entries;
    if (isUid) {
      entries = this.resolveUidSet(seqSetStr);
    } else {
      const seqNums = parseSequenceSet(seqSetStr, this.messages.length);
      entries = seqNums.map(n => this.messages[n - 1]).filter(Boolean);
    }

    // Parse fetch items
    const items = parseFetchItems(itemsStr);

    for (const entry of entries) {
      await this.sendFetchResponse(entry, items, isUid);
    }

    this.send(`${tag} OK ${isUid ? 'UID ' : ''}FETCH completed`);
  }

  async sendFetchResponse(entry, items, isUid) {
    const parts = [];

    // Always include UID if this is a UID FETCH
    let needsUid = isUid;

    for (const item of items) {
      switch (item.upper) {
        case 'UID':
          needsUid = true;
          break;
        case 'FLAGS':
          parts.push(`FLAGS (${entry.flags.join(' ')})`);
          break;
        case 'INTERNALDATE':
          parts.push(`INTERNALDATE ${imapDate(entry.summary.date_header || entry.receivedAt)}`);
          break;
        case 'RFC822.SIZE': {
          const raw = await this.getEmailContent(entry);
          parts.push(`RFC822.SIZE ${Buffer.byteLength(raw, 'utf-8')}`);
          break;
        }
        case 'ENVELOPE': {
          const detail = await this.getDetail(entry);
          parts.push(`ENVELOPE ${buildEnvelope(detail)}`);
          break;
        }
        case 'BODYSTRUCTURE':
        case 'BODY': {
          if (item.section === undefined && !item.peek) {
            // BODY or BODYSTRUCTURE without section = structure
            const detail = await this.getDetail(entry);
            parts.push(`${item.upper} ${buildBodyStructure(detail)}`);
            break;
          }
          // BODY[section] or BODY.PEEK[section]
          const raw = await this.getEmailContent(entry);
          let data;
          if (item.section === '' || item.section === undefined) {
            data = raw;
          } else if (item.section.toUpperCase() === 'HEADER') {
            data = raw.split('\r\n\r\n')[0] + '\r\n\r\n';
          } else if (item.section.toUpperCase() === 'TEXT') {
            const idx = raw.indexOf('\r\n\r\n');
            data = idx >= 0 ? raw.slice(idx + 4) : '';
          } else if (item.section.toUpperCase().startsWith('HEADER.FIELDS')) {
            data = extractHeaderFields(raw, item.section);
          } else {
            data = raw;
          }
          const buf = Buffer.from(data, 'utf-8');
          const label = item.peek ? 'BODY' : 'BODY';
          const secStr = item.section !== undefined ? `[${item.originalSection || item.section}]` : '[]';
          parts.push(`${label}${secStr} {${buf.length}}\r\n${data}`);

          // BODY[] (without PEEK) should set \Seen flag
          if (!item.peek && !entry.flags.includes('\\Seen')) {
            entry.flags.push('\\Seen');
            this.api.markRead(entry.uuid).catch(() => {});
          }
          break;
        }
        case 'RFC822': {
          const raw = await this.getEmailContent(entry);
          const buf = Buffer.from(raw, 'utf-8');
          parts.push(`RFC822 {${buf.length}}\r\n${raw}`);
          if (!entry.flags.includes('\\Seen')) {
            entry.flags.push('\\Seen');
            this.api.markRead(entry.uuid).catch(() => {});
          }
          break;
        }
        case 'RFC822.HEADER': {
          const raw = await this.getEmailContent(entry);
          const hdr = raw.split('\r\n\r\n')[0] + '\r\n\r\n';
          const buf = Buffer.from(hdr, 'utf-8');
          parts.push(`RFC822.HEADER {${buf.length}}\r\n${hdr}`);
          break;
        }
        default:
          // Unknown item — skip
          break;
      }
    }

    if (needsUid && !parts.some(p => p.startsWith('UID '))) {
      parts.push(`UID ${entry.uid}`);
    }

    this.send(`* ${entry.seqNum} FETCH (${parts.join(' ')})`);
  }

  async cmdStore(tag, args, isUid) {
    if (this.state !== 'SELECTED') {
      this.send(`${tag} NO No mailbox selected`);
      return;
    }

    // Parse: <sequence-set> <store-action> <flags>
    const { tokens } = tokenize(args);
    if (tokens.length < 3) { this.send(`${tag} BAD STORE syntax error`); return; }

    const seqSetStr = tokens[0];
    const action = tokens[1].toUpperCase();
    // Remaining tokens are flags
    const flagStr = args.slice(args.indexOf(tokens[1]) + tokens[1].length).trim();
    const newFlags = extractFlags(flagStr);

    let entries;
    if (isUid) {
      entries = this.resolveUidSet(seqSetStr);
    } else {
      const seqNums = parseSequenceSet(seqSetStr, this.messages.length);
      entries = seqNums.map(n => this.messages[n - 1]).filter(Boolean);
    }

    for (const entry of entries) {
      if (action === 'FLAGS' || action === 'FLAGS.SILENT') {
        entry.flags = [...newFlags];
      } else if (action === '+FLAGS' || action === '+FLAGS.SILENT') {
        for (const f of newFlags) {
          if (!entry.flags.includes(f)) entry.flags.push(f);
        }
      } else if (action === '-FLAGS' || action === '-FLAGS.SILENT') {
        entry.flags = entry.flags.filter(f => !newFlags.includes(f));
      }

      // Sync flag changes to API
      if (newFlags.includes('\\Seen') && (action.startsWith('+') || action === 'FLAGS' || action === 'FLAGS.SILENT')) {
        this.api.markRead(entry.uuid).catch(() => {});
      }
      if (newFlags.includes('\\Deleted') && (action.startsWith('+') || action === 'FLAGS' || action === 'FLAGS.SILENT')) {
        this.api.archiveMessage(entry.uuid).catch(() => {});
      }

      // Send response unless .SILENT
      if (!action.includes('.SILENT')) {
        const uidPart = isUid ? ` UID ${entry.uid}` : '';
        this.send(`* ${entry.seqNum} FETCH (FLAGS (${entry.flags.join(' ')})${uidPart})`);
      }
    }

    this.send(`${tag} OK ${isUid ? 'UID ' : ''}STORE completed`);
  }

  async cmdSearch(tag, args, isUid) {
    if (this.state !== 'SELECTED') {
      this.send(`${tag} NO No mailbox selected`);
      return;
    }

    const criteria = args.toUpperCase().trim();
    let results = [...this.messages];

    // Simple criteria handling
    if (criteria.includes('UNSEEN') || criteria.includes('NOT SEEN')) {
      results = results.filter(m => !m.flags.includes('\\Seen'));
    }
    if (criteria.includes('SEEN')) {
      results = results.filter(m => m.flags.includes('\\Seen'));
    }
    if (criteria.includes('FLAGGED')) {
      results = results.filter(m => m.flags.includes('\\Flagged'));
    }
    if (criteria.includes('DELETED')) {
      results = results.filter(m => m.flags.includes('\\Deleted'));
    }

    const ids = results.map(m => isUid ? m.uid : m.seqNum);
    this.send(`* SEARCH ${ids.join(' ')}`);
    this.send(`${tag} OK ${isUid ? 'UID ' : ''}SEARCH completed`);
  }

  cmdIdle(tag) {
    if (this.state !== 'SELECTED') {
      this.send(`${tag} NO No mailbox selected`);
      return;
    }
    this.idling = true;
    this.idleTag = tag;
    this.send('+ idling');
  }

  // ---- Helpers ----

  resolveUidSet(setStr) {
    if (!this.messages.length) return [];
    const maxUid = Math.max(...this.messages.map(m => m.uid));
    const minUid = Math.min(...this.messages.map(m => m.uid));
    const result = [];

    for (const part of setStr.split(',')) {
      if (part.includes(':')) {
        let [a, b] = part.split(':');
        a = a === '*' ? maxUid : parseInt(a);
        b = b === '*' ? maxUid : parseInt(b);
        if (isNaN(a) || isNaN(b)) continue;
        const lo = Math.min(a, b);
        const hi = Math.max(a, b);
        for (const m of this.messages) {
          if (m.uid >= lo && m.uid <= hi) result.push(m);
        }
      } else {
        const uid = part === '*' ? maxUid : parseInt(part);
        const m = this.messages.find(m => m.uid === uid);
        if (m) result.push(m);
      }
    }

    // Deduplicate and sort by seq
    const seen = new Set();
    return result.filter(m => {
      if (seen.has(m.uid)) return false;
      seen.add(m.uid);
      return true;
    }).sort((a, b) => a.seqNum - b.seqNum);
  }

  async getDetail(entry) {
    if (entry.detail) return entry.detail;
    try {
      entry.detail = await this.api.getMessage(entry.uuid);
    } catch {
      entry.detail = entry.summary;
    }
    return entry.detail;
  }

  async getEmailContent(entry) {
    // Try raw .eml first
    if (!entry._rawEmail) {
      const raw = await this.api.getMessageRaw(entry.uuid);
      if (raw) {
        entry._rawEmail = raw.toString('utf-8');
      } else {
        // Reconstruct from API data
        const detail = await this.getDetail(entry);
        entry._rawEmail = buildRfc822(detail);
      }
    }
    return entry._rawEmail;
  }
}

// ---------------------------------------------------------------------------
// Parsing utilities
// ---------------------------------------------------------------------------

/** Tokenize an IMAP argument string respecting quotes and parens. */
function tokenize(str) {
  const tokens = [];
  let i = 0;
  while (i < str.length) {
    // Skip whitespace
    while (i < str.length && str[i] === ' ') i++;
    if (i >= str.length) break;

    if (str[i] === '"') {
      // Quoted string
      let end = i + 1;
      while (end < str.length && str[end] !== '"') {
        if (str[end] === '\\') end++; // skip escaped char
        end++;
      }
      tokens.push(str.slice(i + 1, end));
      i = end + 1;
    } else if (str[i] === '(') {
      // Parenthesized list — find matching close
      let depth = 1;
      let end = i + 1;
      while (end < str.length && depth > 0) {
        if (str[end] === '(') depth++;
        if (str[end] === ')') depth--;
        end++;
      }
      tokens.push(str.slice(i, end));
      i = end;
    } else {
      // Atom
      let end = i;
      while (end < str.length && str[end] !== ' ' && str[end] !== ')') end++;
      tokens.push(str.slice(i, end));
      i = end;
    }
  }
  return { tokens };
}

/** Parse FETCH items like "(FLAGS UID ENVELOPE)" or "BODY.PEEK[HEADER]" */
function parseFetchItems(str) {
  // Expand macros
  const upper = str.toUpperCase().trim();
  if (upper === 'ALL') str = '(FLAGS INTERNALDATE RFC822.SIZE ENVELOPE)';
  else if (upper === 'FAST') str = '(FLAGS INTERNALDATE RFC822.SIZE)';
  else if (upper === 'FULL') str = '(FLAGS INTERNALDATE RFC822.SIZE ENVELOPE BODY)';

  // Remove outer parens
  let s = str.trim();
  if (s.startsWith('(') && s.endsWith(')')) s = s.slice(1, -1);

  const items = [];
  let i = 0;
  while (i < s.length) {
    while (i < s.length && s[i] === ' ') i++;
    if (i >= s.length) break;

    let end = i;
    while (end < s.length && s[end] !== ' ') {
      if (s[end] === '[') {
        // Find matching ]
        while (end < s.length && s[end] !== ']') end++;
        if (end < s.length) end++; // skip ]
        // Check for <partial> after ]
        if (end < s.length && s[end] === '<') {
          while (end < s.length && s[end] !== '>') end++;
          if (end < s.length) end++;
        }
      } else {
        end++;
      }
    }

    const token = s.slice(i, end).trim();
    i = end;
    if (!token) continue;

    const item = { raw: token, upper: token.toUpperCase() };

    // Parse BODY[section] or BODY.PEEK[section]
    const bodyMatch = token.match(/^(BODY(?:\.PEEK)?)\[([^\]]*)\](.*)$/i);
    if (bodyMatch) {
      item.upper = 'BODY';
      item.peek = bodyMatch[1].toUpperCase().includes('PEEK');
      item.section = bodyMatch[2];
      item.originalSection = bodyMatch[2];
    } else if (item.upper === 'BODY' || item.upper === 'BODYSTRUCTURE') {
      // No section — means body structure
    }

    items.push(item);
  }

  return items;
}

/** Extract specific header fields from raw email content. */
function extractHeaderFields(raw, section) {
  // section = HEADER.FIELDS (FROM TO SUBJECT DATE)
  const m = section.match(/HEADER\.FIELDS(?:\.NOT)?\s*\(([^)]+)\)/i);
  if (!m) return raw.split('\r\n\r\n')[0] + '\r\n\r\n';

  const requestedFields = m[1].split(/\s+/).map(f => f.toLowerCase());
  const isNot = section.toUpperCase().includes('.NOT');
  const headerBlock = raw.split('\r\n\r\n')[0];
  const lines = headerBlock.split('\r\n');

  const result = [];
  let currentField = null;
  for (const line of lines) {
    if (/^\s/.test(line)) {
      // Continuation of previous header
      if (currentField) result.push(line);
    } else {
      const colonIdx = line.indexOf(':');
      if (colonIdx > 0) {
        const fieldName = line.slice(0, colonIdx).toLowerCase();
        const included = requestedFields.includes(fieldName);
        currentField = (isNot ? !included : included) ? fieldName : null;
        if (currentField) result.push(line);
      }
    }
  }
  return result.join('\r\n') + '\r\n\r\n';
}

/** Extract flags from a parenthesized flag list. */
function extractFlags(str) {
  // Could be "(\\Seen \\Deleted)" or "\\Seen"
  const inner = str.replace(/^\(/, '').replace(/\)$/, '').trim();
  return inner.split(/\s+/).filter(Boolean);
}

/** Build a simple BODYSTRUCTURE response. */
function buildBodyStructure(msg) {
  const hasText = !!msg.text_body;
  const hasHtml = !!msg.html_body;
  const textSize = Buffer.byteLength(msg.text_body || '', 'utf-8');
  const htmlSize = Buffer.byteLength(msg.html_body || '', 'utf-8');
  const textLines = (msg.text_body || '').split('\n').length;
  const htmlLines = (msg.html_body || '').split('\n').length;

  if (hasText && hasHtml) {
    return `(("text" "plain" ("charset" "utf-8") NIL NIL "7bit" ${textSize} ${textLines})("text" "html" ("charset" "utf-8") NIL NIL "7bit" ${htmlSize} ${htmlLines}) "alternative")`;
  } else if (hasHtml) {
    return `("text" "html" ("charset" "utf-8") NIL NIL "7bit" ${htmlSize} ${htmlLines})`;
  } else {
    return `("text" "plain" ("charset" "utf-8") NIL NIL "7bit" ${textSize} ${textLines})`;
  }
}

// ---------------------------------------------------------------------------
// Server
// ---------------------------------------------------------------------------

export class IMAPServer {
  constructor(config, apiClient) {
    this.config = config;
    this.api = apiClient;
    this.uidStore = new UidStore(config.dataDir);
    this.server = net.createServer(socket => this.handleConnection(socket));
  }

  handleConnection(socket) {
    new IMAPConnection(socket, this);
  }

  listen() {
    return new Promise((resolve, reject) => {
      this.server.on('error', reject);
      this.server.listen(this.config.imapPort, this.config.host, () => {
        console.log(`IMAP server listening on ${this.config.host}:${this.config.imapPort}`);
        resolve();
      });
    });
  }

  close() {
    return new Promise(resolve => this.server.close(resolve));
  }
}
