# My little son — single container: Express serves the built client + /api + /ws.
# Runs behind the sellerz-server nginx (frontend container) which terminates TLS
# and reverse-proxies son.shved.su to this container. nginx->Node (not Passenger),
# so iOS Safari/standalone is happy and WebSocket upgrade works.

FROM node:20-alpine AS build
WORKDIR /app
# better-sqlite3 is a native module — needs a toolchain to (re)build for this base.
RUN apk add --no-cache python3 make g++
COPY . .
RUN npm ci && npm run build && npm prune --omit=dev

FROM node:20-alpine
WORKDIR /app
ENV NODE_ENV=production \
    PORT=3001 \
    DATABASE_PATH=/data/my_little_son.db
# Copy the built app + pruned production node_modules (incl. compiled better-sqlite3).
COPY --from=build /app ./
RUN mkdir -p /data
EXPOSE 3001
# SQLite lives in the /data volume so it survives redeploys.
VOLUME ["/data"]
CMD ["node", "app.js"]
