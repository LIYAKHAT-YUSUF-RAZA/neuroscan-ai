# Multi-stage production Dockerfile for Express API Gateway
FROM node:20-alpine AS dependencies

WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production

FROM node:20-alpine AS runner

WORKDIR /app
ENV NODE_ENV=production \
    PORT=5000 \
    HOST=0.0.0.0

# Security: Create and run as non-root user
USER node

# Copy production dependencies and application source
COPY --chown=node:node --from=dependencies /app/node_modules ./node_modules
COPY --chown=node:node package*.json ./
COPY --chown=node:node src/ ./src/

EXPOSE 5000

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://127.0.0.1:5000/api/health || exit 1

CMD ["node", "src/server.js"]
