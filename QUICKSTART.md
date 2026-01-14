# Email Inbox App - Quick Start Guide

## 🚀 Get Started in 5 Minutes

### Prerequisites
- Node.js 18+
- Cloudflare account (Workers paid plan)
- OpenAI API key

### Step 1: Clone & Install
```bash
cd /path/to/email
npm install
cd web && npm install && cd ..
```

### Step 2: Create Cloudflare Resources
```bash
# Create D1 database
wrangler d1 create maildb
# Copy the database_id and update wrangler.toml

# Create R2 bucket
wrangler r2 bucket create mailstore

# Create queue
wrangler queues create mail-events

# Create Pages project
wrangler pages project create mail-app
```

### Step 3: Set Secrets

**Local Development** (create `.dev.vars` file):
```
API_TOKEN=your-secret-token-here
OPENAI_API_KEY=sk-your-openai-key-here
```

**Production**:
```bash
wrangler secret put API_TOKEN
wrangler secret put OPENAI_API_KEY
```

### Step 4: Update Configuration

Edit `wrangler.toml` and replace `placeholder` with your actual D1 database ID:
```toml
[[d1_databases]]
binding = "DB"
database_name = "maildb"
database_id = "your-actual-database-id-here"  # ← Update this
```

### Step 5: Run Migrations
```bash
# Local
npm run db:migrate:dev

# Production (after deploying)
npm run db:migrate:remote
```

### Step 6: Local Development
```bash
# Terminal 1: Start worker
npm run dev

# Terminal 2: Start frontend
npm run dev:web

# Open http://localhost:5173
```

### Step 7: Deploy to Production
```bash
# Deploy worker
npm run deploy:production

# Deploy frontend to Cloudflare Pages
npm run deploy:pages
```

### Step 8: Configure GitHub Actions (Optional)

Add secrets to GitHub repository:
- `CLOUDFLARE_API_TOKEN` - From Cloudflare dashboard
- `CLOUDFLARE_ACCOUNT_ID` - From Cloudflare dashboard

Push to `main` branch to trigger automatic deployment.

### Step 9: Configure Email Routing

1. Go to Cloudflare Dashboard → Email Routing
2. Add your domain
3. Create custom email address (e.g., `inbox@yourdomain.com`)
4. Set destination: `mail-app-worker` (your worker)

### Step 10: Test!

1. Send an email to your configured address
2. Open the web UI
3. Enter your API token
4. Watch as the email appears and gets spam-classified in real-time!

## 📝 Common Commands

```bash
# Development
npm run dev              # Start worker locally
npm run dev:web          # Start frontend dev server

# Deployment
npm run deploy           # Deploy worker
npm run deploy:pages     # Deploy frontend to Pages

# Database
npm run db:migrate:dev   # Run migrations locally
npm run db:migrate       # Run migrations on remote DB

# Monitoring
npm run tail             # Watch worker logs
wrangler d1 execute maildb --command "SELECT * FROM messages LIMIT 10"
```

## 🔧 Troubleshooting

### Worker not receiving emails
- Check Email Routing configuration in Cloudflare dashboard
- Verify worker name matches destination
- Check worker logs: `npm run tail`

### Auth not working
- Verify `API_TOKEN` is set correctly
- Check browser console for errors
- Try clearing localStorage and re-entering token

### Database errors
- Ensure migrations have been run
- Verify database ID in wrangler.toml
- Check D1 dashboard for database status

### Build errors
- Run `npm install` in root and `web/` directory
- Clear node_modules and reinstall
- Verify Node.js version (18+)

## 📚 Additional Resources

- [Full Setup Guide](SETUP.md)
- [Implementation Details](IMPLEMENTATION_COMPLETE.md)
- [TODO List](TODO.md)
- [Deployment Guide](.github/DEPLOYMENT.md)

## 🎯 What's Next?

- Test with various email types (HTML, attachments, etc.)
- Monitor spam classification accuracy
- Customize Todoist colors in `web/src/style.css`
- Add custom domain to Pages deployment
- Enable GitHub Actions for auto-deploy

---

**Need Help?** Check the full documentation or open an issue!
