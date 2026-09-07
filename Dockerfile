FROM node:22-bookworm-slim

ENV NODE_ENV=production

RUN apt-get update \
    && apt-get install -y --no-install-recommends ffmpeg ca-certificates libreoffice python3 python3-pip poppler-utils ghostscript zip fonts-dejavu fonts-noto-core \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package*.json ./
RUN if [ -f package-lock.json ]; then npm ci --legacy-peer-deps --no-audit --no-fund; else npm install --legacy-peer-deps --no-audit --no-fund; fi

COPY requirements.txt ./
RUN pip3 install --no-cache-dir --break-system-packages -r requirements.txt && pip3 install --no-cache-dir --break-system-packages -U --pre "yt-dlp[default]"

COPY . .

# Railway mounts the persistent volume at /app/persist at runtime.
# docker-entrypoint.sh maps /app/data and /app/session into that volume.
ENTRYPOINT ["sh", "/app/docker-entrypoint.sh"]
CMD ["node", "--max-old-space-size=512", "index.js"]
