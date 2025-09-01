# Multi-stage build for GlobalNews Letter Frontend
FROM node:20-slim AS builder

# Install pnpm
RUN npm install -g pnpm

# Set working directory
WORKDIR /app

# Copy package files for dependency installation
COPY package*.json pnpm-*.yaml ./
COPY apps/frontend/package*.json ./apps/frontend/
COPY packages/contracts/package*.json ./packages/contracts/

# Install dependencies with frozen lockfile
RUN pnpm install --frozen-lockfile

# Copy source code (excluding node_modules which are already installed)
COPY apps/frontend/src ./apps/frontend/src
COPY apps/frontend/next.config* ./apps/frontend/
COPY apps/frontend/tailwind.config* ./apps/frontend/
COPY apps/frontend/postcss.config* ./apps/frontend/
COPY apps/frontend/tsconfig*.json ./apps/frontend/
COPY packages/contracts/src ./packages/contracts/src
COPY packages/contracts/tsconfig*.json ./packages/contracts/
COPY tsconfig*.json ./

# Build contracts first
RUN pnpm build --workspace=@mtrx/contracts
# Build the frontend application  
RUN pnpm build --workspace=apps/frontend

# Production stage
FROM node:20-alpine AS runtime

# Create non-root user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001

# Set working directory
WORKDIR /app

# Copy built application  
COPY --from=builder --chown=nodejs:nodejs /app/apps/frontend/.next/standalone ./
COPY --from=builder --chown=nodejs:nodejs /app/apps/frontend/.next/static ./.next/static
# Create public directory
RUN mkdir -p ./public

# Switch to non-root user
USER nodejs

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3000/api/health', (res) => process.exit(res.statusCode === 200 ? 0 : 1))"

# Start the application
CMD ["node", "apps/frontend/server.js"]