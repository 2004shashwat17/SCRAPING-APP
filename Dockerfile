FROM node:20-bullseye

# Install Chromium and required libs for Puppeteer
RUN apt-get update && apt-get install -y \
  ca-certificates \
  fonts-liberation \
  xvfb \
  xauth \
  x11vnc \
  python3 \
  python3-pip \
  git \
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

# ⬇️ IMPORTANT: point to backend folder
WORKDIR /app/backend

# Copy only backend package files
COPY backend/package*.json ./

# Install production deps
RUN npm install --omit=dev

# Copy backend source code
COPY backend/ .

# Tell Puppeteer to use system Chromium
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium
ENV PORT=8080

# Install noVNC and websockify
RUN git clone --depth 1 https://github.com/novnc/noVNC /opt/noVNC \
  && pip3 install websockify

EXPOSE 8080 5900 6080

# Copy startup script
COPY backend/scripts/start.sh /usr/local/bin/start-backend.sh
RUN chmod +x /usr/local/bin/start-backend.sh

# Run our startup helper which starts Xvfb, x11vnc, websockify/noVNC and the node app
CMD ["bash", "-lc", "/usr/local/bin/start-backend.sh"]
