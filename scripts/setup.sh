#!/bin/bash
set -e

echo "🚀 Email Viewer - Discord-Style Setup"
echo "======================================"
echo ""

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check prerequisites
echo "📋 Checking prerequisites..."

if ! command -v node &> /dev/null; then
    echo -e "${RED}❌ Node.js is not installed. Please install Node.js 20+${NC}"
    exit 1
fi

if ! command -v docker &> /dev/null; then
    echo -e "${YELLOW}⚠️  Docker not found. Docker setup will be skipped.${NC}"
    SKIP_DOCKER=true
fi

echo -e "${GREEN}✅ Prerequisites OK${NC}"
echo ""

# Install dependencies
echo "📦 Installing dependencies..."
npm install
cd web && npm install && cd ..
echo -e "${GREEN}✅ Dependencies installed${NC}"
echo ""

# Setup environment
if [ ! -f .env ]; then
    echo "⚙️  Setting up environment..."
    cp .env.example .env
    echo -e "${YELLOW}⚠️  Please edit .env file with your configuration${NC}"
    echo ""

    # Generate JWT secret
    JWT_SECRET=$(openssl rand -base64 64 | tr -d '\n')

    # Update .env with generated secret
    if command -v sed &> /dev/null; then
        if [[ "$OSTYPE" == "darwin"* ]]; then
            sed -i '' "s|JWT_SECRET=.*|JWT_SECRET=$JWT_SECRET|" .env
        else
            sed -i "s|JWT_SECRET=.*|JWT_SECRET=$JWT_SECRET|" .env
        fi
    fi

    echo -e "${GREEN}✅ Generated JWT_SECRET${NC}"
    echo ""

    # Prompt for password
    echo "🔐 Password Setup"
    echo "Please create a secure password for login:"
    read -s -p "Password: " PASSWORD
    echo ""
    read -s -p "Confirm Password: " PASSWORD_CONFIRM
    echo ""

    if [ "$PASSWORD" != "$PASSWORD_CONFIRM" ]; then
        echo -e "${RED}❌ Passwords do not match${NC}"
        exit 1
    fi

    # Generate password hash
    echo "🔒 Generating password hash..."
    PASSWORD_HASH=$(node -e "const bcrypt = require('bcryptjs'); bcrypt.hash('$PASSWORD', 10).then(h => console.log(h))")

    # Update .env
    if command -v sed &> /dev/null; then
        if [[ "$OSTYPE" == "darwin"* ]]; then
            sed -i '' "s|PASSWORD_HASH=.*|PASSWORD_HASH=$PASSWORD_HASH|" .env
        else
            sed -i "s|PASSWORD_HASH=.*|PASSWORD_HASH=$PASSWORD_HASH|" .env
        fi
    fi

    echo -e "${GREEN}✅ Password configured${NC}"
    echo ""
else
    echo -e "${YELLOW}⚠️  .env file already exists, skipping...${NC}"
    echo ""
fi

# Docker setup
if [ "$SKIP_DOCKER" != true ]; then
    echo "🐳 Docker Setup"
    read -p "Do you want to start with Docker? (y/n) " -n 1 -r
    echo ""
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        echo "Starting services..."
        docker-compose up -d
        echo ""
        echo -e "${GREEN}✅ Services started!${NC}"
        echo ""
        echo "🌐 Access Points:"
        echo "   Frontend:    http://localhost:5173"
        echo "   With Proxy:  http://localhost"
        echo "   API:         http://localhost:8787"
        echo "   Auth API:    http://localhost:8788"
        echo ""
        echo "📊 View logs: docker-compose logs -f"
        echo "🛑 Stop: docker-compose down"
    fi
else
    echo -e "${YELLOW}Manual setup:${NC}"
    echo "   1. Start frontend: cd web && npm run dev"
    echo "   2. Start API: npm run dev:api"
    echo "   3. Start Auth: npx wrangler dev workers/auth.js --port 8788"
fi

echo ""
echo -e "${GREEN}✨ Setup complete!${NC}"
echo ""
echo "📖 Documentation:"
echo "   - Setup Guide: SETUP.md"
echo "   - Docker Guide: README.docker.md"
echo ""
echo "🔧 Next Steps:"
echo "   1. Edit .env if needed"
echo "   2. Configure Cloudflare credentials for deployment"
echo "   3. Read SETUP.md for deployment instructions"
echo ""
echo "Happy coding! 🎉"
