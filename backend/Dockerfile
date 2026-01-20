FROM node:20-bullseye

# Install Chromium and necessary libraries for Puppeteer
RUN apt-get update && apt-get install -y \
  ca-certificates \
  fonts-liberation \
  xvfb \
  xauth \
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
# Use npm install here because `npm ci` requires a lockfile (package-lock.json).
# Some CI/build environments (like Railway) may not have a lockfile committed —
# `npm install` is more robust in that case.
RUN npm install --production

COPY . .

# Use system Chromium
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium

EXPOSE 8080
# Run the app under Xvfb so Puppeteer's headful mode can start in containerized environments
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium
CMD ["bash", "-lc", "xvfb-run --server-args='-screen 0 1280x720x24' npm start"]
