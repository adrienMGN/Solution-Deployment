# Use Node.js 18 LTS Alpine for smaller size and better security
FROM node:18-alpine

# Set working directory
WORKDIR /app

# Install curl for health checks
RUN apk add --no-cache curl

# Create app user and group for security
RUN addgroup -S nodejs && adduser -S audioapp -G nodejs

# Copy package files first for better Docker layer caching
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production && npm cache clean --force

# Copy source code files
COPY ./server.js /app/server.js
COPY ./models.js /app/models.js
COPY ./public/ /app/public/
COPY ./data /app/data


# Create uploads directory and set permissions
RUN mkdir -p uploads && chown -R audioapp:nodejs uploads

# Set proper permissions for the app directory
RUN chown -R audioapp:nodejs /app

# Switch to non-root user
USER audioapp

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:3000/health || exit 1

# Start the application
CMD ["node", "server.js"]