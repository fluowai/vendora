FROM node:22-alpine AS node-deps
WORKDIR /app
COPY package*.json ./
RUN npm ci

FROM node-deps AS node-test
COPY . .
RUN npx prisma generate
RUN npm test

FROM node-deps AS node-builder
COPY . .
RUN npm run build

FROM golang:1.26-alpine AS go-builder
WORKDIR /build
RUN apk add --no-cache git
RUN git clone https://github.com/JotaDev66/WaCalls.git .
RUN go mod download
RUN CGO_ENABLED=0 go build -ldflags="-s -w" -o wacalls-server ./cmd/server

FROM node:22-alpine AS runner
WORKDIR /app
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 vendora && \
    apk add --no-cache curl
COPY --from=node-builder /app/dist ./dist
COPY --from=node-builder /app/package*.json ./
COPY --from=node-builder /app/node_modules ./node_modules
COPY --from=node-builder /app/prisma ./prisma
COPY --from=go-builder /build/wacalls-server /usr/local/bin/wacalls-server
COPY docker-entrypoint.sh /docker-entrypoint.sh
RUN chmod +x /docker-entrypoint.sh && \
    sed -i 's/provider = "sqlite"/provider = "postgresql"/' prisma/schema.prisma && \
    npx prisma generate
USER vendora
EXPOSE 3333
ENV NODE_ENV=production
ENV WACALLS_URL=
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD curl -f http://localhost:3333/api/health || exit 1
ENTRYPOINT ["/docker-entrypoint.sh"]
