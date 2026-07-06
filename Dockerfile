FROM node:22-alpine AS node-deps
WORKDIR /app
COPY package*.json ./
RUN npm ci --ignore-scripts

FROM node-deps AS node-builder
COPY . .
RUN npx prisma generate
RUN npm run build

FROM node:22-alpine AS runner
WORKDIR /app
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 vendora && \
    apk add --no-cache curl openssl
COPY --from=node-builder /app/dist ./dist
COPY --from=node-builder /app/package*.json ./
COPY --from=node-builder /app/node_modules ./node_modules
COPY --from=node-builder /app/prisma ./prisma
COPY docker-entrypoint.sh /docker-entrypoint.sh
RUN sed -i 's/\r$//' /docker-entrypoint.sh && \
    chmod +x /docker-entrypoint.sh && \
    mkdir -p /app/data /app/uploads && \
    chown -R vendora:nodejs /app/data /app/uploads
USER vendora
EXPOSE 3333
ENV NODE_ENV=production
ENV WACALLS_URL=
ENV ENABLE_EMBEDDED_WACALLS=false
ENV ENABLE_EMBEDDED_WAHAPLUS=false
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD curl -f http://localhost:3333/api/health || exit 1
ENTRYPOINT ["/docker-entrypoint.sh"]
