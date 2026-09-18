# Sankalp API — Node/Express.
#
#   docker build -t sankalp-api ./server
#   docker run --env-file server/.env -p 5000:5000 sankalp-api
#
# Runs as the unprivileged `node` user; migrations are applied by the same
# image (`node scripts/migratePg.js`) so the compose stack needs no second one.
FROM node:22-alpine

WORKDIR /app
ENV NODE_ENV=production

# Dependencies first so a source-only change reuses this layer.
# package-lock.json is gitignored in this repo, so `npm ci` cannot be relied
# on from a clean clone; plain install with dev deps (jest, nodemon) omitted.
COPY package*.json ./
RUN npm install --omit=dev && npm cache clean --force

COPY . .

USER node
EXPOSE 5000

# Same probe the uptime monitor uses in production.
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD wget -qO- http://127.0.0.1:5000/health || exit 1

CMD ["node", "server.js"]
