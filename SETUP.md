# Setup Guide

## Initial Setup Steps

### 1. Install Dependencies

```bash
npm install
```

### 2. Create Cloudflare Resources

#### Create D1 Databases

```bash
# Production database
wrangler d1 create maildb

# Development database
wrangler d1 create maildb-dev
```

Copy the `database_id` values from the output and update `wrangler.toml`:
- Replace `placeholder` with the production database ID
- Replace `placeholder-dev` with the development database ID

#### Create R2 Buckets

```bash
# Production bucket
wrangler r2 bucket create mailstore

# Development bucket
wrangler r2 bucket create mailstore-dev
```

#### Create Queue

```bash
wrangler queues create mail-events
```

### 3. Set Secrets

```bash
# Set API token (generate a secure random token)
wrangler secret put API_TOKEN

# Set OpenAI API key
wrangler secret put OPENAI_API_KEY
```

For development, create a `.dev.vars` file in the project root:

```
API_TOKEN=your-dev-token-here
OPENAI_API_KEY=your-openai-key-here
```

### 4. Run Database Migrations

```bash
# Local development
npm run db:migrate:dev

# Production (after deploying)
npm run db:migrate:remote
```

### 5. Configure Email Routing

1. Go to Cloudflare Dashboard → Email Routing
2. Add your custom email address (e.g., `inbox@yourdomain.com`)
3. Set the destination to your worker: `mail-app-worker`

## Development Workflow

### Run Locally

```bash
npm run dev
```

This starts the Wrangler dev server with local bindings.

### Deploy to Production

```bash
# Deploy worker
npm run deploy:production

# Run migrations
npm run db:migrate:remote
```

### View Logs

```bash
npm run tail
```

## Testing

### Send Test Email

Once Email Routing is configured, send an email to your custom address:

```bash
echo "Test email body" | mail -s "Test Subject" inbox@yourdomain.com
```

### Check Health Endpoint

```bash
curl https://your-worker.workers.dev/api/health
```

### Test API with Auth

```bash
curl -H "Authorization: Bearer your-api-token" \
  https://your-worker.workers.dev/api/messages
```

## Troubleshooting

### Check D1 Database

```bash
# List all rows in messages table
wrangler d1 execute maildb --command "SELECT * FROM messages"

# Check local database
wrangler d1 execute maildb-dev --local --command "SELECT * FROM messages"
```

### Check R2 Bucket

```bash
# List objects
wrangler r2 object list mailstore

# Download a raw email
wrangler r2 object get mailstore raw/<message-id>.eml
```

### Check Queue

```bash
# Queue status
wrangler queues list
```

### View Worker Logs

```bash
# Tail production logs
wrangler tail

# Tail with filters
wrangler tail --format json
```

## Environment Variables

Required secrets (set via `wrangler secret put`):
- `API_TOKEN` - Bearer token for API authentication
- `OPENAI_API_KEY` - OpenAI API key for spam classification

Optional vars (set in `wrangler.toml`):
- `OPENAI_MODEL` - OpenAI model to use (default: `gpt-4o-mini`)

## Next Steps

After setup is complete:

1. Implement database migrations (see `migrations/` directory)
2. Complete worker implementation (see `src/` directory)
3. Build Vue.js frontend (see `web/` directory)
4. Configure GitHub Actions for CI/CD
