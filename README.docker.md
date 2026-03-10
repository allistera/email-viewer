# Docker Development Setup

## Quick Start

1. **Copy environment variables:**
   ```bash
   cp .env.example .env
   ```

2. **Generate password hash:**
   ```bash
   # Install bcryptjs if needed
   npm install -g bcryptjs-cli

   # Generate hash for your password
   node -e "const bcrypt = require('bcryptjs'); bcrypt.hash('your-password', 10).then(console.log)"

   # Copy the output to PASSWORD_HASH in .env
   ```

3. **Update .env file with your values:**
   - `JWT_SECRET`: Generate a strong random secret
   - `PASSWORD_HASH`: Use the hash from step 2
   - `CLOUDFLARE_ACCOUNT_ID` and `CLOUDFLARE_API_TOKEN`: From Cloudflare dashboard

4. **Start all services:**
   ```bash
   docker-compose up -d
   ```

5. **View logs:**
   ```bash
   docker-compose logs -f
   ```

6. **Access the application:**
   - Frontend: http://localhost:5173
   - API: http://localhost:8787
   - Auth API: http://localhost:8788
   - With Nginx proxy: http://localhost

## Services

### Frontend (Port 5173)
Vue 3 + Vite development server with hot reload

### Workers API (Port 8787)
Cloudflare Workers API for email operations

### Auth Worker (Port 8788)
JWT authentication service with:
- bcrypt password hashing
- Rate limiting
- CSRF protection
- Secure HTTP headers

### Redis (Port 6379)
Session storage and rate limiting

### PostgreSQL (Port 5432)
Database for email storage (optional)

### Nginx (Ports 80/443)
Reverse proxy with:
- Rate limiting
- Security headers
- SSL/TLS support (when configured)

## Common Commands

```bash
# Start services
docker-compose up -d

# Stop services
docker-compose down

# Rebuild containers
docker-compose up -d --build

# View logs
docker-compose logs -f [service-name]

# Access container shell
docker-compose exec [service-name] sh

# Reset all data
docker-compose down -v

# Run tests
docker-compose exec frontend npm test
```

## Security Best Practices

1. **Never commit .env file** - Already in .gitignore
2. **Use strong JWT secrets** - Generate with: `openssl rand -base64 64`
3. **Change default passwords** - Update all passwords in .env
4. **Enable HTTPS in production** - Uncomment SSL section in nginx.conf
5. **Keep dependencies updated** - Regularly run `npm audit fix`

## Troubleshooting

### Port conflicts
If ports are already in use, modify the port mappings in docker-compose.yml

### Permission issues
```bash
sudo chown -R $USER:$USER .
```

### Container won't start
```bash
docker-compose logs [service-name]
docker-compose restart [service-name]
```

### Clear Docker cache
```bash
docker system prune -a --volumes
```

## Production Deployment

For Cloudflare Workers deployment:

```bash
# Deploy API worker
npm run deploy:api

# Deploy Auth worker
npx wrangler deploy workers/auth.js

# Deploy frontend to Cloudflare Pages
npm run deploy:pages
```

## Environment Variables Reference

| Variable | Description | Required |
|----------|-------------|----------|
| `CLOUDFLARE_ACCOUNT_ID` | Your Cloudflare account ID | Yes |
| `CLOUDFLARE_API_TOKEN` | Cloudflare API token | Yes |
| `JWT_SECRET` | Secret for JWT signing | Yes |
| `PASSWORD_HASH` | bcrypt hash of password | Yes |
| `DATABASE_URL` | PostgreSQL connection string | No |
| `REDIS_URL` | Redis connection string | No |
| `VITE_API_URL` | Frontend API URL | Yes |
| `VITE_AUTH_URL` | Frontend auth URL | Yes |

## License

MIT
