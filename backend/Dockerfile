FROM node:20-bullseye

# Install Chromium and necessary libraries for Puppeteer
RUN apt-get update && apt-get install -y \
  ca-certificates \
  fonts-liberation \
  libasound2 \
  libatk-bridge2.0-0 \
  libatk1.0-0 \
  libcups2 \
  libdbus-1-3 \
  libx11-xcb1 \
  libxcomposite1 \
  libxdamage1 \
  libxrandr2 \
  libgbm1 \
  libpangocairo-1.0-0 \
  libgtk-3-0 \
  chromium \
  --no-install-recommends && rm -rf /var/lib/apt/lists/*

WORKDIR /opt/render/project/src/backend

COPY package*.json ./
RUN npm ci --production

COPY . .

# Use system Chromium
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium

EXPOSE 5001
CMD ["npm", "start"]
