FROM node:22-bookworm-slim

ENV NODE_ENV=production

RUN apt-get update \
    && apt-get install -y --no-install-recommends ffmpeg ca-certificates libreoffice python3 python3-pip poppler-utils ghostscript zip fonts-dejavu fonts-noto-core git build-essential pkg-config libcairo2-dev libpango1.0-dev libjpeg-dev libgif-dev librsvg2-dev \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package*.json ./
RUN if [ -f package-lock.json ]; then npm ci --legacy-peer-deps --no-audit --no-fund; else npm install --legacy-peer-deps --no-audit --no-fund; fi

COPY requirements.txt ./
RUN pip3 install --no-cache-dir --break-system-packages -r requirements.txt \
    && pip3 install --no-cache-dir --break-system-packages -U --pre "yt-dlp[default]" \
    && pip3 install --no-cache-dir --break-system-packages -U bgutil-ytdlp-pot-provider \
    && git clone --depth 1 --branch 1.3.1 https://github.com/Brainicism/bgutil-ytdlp-pot-provider.git /opt/bgutil-ytdlp-pot-provider \
    && cd /opt/bgutil-ytdlp-pot-provider/server \
    && npm ci --include=dev --no-audit --no-fund \
    && ./node_modules/.bin/tsc \
    && npm prune --omit=dev

COPY . .

# Railway mounts the persistent volume at /app/persist at runtime.
# docker-entrypoint.sh maps /app/data and /app/session into that volume.
ENTRYPOINT ["sh", "/app/docker-entrypoint.sh"]
CMD ["node", "--max-old-space-size=512", "index.js"]
