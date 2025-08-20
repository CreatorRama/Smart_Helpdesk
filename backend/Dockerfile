# Dockerfile
FROM node:18-alpine

WORKDIR /app

# Install dependencies first (for better caching)
COPY package*.json ./
RUN npm ci --only=production

# Copy application code
COPY . .

# Create non-root user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S helpdesk -u 1001

# Change ownership of the app directory
RUN chown -R helpdesk:nodejs /app
USER helpdesk

EXPOSE 8080

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:8080/healthz', (res) => { process.exit(res.statusCode === 200 ? 0 : 1) })"

CMD ["npm", "start"]

# docker-compose.yml
version: '3.8'

services:
  # MongoDB
  mongo:
    image: mongo:7
    restart: unless-stopped
    ports:
      - "27017:27017"
    environment:
      MONGO_INITDB_ROOT_USERNAME: admin
      MONGO_INITDB_ROOT_PASSWORD: password123
      MONGO_INITDB_DATABASE: helpdesk
    volumes:
      - mongo_data:/data/db
      - ./scripts/mongo-init.js:/docker-entrypoint-initdb.d/mongo-init.js:ro
    networks:
      - helpdesk-network

  # Redis (optional for production queues)
  redis:
    image: redis:7-alpine
    restart: unless-stopped
    ports:
      - "6379:6379"
    volumes:
      - redis_data:/data
    networks:
      - helpdesk-network
    command: redis-server --appendonly yes

  # Backend API
  api:
    build: .
    restart: unless-stopped
    ports:
      - "8080:8080"
    environment:
      NODE_ENV: production
      PORT: 8080
      MONGO_URI: mongodb://admin:password123@mongo:27017/helpdesk?authSource=admin
      JWT_SECRET: ${JWT_SECRET:-super-secret-jwt-key-change-in-production}
      AUTO_CLOSE_ENABLED: ${AUTO_CLOSE_ENABLED:-true}
      CONFIDENCE_THRESHOLD: ${CONFIDENCE_THRESHOLD:-0.78}
      STUB_MODE: ${STUB_MODE:-true}
      DEEPSEEK_API_KEY: ${DEEPSEEK_API_KEY:-}
      FRONTEND_URL: ${FRONTEND_URL:-http://localhost:3000}
    depends_on:
      - mongo
      - redis
    volumes:
      - ./logs:/app/logs
    networks:
      - helpdesk-network
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:8080/healthz"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 40s

volumes:
  mongo_data:
  redis_data:

networks:
  helpdesk-network:
    driver: bridge

# .dockerignore
node_modules
npm-debug.log
.git
.gitignore
README.md
.env
.nyc_output
coverage
.coverage
.cache
.tmp
.temp
logs/*.log
*.log
.DS_Store
.vscode
.idea
*.swp
*.swo
*~