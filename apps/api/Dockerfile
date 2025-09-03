# Multi-stage build for GlobalNews Letter API
FROM node:20-slim AS builder

# Install pnpm
RUN npm install -g pnpm

# Set working directory
WORKDIR /app

# Copy package files for dependency installation
COPY package*.json pnpm-*.yaml ./
COPY apps/api/package*.json ./apps/api/
COPY packages/contracts/package*.json ./packages/contracts/

# Install dependencies with frozen lockfile
RUN pnpm install --frozen-lockfile

# Copy source code (excluding node_modules which are already installed)
COPY apps/api/src ./apps/api/src
COPY apps/api/tsconfig*.json ./apps/api/
COPY packages/contracts/src ./packages/contracts/src
COPY packages/contracts/tsconfig*.json ./packages/contracts/
COPY tsconfig*.json ./

# Build the application
RUN pnpm build --workspace=@mtrx/api
RUN pnpm build --workspace=@mtrx/contracts

# Production stage
FROM node:20-alpine AS runtime

# Install pnpm and TypeScript globally for development commands
RUN npm install -g pnpm typescript

# Create non-root user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001

# Set working directory
WORKDIR /app

# Copy package files first
COPY --from=builder --chown=nodejs:nodejs /app/package*.json /app/pnpm-*.yaml ./
COPY --from=builder --chown=nodejs:nodejs /app/apps/api/package.json ./apps/api/
COPY --from=builder --chown=nodejs:nodejs /app/packages/contracts/package.json ./packages/contracts/

# Copy built application and dependencies
COPY --from=builder --chown=nodejs:nodejs /app/apps/api/dist ./apps/api/dist
COPY --from=builder --chown=nodejs:nodejs /app/packages/contracts/dist ./packages/contracts/dist

# Copy source files for development commands
COPY --from=builder --chown=nodejs:nodejs /app/apps/api/src ./apps/api/src
COPY --from=builder --chown=nodejs:nodejs /app/apps/api/tsconfig*.json ./apps/api/
COPY --from=builder --chown=nodejs:nodejs /app/packages/contracts/src ./packages/contracts/src
COPY --from=builder --chown=nodejs:nodejs /app/packages/contracts/tsconfig*.json ./packages/contracts/
COPY --from=builder --chown=nodejs:nodejs /app/tsconfig*.json ./

# Install all dependencies (including dev dependencies for lint/typecheck) using pnpm
RUN pnpm install --frozen-lockfile

# Switch to non-root user
USER nodejs

# Expose port
EXPOSE 3333

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3333/healthz', (res) => process.exit(res.statusCode === 200 ? 0 : 1))"

# Start the application
CMD ["node", "apps/api/dist/server.js"]