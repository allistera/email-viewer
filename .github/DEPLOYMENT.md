# GitHub Actions Deployment Setup

## Required GitHub Secrets

Before the workflow can run successfully, configure these secrets in your repository:

1. Go to your GitHub repository
2. Navigate to **Settings → Secrets and variables → Actions**
3. Click **New repository secret** and add each of the following:

### Cloudflare API Token

**Name:** `CLOUDFLARE_API_TOKEN`

**How to get:**
1. Go to [Cloudflare Dashboard](https://dash.cloudflare.com/profile/api-tokens)
2. Click **Create Token**
3. Use the **Edit Cloudflare Workers** template
4. Add these permissions:
   - Account - Cloudflare Pages - Edit
   - Account - D1 - Edit
   - Zone - Workers Routes - Edit
   - Account - Workers Scripts - Edit
5. Click **Continue to summary** → **Create Token**
6. Copy the token and save it as a GitHub secret

### Cloudflare Account ID

**Name:** `CLOUDFLARE_ACCOUNT_ID`

**How to get:**
1. Go to [Cloudflare Dashboard](https://dash.cloudflare.com)
2. Select any domain (or Workers & Pages)
3. Your Account ID is shown in the right sidebar
4. Copy and save it as a GitHub secret

## Workflow Overview

The deployment workflow (`.github/workflows/deploy.yml`) consists of 3 jobs:

### 1. Lint Job
- Runs ESLint on worker code
- Fails fast if linting errors are found
- Both deploy jobs wait for this to pass

### 2. Deploy Worker Job
- Deploys the Cloudflare Worker
- Runs D1 database migrations
- Verifies deployment with health check
- Depends on: lint job passing

### 3. Deploy Pages Job
- Builds the Vue.js frontend
- Deploys to Cloudflare Pages
- Depends on: lint job passing
- Runs in parallel with worker deployment

## First-Time Setup

### 1. Create Cloudflare Resources

Before the first deployment, create the required resources:

```bash
# Create D1 database
wrangler d1 create maildb

# Create R2 bucket
wrangler r2 bucket create mailstore

# Create Queue
wrangler queues create mail-events

# Create Pages project
wrangler pages project create mail-app
```

Update `wrangler.toml` with the actual database_id from the D1 creation output.

### 2. Set Worker Secrets

```bash
# Set API token
wrangler secret put API_TOKEN

# Set OpenAI API key
wrangler secret put OPENAI_API_KEY
```

### 3. Push to GitHub

Once secrets are configured in GitHub, push to the `main` branch:

```bash
git add .
git commit -m "feat: initial project setup"
git push origin main
```

The workflow will automatically trigger and deploy both the worker and Pages app.

## Manual Deployment

You can also trigger the workflow manually:

1. Go to **Actions** tab in your GitHub repository
2. Select **Deploy to Cloudflare** workflow
3. Click **Run workflow**
4. Select the branch and click **Run workflow**

## Troubleshooting

### Workflow fails on "Deploy to Cloudflare Workers"

- Verify `CLOUDFLARE_API_TOKEN` has the correct permissions
- Verify `CLOUDFLARE_ACCOUNT_ID` is correct
- Check that resources (D1, R2, Queue) exist
- Check wrangler.toml has correct database_id

### Workflow fails on "Run D1 Migrations"

- Ensure migration files exist in `migrations/` directory
- Check database name in wrangler.toml matches actual database
- Verify the database was created successfully

### Workflow fails on "Deploy to Cloudflare Pages"

- Ensure Pages project `mail-app` exists
- Verify API token has Cloudflare Pages Edit permission
- Check that web/package.json and dependencies are correct

### Health check fails

- Wait a few more seconds (increase sleep time in workflow)
- Check the worker URL is correct in the workflow
- View worker logs: `wrangler tail`

## Monitoring Deployments

### View Worker Logs

```bash
wrangler tail
```

### View Pages Deployment

```bash
wrangler pages deployment list --project-name mail-app
```

### Check D1 Database

```bash
wrangler d1 execute maildb --command "SELECT COUNT(*) FROM messages"
```

## Production Checklist

Before deploying to production:

- [ ] All secrets configured in GitHub
- [ ] Cloudflare resources created (D1, R2, Queue, Pages project)
- [ ] Database ID updated in wrangler.toml
- [ ] Worker secrets set (API_TOKEN, OPENAI_API_KEY)
- [ ] Email Routing configured (if ready)
- [ ] Custom domain configured (optional)
- [ ] Test deployment successful on dev environment
