# Development Quick Start

Quick reference for local development with mock data.

## 🚀 One-Command Start

```bash
# Frontend + Basic Mock Server
npm run dev:mock

# Frontend + Enhanced Mock Server
npm run dev:mock:enhanced
```

Frontend: http://localhost:5173
Mock API: http://localhost:8787
Auth Token: `dev-token-12345`

## 📦 Available Presets

| Command | Messages | Best For |
|---------|----------|----------|
| `npm run mock:minimal` | 5 | Component development |
| `npm run mock:enhanced` | 50 | General development |
| `npm run mock:large` | 500 | Performance testing |

## 🎯 Common Tasks

### Test with specific data

```bash
# Only work emails
AUTO_EMAIL_INTERVAL=0 node mock-server-enhanced.js minimal

# Then use admin API to generate work emails
curl -X POST http://localhost:8787/api/admin/generate \
  -H "Content-Type: application/json" \
  -d '{"count": 20, "category": "work"}'
```

### Test real-time features

```bash
# New email every 10 seconds
AUTO_EMAIL_INTERVAL=10000 node mock-server-enhanced.js
```

### Reset data without restart

```bash
curl -X POST http://localhost:8787/api/admin/reset \
  -H "Content-Type: application/json" \
  -d '{"preset": "minimal"}'
```

## 📚 Learn More

- **Full Guide:** [MOCK_DATA_GUIDE.md](./MOCK_DATA_GUIDE.md)
- **Custom Scenarios:** [examples/custom-mock-data.js](./examples/custom-mock-data.js)
- **Data Utilities:** [src/utils/mockData.js](./src/utils/mockData.js)

## 🧪 Testing with Playwright

```javascript
import { test } from '@playwright/test';
import { createProductManagerInbox } from './examples/custom-mock-data.js';

test.beforeEach(async ({ request }) => {
  // Reset to clean state
  await request.post('http://localhost:8787/api/admin/reset', {
    data: { preset: 'minimal' }
  });

  // Generate specific test data
  await request.post('http://localhost:8787/api/admin/generate', {
    data: { count: 10, category: 'work' }
  });
});
```

## 🔧 Environment Variables

```bash
# Custom configuration
MOCK_PORT=9000 \
MOCK_PRESET=large \
AUTO_EMAIL_INTERVAL=60000 \
node mock-server-enhanced.js
```

## 💡 Pro Tips

1. **Disable auto-emails during UI testing**
   ```bash
   AUTO_EMAIL_INTERVAL=0 npm run mock:enhanced
   ```

2. **Test pagination**
   ```bash
   npm run mock:large
   # Then use ?limit=20&before=timestamp in API calls
   ```

3. **Test different time ranges**
   ```javascript
   import { SCENARIOS } from './src/utils/mockData.js';
   const messages = SCENARIOS.mixedTimeRange(); // 30 days
   ```

4. **Monitor SSE events**
   ```javascript
   const es = new EventSource('http://localhost:8787/api/stream');
   es.onmessage = console.log;
   ```

5. **Use curl with auth**
   ```bash
   alias mockapi='curl -H "Authorization: Bearer dev-token-12345"'
   mockapi http://localhost:8787/api/messages
   ```

## 🐛 Troubleshooting

| Issue | Solution |
|-------|----------|
| Port 8787 in use | `MOCK_PORT=9000 npm run mock:enhanced` |
| 401 Unauthorized | Add header: `Authorization: Bearer dev-token-12345` |
| Slow with 500+ messages | Use `?limit=50` in API calls |
| SSE not working | Check CORS, ensure Bearer token in headers |

## 📖 API Quick Reference

```bash
# Get messages
GET /api/messages?tag=Work&limit=20

# Tag a message
POST /api/messages/:id/tag
{"tag": "Work", "confidence": 0.95}

# Create tag
POST /api/tags
{"name": "Projects/NewProject"}

# Real-time stream
GET /api/stream
```

Full API docs: [MOCK_DATA_GUIDE.md#api-endpoints](./MOCK_DATA_GUIDE.md#api-endpoints)
