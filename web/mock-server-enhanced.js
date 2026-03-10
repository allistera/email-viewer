/**
 * Enhanced Mock API Server for Email Viewer
 *
 * Features:
 * - Realistic mock data generation
 * - Multiple data presets (minimal, standard, large)
 * - SSE streaming for real-time updates
 * - Tag management (CRUD)
 * - Message tagging/untagging
 * - Search and filtering
 * - Configurable via environment variables
 *
 * Usage:
 *   node mock-server-enhanced.js [preset]
 *
 * Presets: minimal, standard, large (default: standard)
 */

import express from 'express';
import cors from 'cors';
import { EventEmitter } from 'events';
import {
  generateMessage,
  generateMessages,
  generateAttachment,
  DEV_PRESETS,
  SCENARIOS,
  DEFAULT_TAGS
} from './src/utils/mockData.js';

const app = express();
const PORT = process.env.MOCK_PORT || 8787;
const PRESET = process.argv[2] || process.env.MOCK_PRESET || 'standard';
const AUTO_EMAIL_INTERVAL = parseInt(process.env.AUTO_EMAIL_INTERVAL || '30000'); // 30s default
const eventBus = new EventEmitter();

app.use(cors());
app.use(express.json());

// Mock auth token
const VALID_TOKEN = process.env.MOCK_TOKEN || 'dev-token-12345';

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

// Initialize data based on preset
console.log(`\n🎭 Initializing mock data with preset: ${PRESET}`);
const preset = DEV_PRESETS[PRESET] || DEV_PRESETS.standard;
let messages = [...preset.messages];
let tags = [...preset.tags];
let attachments = [];

// Generate attachments for messages that have them
messages.forEach(msg => {
  if (msg.has_attachments) {
    const numAttachments = Math.floor(Math.random() * 3) + 1; // 1-3 attachments
    for (let i = 0; i < numAttachments; i++) {
      attachments.push(generateAttachment(msg.id));
    }
  }
});

console.log(`📧 Generated ${messages.length} messages`);
console.log(`🏷️  Loaded ${tags.length} tags`);
console.log(`📎 Generated ${attachments.length} attachments\n`);

// ============================================================================
// API Routes
// ============================================================================

/**
 * Health check
 */
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: Date.now(),
    preset: PRESET,
    stats: {
      messages: messages.length,
      tags: tags.length,
      attachments: attachments.length
    }
  });
});

/**
 * List messages with filtering and pagination
 */
app.get('/api/messages', requireAuth, (req, res) => {
  const limit = parseInt(req.query.limit) || 50;
  const before = req.query.before ? parseInt(req.query.before) : null;
  const tag = req.query.tag;
  const excludeTag = req.query.excludeTag;
  const search = req.query.search?.toLowerCase();
  const hasAttachments = req.query.hasAttachments === 'true';

  let filtered = [...messages];

  // Filter by tag
  if (tag) {
    filtered = filtered.filter(m => m.tag === tag || m.tag?.startsWith(`${tag}/`));
  }

  if (excludeTag) {
    filtered = filtered.filter(m => m.tag !== excludeTag);
  }

  // Filter by search term
  if (search) {
    filtered = filtered.filter(m =>
      m.subject.toLowerCase().includes(search) ||
      m.from_addr.toLowerCase().includes(search) ||
      m.snippet.toLowerCase().includes(search)
    );
  }

  // Filter by attachments
  if (hasAttachments) {
    filtered = filtered.filter(m => m.has_attachments);
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
    nextBefore,
    total: filtered.length
  });
});

/**
 * Get single message details
 */
