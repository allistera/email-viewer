/**
 * Mock API server for frontend development
 * Run with: node web/mock-server.js
 */

import express from 'express';
import cors from 'cors';
import { EventEmitter } from 'events';

const app = express();
const PORT = 8787;
const eventBus = new EventEmitter();

app.use(cors());
app.use(express.json());

// Mock auth token
const VALID_TOKEN = 'dev-token-12345';

// Auth middleware
function requireAuth(req, res, next) {
  const auth = req.headers.authorization;
  if (!auth || !auth.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  const token = auth.substring(7);
  if (token !== VALID_TOKEN) {
    return res.status(401).json({ error: 'Invalid token' });
  }
  next();
}

// Mock data
const messages = [
  {
    id: '550e8400-e29b-41d4-a716-446655440001',
    from_addr: 'alice@example.com',
    to_addr: 'me@mydomain.com',
    subject: 'Quarterly Report Ready for Review',
    snippet: 'Hi, I\'ve completed the Q4 report and attached the final PDF. Please review by Friday...',
    received_at: Date.now() - 3600000,
    has_attachments: true,
    text_body: 'Hi,\n\nI\'ve completed the Q4 report and attached the final PDF. Please review by Friday and let me know if you have any questions.\n\nBest regards,\nAlice',
    html_body: '<p>Hi,</p><p>I\'ve completed the Q4 report and attached the final PDF. Please review by Friday and let me know if you have any questions.</p><p>Best regards,<br>Alice</p>',
    tag: 'Finance',
    tag_confidence: 0.82,
    tag_reason: 'Contains report and finance-related language.',
    headers_json: JSON.stringify({
      'message-id': '<abc123@example.com>',
      'date': new Date(Date.now() - 3600000).toISOString()
    })
  },
  {
    id: '550e8400-e29b-41d4-a716-446655440002',
    from_addr: 'newsletter@marketing.biz',
    to_addr: 'me@mydomain.com',
    subject: '🎉 AMAZING OFFER - 90% OFF EVERYTHING!!!',
    snippet: 'Dear valued customer, Click here NOW to claim your exclusive discount before it expires...',
    received_at: Date.now() - 7200000,
    has_attachments: false,
    text_body: 'Dear valued customer,\n\nClick here NOW to claim your exclusive discount before it expires!\n\nThis is a limited time offer!\n\nUnsubscribe: click here',
    html_body: '<div><h1>AMAZING OFFER</h1><p>Dear valued customer,</p><p><a href="#">Click here NOW</a> to claim your exclusive discount before it expires!</p><p>This is a limited time offer!</p><p><small>Unsubscribe: <a href="#">click here</a></small></p></div>',
    tag: 'spam',
    tag_confidence: 0.94,
    tag_reason: 'Promotional content with excessive urgency and capitalization',
    headers_json: JSON.stringify({
      'message-id': '<xyz789@marketing.biz>',
      'date': new Date(Date.now() - 7200000).toISOString()
    })
  },
  {
    id: '550e8400-e29b-41d4-a716-446655440003',
    from_addr: 'bob@company.com',
    to_addr: 'me@mydomain.com',
    subject: 'Re: Meeting schedule',
    snippet: 'Thanks for setting that up. I\'ll send the calendar invite shortly...',
    received_at: Date.now() - 10800000,
    has_attachments: false,
    text_body: 'Thanks for setting that up. I\'ll send the calendar invite shortly.\n\nBob',
    html_body: '<p>Thanks for setting that up. I\'ll send the calendar invite shortly.</p><p>Bob</p>',
    tag: 'Personal',
    tag_confidence: 0.64,
    tag_reason: 'Conversational tone about meetings.',
    headers_json: JSON.stringify({
      'message-id': '<reply456@company.com>',
      'date': new Date(Date.now() - 10800000).toISOString()
    })
  },
  {
    id: '550e8400-e29b-41d4-a716-446655440004',
    from_addr: 'support@service.io',
    to_addr: 'me@mydomain.com',
    subject: 'Password Reset Request',
    snippet: 'We received a request to reset your password. If you did not make this request...',
    received_at: Date.now() - 14400000,
    has_attachments: false,
    text_body: 'We received a request to reset your password. If you did not make this request, please ignore this email.\n\nClick here to reset: https://service.io/reset?token=abc123',
    html_body: '<div><p>We received a request to reset your password. If you did not make this request, please ignore this email.</p><p><a href="https://service.io/reset?token=abc123">Click here to reset</a></p></div>',
    tag: null,
    tag_confidence: null,
    tag_reason: null,
    headers_json: JSON.stringify({
      'message-id': '<reset789@service.io>',
      'date': new Date(Date.now() - 14400000).toISOString()
    })
  }
];

const attachments = [
  {
    id: 1,
    message_id: '550e8400-e29b-41d4-a716-446655440001',
    filename: 'Q4-Report.pdf',
    content_type: 'application/pdf',
    size_bytes: 245680,
    sha256: 'abc123def456...'
  }
];

const tags = [
  { id: 'tag-1', name: 'Finance', created_at: Date.now() - 100000 },
  { id: 'tag-2', name: 'Projects/Alpha', created_at: Date.now() - 90000 },
  { id: 'tag-3', name: 'Projects/Alpha/Design', created_at: Date.now() - 80000 },
  { id: 'tag-4', name: 'Personal', created_at: Date.now() - 70000 },
  { id: 'tag-5', name: 'Spam', created_at: 0 }
];

// Routes
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: Date.now() });
});

