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
    spam_status: 'ham',
    spam_confidence: 0.05,
    spam_reason: null,
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
    spam_status: 'spam',
    spam_confidence: 0.94,
    spam_reason: 'Promotional content with excessive urgency and capitalization',
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
    spam_status: 'ham',
    spam_confidence: 0.02,
    spam_reason: null,
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
    spam_status: 'unknown',
    spam_confidence: null,
    spam_reason: null,
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

// Routes
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: Date.now() });
});

app.get('/api/messages', requireAuth, (req, res) => {
  const limit = parseInt(req.query.limit) || 50;
  const before = req.query.before ? parseInt(req.query.before) : null;
  const spamStatus = req.query.spamStatus;

  let filtered = [...messages];

  // Filter by spam status
  if (spamStatus && spamStatus !== 'all') {
    filtered = filtered.filter(m => m.spam_status === spamStatus);
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
    spamStatus: m.spam_status,
    spamConfidence: m.spam_confidence
  }));

  res.json({
    items,
    nextBefore
  });
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
    spamStatus: message.spam_status,
    spamConfidence: message.spam_confidence,
    spamReason: message.spam_reason,
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
    spam_status: 'unknown',
    spam_confidence: null,
    spam_reason: null,
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

  // Simulate spam classification after 3 seconds
  setTimeout(() => {
    const isSpam = Math.random() > 0.7;
    newMessage.spam_status = isSpam ? 'spam' : 'ham';
    newMessage.spam_confidence = Math.random();
    newMessage.spam_reason = isSpam ? 'Simulated spam detection' : null;

    eventBus.emit('broadcast', {
      type: 'message.classified',
      data: {
        messageId: newMessage.id,
        spam_status: newMessage.spam_status,
        spam_confidence: newMessage.spam_confidence,
        spam_reason: newMessage.spam_reason
      }
    });

    console.log(`[Mock] Email classified: ${newMessage.id} -> ${newMessage.spam_status}`);
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
