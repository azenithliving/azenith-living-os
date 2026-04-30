FROM node:20-slim

# Install Playwright dependencies and other required packages
RUN apt-get update && apt-get install -y \
    libnss3 \
    libnspr4 \
    libatk1.0-0 \
    libatk-bridge2.0-0 \
    libcups2 \
    libdrm2 \
    libxkbcommon0 \
    libxcomposite1 \
    libxdamage1 \
    libxfixes3 \
    libxrandr2 \
    libgbm1 \
    libpango1.0-0 \
    libcairo2 \
    libasound2 \
    libexpat1 \
    libfontconfig1 \
    libfreetype6 \
    ca-certificates \
    fonts-liberation \
    libappindicator3-1 \
    libatk-bridge2.0-0 \
    libgtk-3-0 \
    xdg-utils \
    wget \
    curl \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm install --omit=dev

# Install Playwright browsers
RUN npx playwright install chromium
RUN npx playwright install-deps chromium

# Copy application code
COPY . .

# Create data directory
RUN mkdir -p /app/data

# Expose the port (will be set by environment variable)
EXPOSE 3002 3003

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD curl -f http://localhost:${PORT:-3002}/health || exit 1

# Start the application
CMD ["node", "entrypoint.js"]