app.get('/api/messages/:id', requireAuth, (req, res) => {
  const message = messages.find(m => m.id === req.params.id);
  if (!message) {
    return res.status(404).json({ error: 'Message not found' });
  }

  const messageAttachments = attachments.filter(a => a.message_id === req.params.id);

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

/**
 * Tag a message
 */
app.post('/api/messages/:id/tag', requireAuth, (req, res) => {
  const message = messages.find(m => m.id === req.params.id);
  if (!message) {
    return res.status(404).json({ error: 'Message not found' });
  }

  const { tag, confidence = 1.0, reason = 'Manually tagged' } = req.body;

  if (!tag) {
    return res.status(400).json({ error: 'Tag name is required' });
  }

  // Check if tag exists
  const tagExists = tags.some(t => t.name === tag);
  if (!tagExists) {
    return res.status(404).json({ error: 'Tag not found. Create it first.' });
  }

  message.tag = tag;
  message.tag_confidence = confidence;
  message.tag_reason = reason;

  // Broadcast update
  eventBus.emit('broadcast', {
    type: 'message.tagged',
    data: {
      messageId: message.id,
      tag,
      tagConfidence: confidence,
      tagReason: reason
    }
  });

  res.json({ success: true, tag, tagConfidence: confidence });
});

/**
 * Untag a message
 */
app.delete('/api/messages/:id/tag', requireAuth, (req, res) => {
  const message = messages.find(m => m.id === req.params.id);
  if (!message) {
    return res.status(404).json({ error: 'Message not found' });
  }

  message.tag = null;
  message.tag_confidence = null;
  message.tag_reason = null;

  eventBus.emit('broadcast', {
    type: 'message.untagged',
    data: { messageId: message.id }
  });

  res.json({ success: true });
});

/**
 * Archive message
 */
app.post('/api/messages/:id/archive', requireAuth, (req, res) => {
  const messageIndex = messages.findIndex(m => m.id === req.params.id);

  if (messageIndex === -1) {
    return res.status(404).json({ error: 'Message not found' });
  }

  const [archived] = messages.splice(messageIndex, 1);

  eventBus.emit('broadcast', {
    type: 'message.archived',
    data: { messageId: archived.id }
  });

  console.log(`[Mock] Message archived: ${archived.id}`);

  res.json({ success: true });
});

/**
 * Delete message permanently
 */
app.delete('/api/messages/:id', requireAuth, (req, res) => {
  const messageIndex = messages.findIndex(m => m.id === req.params.id);

  if (messageIndex === -1) {
    return res.status(404).json({ error: 'Message not found' });
  }

  const [deleted] = messages.splice(messageIndex, 1);

  eventBus.emit('broadcast', {
    type: 'message.deleted',
    data: { messageId: deleted.id }
  });

  console.log(`[Mock] Message deleted: ${deleted.id}`);

  res.json({ success: true });
});

/**
 * Download attachment
 */
app.get('/api/messages/:messageId/attachments/:attachmentId', requireAuth, (req, res) => {
  const attachment = attachments.find(a =>
    a.message_id === req.params.messageId &&
    a.id === parseInt(req.params.attachmentId)
  );

  if (!attachment) {
    return res.status(404).json({ error: 'Attachment not found' });
  }

  // Return mock file content based on type
  res.setHeader('Content-Type', attachment.content_type);
  res.setHeader('Content-Disposition', `attachment; filename="${attachment.filename}"`);

  if (attachment.content_type.includes('pdf')) {
    res.send(Buffer.from('%PDF-1.4 Mock PDF content for testing'));
  } else if (attachment.content_type.includes('image')) {
    // Tiny 1x1 transparent PNG
    res.send(Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==', 'base64'));
  } else {
    res.send(Buffer.from(`Mock ${attachment.filename} content`));
  }
});

/**
 * List tags
 */
app.get('/api/tags', requireAuth, (req, res) => {
  res.json(tags);
});

/**
 * Create tag
 */
app.post('/api/tags', requireAuth, (req, res) => {
  const { name } = req.body || {};
  if (!name) {
    return res.status(400).json({ error: 'Tag name is required' });
  }

  // Check for duplicate
  if (tags.some(t => t.name === name)) {
    return res.status(409).json({ error: 'Tag already exists' });
  }

  const tag = {
    id: `tag-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
    name,
    created_at: Date.now()
  };

  tags.unshift(tag);

  eventBus.emit('broadcast', {
    type: 'tag.created',
    data: tag
  });

  console.log(`[Mock] Tag created: ${name}`);

  res.status(201).json(tag);
});

/**
 * Update tag
 */
app.put('/api/tags/:id', requireAuth, (req, res) => {
  const tag = tags.find(t => t.id === req.params.id);
  if (!tag) {
    return res.status(404).json({ error: 'Tag not found' });
  }

  const { name } = req.body;
  if (!name) {
    return res.status(400).json({ error: 'Tag name is required' });
  }

  const oldName = tag.name;
  tag.name = name;

  // Update all messages with this tag
  messages.forEach(m => {
    if (m.tag === oldName) {
      m.tag = name;
    }
  });

  eventBus.emit('broadcast', {
    type: 'tag.updated',
    data: { id: tag.id, oldName, newName: name }
  });

  console.log(`[Mock] Tag updated: ${oldName} → ${name}`);

  res.json(tag);
});

/**
 * Delete tag
 */
app.delete('/api/tags/:id', requireAuth, (req, res) => {
  const index = tags.findIndex(t => t.id === req.params.id);
  if (index === -1) {
    return res.status(404).json({ error: 'Tag not found' });
  }

  // Prevent deletion of system tag
  if (tags[index].name === 'spam') {
    return res.status(400).json({ error: 'Cannot delete system tag: spam' });
  }

  const [deleted] = tags.splice(index, 1);

  // Untag all messages with this tag
  messages.forEach(m => {
    if (m.tag === deleted.name) {
      m.tag = null;
      m.tag_confidence = null;
      m.tag_reason = null;
    }
  });

  eventBus.emit('broadcast', {
    type: 'tag.deleted',
    data: { id: deleted.id, name: deleted.name }
  });

  console.log(`[Mock] Tag deleted: ${deleted.name}`);

  res.json({ success: true });
});

/**
 * Server-Sent Events stream for real-time updates
 */
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
    console.log('[Mock] SSE client disconnected');
  });
});

/**
 * Admin endpoints for testing
 */

// Reset data to preset
app.post('/api/admin/reset', (req, res) => {
  const newPreset = req.body.preset || PRESET;
  const data = DEV_PRESETS[newPreset] || DEV_PRESETS.standard;

  messages = [...data.messages];
  tags = [...data.tags];
  attachments = [];

  messages.forEach(msg => {
    if (msg.has_attachments) {
      const numAttachments = Math.floor(Math.random() * 3) + 1;
      for (let i = 0; i < numAttachments; i++) {
        attachments.push(generateAttachment(msg.id));
      }
    }
  });

  console.log(`\n[Mock] Data reset to preset: ${newPreset}`);
  console.log(`📧 ${messages.length} messages`);
  console.log(`🏷️  ${tags.length} tags`);
  console.log(`📎 ${attachments.length} attachments\n`);

  res.json({ success: true, preset: newPreset });
});

// Generate and add new messages
app.post('/api/admin/generate', (req, res) => {
  const count = parseInt(req.body.count) || 10;
  const category = req.body.category; // optional

  const newMessages = Array.from({ length: count }, () =>
    generateMessage(category ? { category } : {})
  );

  messages.unshift(...newMessages);

  // Generate attachments for new messages
  newMessages.forEach(msg => {
    if (msg.has_attachments) {
      const numAttachments = Math.floor(Math.random() * 3) + 1;
      for (let i = 0; i < numAttachments; i++) {
        attachments.push(generateAttachment(msg.id));
      }
    }
  });

  console.log(`[Mock] Generated ${count} new messages`);

  res.json({
    success: true,
    generated: count,
    total: messages.length
  });
});

// ============================================================================
// Auto-generate emails for testing
// ============================================================================

if (AUTO_EMAIL_INTERVAL > 0) {
  setInterval(() => {
    const newMessage = generateMessage();
    messages.unshift(newMessage);

    // Broadcast to SSE clients
    eventBus.emit('broadcast', {
      type: 'message.received',
      data: {
        messageId: newMessage.id,
        from: newMessage.from_addr,
        subject: newMessage.subject
      }
    });

    console.log(`[Mock] 📧 New email: ${newMessage.from_addr} - ${newMessage.subject}`);

    // Simulate tag classification after 2-5 seconds
    setTimeout(() => {
      if (newMessage.tag) {
        eventBus.emit('broadcast', {
          type: 'message.tagged',
          data: {
            messageId: newMessage.id,
            tag: newMessage.tag,
            tagConfidence: newMessage.tag_confidence,
            tagReason: newMessage.tag_reason
          }
        });

        console.log(`[Mock] 🏷️  Tagged: ${newMessage.tag} (${(newMessage.tag_confidence * 100).toFixed(0)}%)`);
      }
    }, Math.random() * 3000 + 2000);
  }, AUTO_EMAIL_INTERVAL);
}

// ============================================================================
// Start server
// ============================================================================

app.listen(PORT, () => {
  console.log(`\n🎭 Enhanced Mock API Server`);
  console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
  console.log(`\n🌐 Server: http://localhost:${PORT}`);
  console.log(`🔑 Token:  ${VALID_TOKEN}`);
  console.log(`📦 Preset: ${PRESET}`);
  console.log(`📊 Stats:  ${messages.length} messages, ${tags.length} tags`);

  if (AUTO_EMAIL_INTERVAL > 0) {
    console.log(`⏰ Auto:   New email every ${AUTO_EMAIL_INTERVAL / 1000}s`);
  } else {
    console.log(`⏰ Auto:   Disabled`);
  }

  console.log(`\n📋 Endpoints:`);
  console.log(`  GET    /api/health`);
  console.log(`  GET    /api/messages`);
  console.log(`  GET    /api/messages/:id`);
  console.log(`  POST   /api/messages/:id/tag`);
  console.log(`  DELETE /api/messages/:id/tag`);
  console.log(`  POST   /api/messages/:id/archive`);
  console.log(`  DELETE /api/messages/:id`);
  console.log(`  GET    /api/messages/:messageId/attachments/:attachmentId`);
  console.log(`  GET    /api/tags`);
  console.log(`  POST   /api/tags`);
  console.log(`  PUT    /api/tags/:id`);
  console.log(`  DELETE /api/tags/:id`);
  console.log(`  GET    /api/stream (SSE)`);
  console.log(`\n🔧 Admin:`);
  console.log(`  POST   /api/admin/reset`);
  console.log(`  POST   /api/admin/generate`);
  console.log(`\n💡 Tip: Use MOCK_PRESET env var to change data (minimal/standard/large)`);
  console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);
});
