# Email Viewer - Discord-Style UI with JWT Authentication

A modern, secure email viewer with Discord-inspired UI, built with Vue 3, TailwindCSS, FlyonUI, and Cloudflare Workers.

## Features

✅ **Discord-Style UI**
- Modern top navigation bar
- Clean left sidebar with tags
- Responsive design
- Dark/Light theme support
- Inter & Lexend fonts

✅ **Secure Authentication**
- JWT-based authentication
- bcrypt password hashing
- HttpOnly cookies
- CSRF protection
- Rate limiting (5 attempts per 15 minutes)

✅ **Security Hardening**
- Secure HTTP headers (CSP, HSTS, X-Frame-Options, etc.)
- CORS protection
- Input validation
- XSS protection

✅ **Local Development**
- Docker Compose setup
- Hot reload for frontend
- Local Cloudflare Workers testing
- Redis for sessions
- PostgreSQL for data storage

## Quick Start

### Prerequisites

- Node.js 20+
- Docker & Docker Compose (for local dev)
- Cloudflare account (for deployment)

### 1. Install Dependencies

```bash
# Root dependencies
npm install

# Frontend dependencies
cd web
npm install
cd ..
```

### 2. Generate Password Hash

```bash
# Install bcryptjs
npm install -g bcryptjs-cli

# Generate password hash (replace 'your-password' with your actual password)
node -e "const bcrypt = require('bcryptjs'); bcrypt.hash('your-password', 10).then(h => console.log('PASSWORD_HASH=' + h))"
```

### 3. Configure Environment

```bash
# Copy example env file
cp .env.example .env

# Edit .env and update:
# - JWT_SECRET (generate with: openssl rand -base64 64)
# - PASSWORD_HASH (from step 2)
# - CLOUDFLARE_ACCOUNT_ID
# - CLOUDFLARE_API_TOKEN
```

### 4. Run with Docker (Recommended)

```bash
# Start all services
docker-compose up -d

# View logs
docker-compose logs -f

# Access application
# Frontend: http://localhost:5173
# With proxy: http://localhost
```

### 5. Run Without Docker

```bash
# Terminal 1: Frontend
cd web
npm run dev

# Terminal 2: API Worker
npm run dev:api

# Terminal 3: Auth Worker
npx wrangler dev workers/auth.js --port 8788

# Access at http://localhost:5173
```

## Project Structure

```
email-viewer/
├── web/                          # Frontend (Vue 3 + TailwindCSS)
│   ├── src/
│   │   ├── components/
│   │   │   ├── TopBar.vue        # Discord-style top navigation
│   │   │   ├── DiscordSidebar.vue # Discord-style left sidebar
│   │   │   ├── LoginScreen.vue   # Modern login UI
│   │   │   └── ...
│   │   ├── services/             # API clients
│   │   ├── style.css             # Global styles + Tailwind
│   │   └── App.vue
│   ├── tailwind.config.js        # Tailwind + FlyonUI config
│   └── package.json
├── workers/
│   ├── auth.js                   # JWT authentication worker
│   └── ...                       # Other Cloudflare Workers
├── docker-compose.yml            # Docker services
├── nginx.conf                    # Reverse proxy config
└── .env.example                  # Environment variables template
```

## Configuration

### JWT Secret

Generate a strong secret:
```bash
openssl rand -base64 64
```

### Password Setup

1. Choose your password
2. Generate bcrypt hash:
   ```bash
   node -e "const bcrypt = require('bcryptjs'); bcrypt.hash('YourSecurePassword123!', 10).then(console.log)"
   ```
3. Add to `.env` as `PASSWORD_HASH`

### Cloudflare Setup

1. Get Account ID: Cloudflare Dashboard → Overview
2. Create API Token: Dashboard → My Profile → API Tokens
   - Permissions: Account.Workers Scripts (Edit)
3. Add to `.env`

## Security Best Practices

### Production Checklist

- [ ] Change default JWT_SECRET
- [ ] Use strong password (12+ characters)
- [ ] Enable HTTPS/TLS
- [ ] Set secure CORS origins
- [ ] Enable rate limiting
- [ ] Use Cloudflare WAF
- [ ] Enable 2FA on Cloudflare account
- [ ] Regular security updates
- [ ] Monitor auth logs

### Environment Variables (Production)

Store sensitive values in Cloudflare Secrets:

```bash
# Set JWT secret
wrangler secret put JWT_SECRET

# Set password hash
wrangler secret put PASSWORD_HASH
```

## Development

### Run Tests

```bash
# Frontend tests
cd web
npm test

# Worker tests
npm test:workers
```

### Build for Production

```bash
# Build frontend
cd web
npm run build

# Deploy workers
npm run deploy:api
npx wrangler deploy workers/auth.js

# Deploy to Cloudflare Pages
npm run deploy:pages
```

## Troubleshooting

### "Invalid token" errors
- Check JWT_SECRET matches in all environments
- Verify token hasn't expired
- Clear browser localStorage

### "Too many attempts" errors
- Wait 15 minutes
- Or clear Redis: `docker-compose exec redis redis-cli FLUSHALL`

### Port conflicts
- Modify ports in docker-compose.yml
- Or stop conflicting services

### Login fails silently
- Check browser console for errors
- Verify auth worker is running: http://localhost:8788/auth/verify
- Check password hash is correct

## API Endpoints

### Authentication

- `POST /auth/login` - Login with password
- `GET /auth/verify` - Verify JWT token

### Email API

- `GET /api/messages` - List messages
- `GET /api/messages/:id` - Get message details
- `POST /api/messages/:id/tags` - Tag message
- `DELETE /api/messages/:id` - Delete message

## Technologies

- **Frontend**: Vue 3, TailwindCSS, FlyonUI
- **Auth**: JWT (jose), bcrypt
- **Backend**: Cloudflare Workers
- **Storage**: Cloudflare D1, R2, KV
- **Email**: Cloudflare Email Workers
- **Dev**: Docker, Nginx, Redis, PostgreSQL

## Performance

- **Frontend**: <100KB gzipped
- **API**: <50ms average response
- **Auth**: <100ms with rate limiting
- **CDN**: Global edge deployment

## Deployment

### Cloudflare Pages (Frontend)

```bash
cd web
npm run build
cd ..
npx wrangler pages deploy web/dist --project-name email-viewer
```

### Cloudflare Workers (Backend)

```bash
# Deploy API worker
npm run deploy:api

# Deploy Auth worker
npx wrangler deploy workers/auth.js --name email-auth

# Deploy Email worker
npm run deploy:email
```

## Support

- Documentation: [Cloudflare Workers](https://developers.cloudflare.com/workers/)
- Issues: Create an issue in your repository
- Security: Report security issues privately

## License

MIT

---

**Built with ❤️ using Vue 3, TailwindCSS, and Cloudflare Workers**
