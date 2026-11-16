FROM node:22-bookworm-slim

RUN apt-get update && apt-get install -y --no-install-recommends \
    ca-certificates \
    curl \
    ffmpeg \
  && arch="$(uname -m)" \
  && case "$arch" in \
       x86_64) ytdlp_bin="yt-dlp_linux" ;; \
       aarch64|arm64) ytdlp_bin="yt-dlp_linux_aarch64" ;; \
       *) echo "Unsupported arch: $arch" >&2; exit 1 ;; \
     esac \
  && curl -fsSL "https://github.com/yt-dlp/yt-dlp/releases/latest/download/${ytdlp_bin}" -o /usr/local/bin/yt-dlp \
  && chmod a+rx /usr/local/bin/yt-dlp \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package*.json ./
RUN npm ci --omit=dev

COPY src ./src

CMD ["node", "--max-old-space-size=160", "src/index.js"]