app.get('/api/messages', requireAuth, (req, res) => {
  const limit = parseInt(req.query.limit) || 50;
  const before = req.query.before ? parseInt(req.query.before) : null;
  const tag = req.query.tag;
  const excludeTag = req.query.excludeTag;

  let filtered = [...messages];

  // Filter by tag
  if (tag) {
    filtered = filtered.filter(m => m.tag === tag || m.tag?.startsWith(`${tag}/`));
  }

  if (excludeTag) {
    filtered = filtered.filter(m => m.tag !== excludeTag);
  }

  // Filter by before timestamp
  if (before) {
    filtered = filtered.filter(m => m.received_at < before);
  }

  // Sort by received_at descending
  filtered.sort((a, b) => b.received_at - a.received_at);

  // Limit
  const results = filtered.slice(0, limit);
  const hasMore = filtered.length > limit;
  const nextBefore = hasMore ? results[results.length - 1].received_at : null;

  // Transform to match frontend expectations
  const items = results.map(m => ({
    id: m.id,
    from: m.from_addr,
    to: m.to_addr,
    subject: m.subject,
    snippet: m.snippet,
    receivedAt: m.received_at,
    hasAttachments: m.has_attachments,
    tag: m.tag,
    tagConfidence: m.tag_confidence
  }));

  res.json({
    items,
    nextBefore
  });
});

app.get('/api/tags', requireAuth, (req, res) => {
  res.json(tags);
});

app.post('/api/tags', requireAuth, (req, res) => {
  const { name } = req.body || {};
  if (!name) {
    return res.status(400).json({ error: 'Tag name is required' });
  }
  const tag = {
    id: `tag-${Date.now()}`,
    name,
    created_at: Date.now()
  };
  tags.unshift(tag);
  res.status(201).json(tag);
});

app.delete('/api/tags/:id', requireAuth, (req, res) => {
  const index = tags.findIndex(tag => tag.id === req.params.id);
  if (index === -1) {
    return res.status(404).json({ error: 'Tag not found' });
  }
  if (tags[index].name === 'Spam') {
    return res.status(400).json({ error: 'Cannot delete system tag: Spam' });
  }
  tags.splice(index, 1);
  res.json({ success: true });
});

app.get('/api/messages/:id', requireAuth, (req, res) => {
  const message = messages.find(m => m.id === req.params.id);
  if (!message) {
    return res.status(404).json({ error: 'Message not found' });
  }

  const messageAttachments = attachments.filter(a => a.message_id === req.params.id);

  // Transform to match frontend expectations
  res.json({
    id: message.id,
    from: message.from_addr,
    to: message.to_addr,
    subject: message.subject,
    snippet: message.snippet,
    receivedAt: message.received_at,
    textBody: message.text_body,
    htmlBody: message.html_body,
    hasAttachments: message.has_attachments,
    tag: message.tag,
    tagConfidence: message.tag_confidence,
    tagReason: message.tag_reason,
    headers: JSON.parse(message.headers_json),
    attachments: messageAttachments.map(a => ({
      id: a.id,
      filename: a.filename,
      contentType: a.content_type,
      sizeBytes: a.size_bytes
    }))
  });
});

