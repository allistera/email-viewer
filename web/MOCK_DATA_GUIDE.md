# Mock Data System Guide

Complete guide to using the mock data system for local frontend development of the Email Viewer application.

## Table of Contents

- [Quick Start](#quick-start)
- [Mock Server](#mock-server)
- [Mock Data Utilities](#mock-data-utilities)
- [Testing Scenarios](#testing-scenarios)
- [API Endpoints](#api-endpoints)
- [Environment Variables](#environment-variables)
- [Examples](#examples)

## Quick Start

### Start with Basic Mock Server

```bash
# Terminal 1: Start mock API server (standard preset)
npm run mock

# Terminal 2: Start frontend dev server
npm run dev
```

### Start with Enhanced Mock Server

```bash
# Standard preset (50 messages)
node mock-server-enhanced.js

# Minimal preset (5 messages)
node mock-server-enhanced.js minimal

# Large preset (500 messages for stress testing)
node mock-server-enhanced.js large
```

### All-in-One Development

```bash
# Start both mock server and frontend
npm run dev:mock
```

## Mock Server

### Features

The enhanced mock server (`mock-server-enhanced.js`) provides:

✅ **Realistic Data Generation**
- Auto-generated emails with realistic subjects, bodies, and metadata
- Multiple email categories: work, personal, newsletter, promotional, notification
- Random tags with confidence scores
- Attachments with various file types

✅ **Real-time Updates**
- Server-Sent Events (SSE) for live updates
- Auto-generation of new emails every 30 seconds (configurable)
- Broadcast events for tag changes, archives, deletions

✅ **Complete CRUD Operations**
- Create, read, update, delete tags
- Tag/untag messages
- Archive and delete messages
- Download attachments

✅ **Advanced Filtering**
- Filter by tag
- Search by subject, sender, or snippet
- Filter by attachment presence
- Pagination with cursors

✅ **Developer Tools**
- Admin endpoints to reset data
- Generate bulk messages on demand
- Health check endpoint with stats
- Configurable via environment variables

### Presets

| Preset | Messages | Use Case |
|--------|----------|----------|
| `minimal` | 5 | Quick testing, component development |
| `standard` | 50 | Normal development workflow |
| `large` | 500 | Performance testing, stress testing |

### Running with Custom Configuration

```bash
# Use environment variables
MOCK_PORT=9000 MOCK_PRESET=large AUTO_EMAIL_INTERVAL=60000 node mock-server-enhanced.js

# Or inline preset argument
node mock-server-enhanced.js large
```

## Mock Data Utilities

Located in `src/utils/mockData.js`, these utilities help you generate custom test data.

### Generate Single Message

```javascript
import { generateMessage } from './src/utils/mockData.js';

// Random message
const msg = generateMessage();

// Work email
const workEmail = generateMessage({ category: 'work' });

// Email with attachments
const withAttachment = generateMessage({ hasAttachments: true });

// Custom sender
const fromBoss = generateMessage({
  category: 'work',
  from: 'boss@company.com',
  subject: 'Urgent: Budget Review'
});
```

### Generate Bulk Messages

```javascript
import { generateMessages } from './src/utils/mockData.js';

// 100 random messages
const messages = generateMessages(100);

// 50 promotional emails
const promos = generateMessages(50, { category: 'promotional' });

// Recent emails (last hour)
const recent = generateMessages(20, {
  receivedAt: Date.now() - 3600000
});
```

### Use Predefined Scenarios

```javascript
import { SCENARIOS } from './src/utils/mockData.js';

// High volume inbox (200 messages)
const highVolume = SCENARIOS.highVolume();

// All spam
const spam = SCENARIOS.allSpam();

// Work emails only
const work = SCENARIOS.workOnly();

// All with attachments
const withFiles = SCENARIOS.withAttachments();

// Untagged emails
const untagged = SCENARIOS.untagged();
```

### Development Presets

```javascript
import { DEV_PRESETS } from './src/utils/mockData.js';

// Minimal setup
const { messages, tags } = DEV_PRESETS.minimal;

// Standard setup
const { messages, tags } = DEV_PRESETS.standard;

// Large dataset
const { messages, tags } = DEV_PRESETS.large;

// Custom scenario
const custom = DEV_PRESETS.custom('highVolume', ['Work', 'Finance']);
```

### Generate Attachments

```javascript
import { generateAttachment } from './src/utils/mockData.js';

const messageId = '550e8400-e29b-41d4-a716-446655440001';
const attachment = generateAttachment(messageId);

// Result:
// {
//   id: 12345,
//   message_id: '550e8400-e29b-41d4-a716-446655440001',
//   filename: 'report-q2-2026.pdf',
//   content_type: 'application/pdf',
//   size_bytes: 245680,
//   sha256: 'abc123...'
// }
```

### Generate Email Addresses

```javascript
import { generateEmail } from './src/utils/mockData.js';

const email = generateEmail();
// Example: alice.johnson@company.com
```

### Generate Tags

```javascript
import { generateTag, TAG_CATEGORIES } from './src/utils/mockData.js';

const { tag, confidence, reason } = generateTag();
// Example:
// {
//   tag: 'Work',
//   confidence: 0.87,
//   reason: 'Professional language and business context'
// }

// Available categories with weights
console.log(TAG_CATEGORIES);
```

## Testing Scenarios

### Scenario 1: Empty Inbox

```javascript
// In mock server, start with empty data
let messages = [];
let tags = DEFAULT_TAGS;
```

### Scenario 2: Spam-Heavy Inbox

```bash
# Use admin endpoint
curl -X POST http://localhost:8787/api/admin/generate \
  -H "Content-Type: application/json" \
  -d '{"count": 50, "category": "promotional"}'
```

### Scenario 3: Work-Only Inbox

```javascript
import { generateMessages } from './src/utils/mockData.js';

const messages = generateMessages(30, { category: 'work' });
```

### Scenario 4: High Volume (Performance Testing)

```bash
# Start with large preset
node mock-server-enhanced.js large

# Or generate more
curl -X POST http://localhost:8787/api/admin/generate \
  -H "Content-Type: application/json" \
  -d '{"count": 1000}'
```

### Scenario 5: Real-time Testing

```bash
# Auto-generate emails every 10 seconds
AUTO_EMAIL_INTERVAL=10000 node mock-server-enhanced.js
```

### Scenario 6: Mixed Time Ranges

```javascript
import { SCENARIOS } from './src/utils/mockData.js';

const messages = SCENARIOS.mixedTimeRange(); // Last 30 days
```

## API Endpoints

### Authentication

All endpoints (except `/api/health`) require a Bearer token:

```bash
Authorization: Bearer dev-token-12345
```

### Messages

#### List Messages

```http
GET /api/messages?limit=50&tag=Work&search=budget
```

Query parameters:
- `limit` - Max results (default: 50)
- `before` - Cursor for pagination (timestamp)
- `tag` - Filter by tag name
- `excludeTag` - Exclude tag name
- `search` - Search in subject/sender/snippet
- `hasAttachments` - Filter by attachment presence (true/false)

Response:
```json
{
  "items": [...],
  "nextBefore": 1234567890,
  "total": 150
}
```

#### Get Message Details

```http
GET /api/messages/:id
```

#### Tag Message

```http
POST /api/messages/:id/tag
Content-Type: application/json

{
  "tag": "Work",
  "confidence": 0.95,
  "reason": "Work-related keywords detected"
}
```

#### Untag Message

```http
DELETE /api/messages/:id/tag
```

#### Archive Message

```http
POST /api/messages/:id/archive
```

#### Delete Message

```http
DELETE /api/messages/:id
```

#### Download Attachment

```http
GET /api/messages/:messageId/attachments/:attachmentId
```

### Tags

#### List Tags

```http
GET /api/tags
```

#### Create Tag

```http
POST /api/tags
Content-Type: application/json

{
  "name": "Projects/NewProject"
}
```

#### Update Tag

```http
PUT /api/tags/:id
Content-Type: application/json

{
  "name": "Projects/RenamedProject"
}
```

#### Delete Tag

```http
DELETE /api/tags/:id
```

### Real-time Updates (SSE)

```http
GET /api/stream
```

Event types:
- `connected` - Initial connection
- `message.received` - New email received
- `message.tagged` - Email tagged
- `message.untagged` - Tag removed
- `message.archived` - Email archived
- `message.deleted` - Email deleted
- `tag.created` - New tag created
- `tag.updated` - Tag renamed
- `tag.deleted` - Tag deleted

### Admin Endpoints

#### Reset Data

```http
POST /api/admin/reset
Content-Type: application/json

{
  "preset": "minimal"
}
```

#### Generate Messages

```http
POST /api/admin/generate
Content-Type: application/json

{
  "count": 100,
  "category": "work"
}
```

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `MOCK_PORT` | 8787 | Server port |
| `MOCK_TOKEN` | dev-token-12345 | Auth token |
| `MOCK_PRESET` | standard | Data preset (minimal/standard/large) |
| `AUTO_EMAIL_INTERVAL` | 30000 | Auto-generate interval in ms (0 to disable) |

## Examples

### Example 1: Test Tag Filtering

```bash
# Start server
node mock-server-enhanced.js

# Get Work emails
curl -H "Authorization: Bearer dev-token-12345" \
  "http://localhost:8787/api/messages?tag=Work"

# Get non-spam emails
curl -H "Authorization: Bearer dev-token-12345" \
  "http://localhost:8787/api/messages?excludeTag=spam"
```

### Example 2: Test Search

```bash
# Search for "budget"
curl -H "Authorization: Bearer dev-token-12345" \
  "http://localhost:8787/api/messages?search=budget"
```

### Example 3: Test Real-time Updates

```javascript
// Frontend code
const eventSource = new EventSource('http://localhost:8787/api/stream', {
  headers: {
    Authorization: 'Bearer dev-token-12345'
  }
});

eventSource.addEventListener('message.received', (e) => {
  const data = JSON.parse(e.data);
  console.log('New email:', data);
});

eventSource.addEventListener('message.tagged', (e) => {
  const data = JSON.parse(e.data);
  console.log('Email tagged:', data);
});
```

### Example 4: Custom Test Data

```javascript
// Create custom test file
import { generateMessages, DEFAULT_TAGS } from './src/utils/mockData.js';

// Generate specific scenario
const messages = [
  ...generateMessages(10, { category: 'work' }),
  ...generateMessages(5, { category: 'personal' }),
  ...generateMessages(20, { category: 'promotional' }),
];

const tags = DEFAULT_TAGS.filter(t =>
  ['Work', 'Personal', 'spam'].includes(t.name)
);

export { messages, tags };
```

### Example 5: Performance Testing

```bash
# Generate large dataset
node mock-server-enhanced.js large

# Monitor performance
curl -H "Authorization: Bearer dev-token-12345" \
  "http://localhost:8787/api/messages?limit=100"

# Test pagination
curl -H "Authorization: Bearer dev-token-12345" \
  "http://localhost:8787/api/messages?limit=50&before=1234567890"
```

### Example 6: Test Drag-and-Drop Tagging

```bash
# 1. Get message list
curl -H "Authorization: Bearer dev-token-12345" \
  "http://localhost:8787/api/messages?limit=10"

# 2. Tag a message
curl -X POST \
  -H "Authorization: Bearer dev-token-12345" \
  -H "Content-Type: application/json" \
  -d '{"tag": "Work", "confidence": 1.0, "reason": "Manually tagged"}' \
  "http://localhost:8787/api/messages/550e8400-e29b-41d4-a716-446655440001/tag"

# 3. Verify via SSE stream (in browser console)
const es = new EventSource('http://localhost:8787/api/stream');
es.addEventListener('message.tagged', console.log);
```

## Tips

1. **Use minimal preset for rapid component development**
   ```bash
   node mock-server-enhanced.js minimal
   ```

2. **Disable auto-emails when testing specific scenarios**
   ```bash
   AUTO_EMAIL_INTERVAL=0 node mock-server-enhanced.js
   ```

3. **Reset data without restarting**
   ```bash
   curl -X POST http://localhost:8787/api/admin/reset \
     -H "Content-Type: application/json" \
     -d '{"preset": "minimal"}'
   ```

4. **Generate specific email types on demand**
   ```bash
   curl -X POST http://localhost:8787/api/admin/generate \
     -H "Content-Type: application/json" \
     -d '{"count": 10, "category": "work"}'
   ```

5. **Monitor server in verbose mode**
   ```bash
   DEBUG=* node mock-server-enhanced.js
   ```

6. **Use different ports for multiple instances**
   ```bash
   MOCK_PORT=8788 node mock-server-enhanced.js minimal
   ```

## Troubleshooting

### Issue: 401 Unauthorized

**Solution:** Include the Bearer token in requests:
```bash
curl -H "Authorization: Bearer dev-token-12345" http://localhost:8787/api/messages
```

### Issue: CORS errors

**Solution:** The mock server has CORS enabled by default. If issues persist, check your frontend proxy configuration.

### Issue: SSE connection drops

**Solution:** This is normal behavior. The frontend should auto-reconnect. Check browser console for reconnection attempts.

### Issue: Slow performance with large dataset

**Solution:**
- Use pagination (`limit` parameter)
- Use the `minimal` preset for development
- Consider filtering (`tag`, `search` parameters)

### Issue: Auto-emails not generating

**Solution:** Check `AUTO_EMAIL_INTERVAL` environment variable. Set to > 0 to enable:
```bash
AUTO_EMAIL_INTERVAL=30000 node mock-server-enhanced.js
```

## Next Steps

- Explore the mock data utilities in `src/utils/mockData.js`
- Create custom scenarios for your specific testing needs
- Integrate with your E2E tests (Playwright)
- Add custom email templates to the generators
- Extend the mock server with additional endpoints

## Support

For issues or questions:
1. Check this guide
2. Review `src/utils/mockData.js` for available utilities
3. Check `mock-server-enhanced.js` for API implementation
4. Create a GitHub issue if problems persist