app.get('/api/messages/:messageId/attachments/:attachmentId', requireAuth, (req, res) => {
  const attachment = attachments.find(a =>
    a.message_id === req.params.messageId &&
    a.id === parseInt(req.params.attachmentId)
  );

  if (!attachment) {
    return res.status(404).json({ error: 'Attachment not found' });
  }

  // Return fake PDF content
  res.setHeader('Content-Type', attachment.content_type);
  res.setHeader('Content-Disposition', `attachment; filename="${attachment.filename}"`);
  res.send(Buffer.from('%PDF-1.4 fake pdf content'));
});

app.post('/api/messages/:id/archive', requireAuth, (req, res) => {
  const messageIndex = messages.findIndex(m => m.id === req.params.id);

  if (messageIndex === -1) {
    return res.status(404).json({ error: 'Message not found' });
  }

  // Remove message from list (simulate archive)
  messages.splice(messageIndex, 1);

  console.log(`[Mock] Message archived: ${req.params.id}`);

  res.json({ success: true });
});

app.get('/api/stream', requireAuth, (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  const sendEvent = (event, data) => {
    res.write(`event: ${event}\n`);
    res.write(`data: ${JSON.stringify(data)}\n\n`);
  };

  // Send initial connection event
  sendEvent('connected', { timestamp: Date.now() });

  // Listen for broadcast events
  const handler = (event) => {
    sendEvent(event.type, event.data);
  };
  eventBus.on('broadcast', handler);

  // Cleanup on disconnect
  req.on('close', () => {
    eventBus.off('broadcast', handler);
  });
});

// Simulate receiving a new email every 30 seconds
setInterval(() => {
  const newMessage = {
    id: `550e8400-e29b-41d4-a716-${Math.random().toString(36).substr(2, 9)}`,
    from_addr: `user${Math.floor(Math.random() * 100)}@example.com`,
    to_addr: 'me@mydomain.com',
    subject: `Test Email ${new Date().toLocaleTimeString()}`,
    snippet: 'This is a simulated email for testing real-time updates...',
    received_at: Date.now(),
    has_attachments: false,
    text_body: 'This is a simulated email for testing real-time updates.',
    html_body: '<p>This is a simulated email for testing real-time updates.</p>',
    tag: null,
    tag_confidence: null,
    tag_reason: null,
    headers_json: JSON.stringify({
      'message-id': `<test${Date.now()}@example.com>`,
      'date': new Date().toISOString()
    })
  };

  messages.unshift(newMessage);

  // Broadcast to SSE clients
  eventBus.emit('broadcast', {
    type: 'message.received',
    data: { messageId: newMessage.id }
  });

  console.log(`[Mock] New email received: ${newMessage.id}`);

  // Simulate tag classification after 3 seconds
  setTimeout(() => {
    const isSpam = Math.random() > 0.7;
    newMessage.tag = isSpam ? 'spam' : 'Support';
    newMessage.tag_confidence = Math.random();
    newMessage.tag_reason = isSpam ? 'Simulated spam detection' : 'Simulated tag selection';

    eventBus.emit('broadcast', {
      type: 'message.tagged',
      data: {
        messageId: newMessage.id,
        tag: newMessage.tag,
        tagConfidence: newMessage.tag_confidence,
        tagReason: newMessage.tag_reason
      }
    });

    console.log(`[Mock] Email tagged: ${newMessage.id} -> ${newMessage.tag}`);
  }, 3000);
}, 30000);

app.listen(PORT, () => {
  console.log(`\n🎭 Mock API server running on http://localhost:${PORT}`);
  console.log(`\n📋 Mock auth token: ${VALID_TOKEN}`);
  console.log(`\nAvailable endpoints:`);
  console.log(`  GET  /api/health`);
  console.log(`  GET  /api/messages`);
  console.log(`  GET  /api/messages/:id`);
  console.log(`  GET  /api/messages/:messageId/attachments/:attachmentId`);
  console.log(`  GET  /api/stream (SSE)\n`);
  console.log(`💡 New emails will be simulated every 30 seconds\n`);
});
