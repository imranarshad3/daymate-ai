# ---------- build the React app ----------
FROM node:20-alpine AS web
WORKDIR /app/client
COPY client/package*.json ./
RUN npm ci
COPY client/ ./
RUN npm run build

# ---------- production server ----------
FROM node:20-alpine
ENV NODE_ENV=production
WORKDIR /app
COPY server/package*.json ./server/
RUN cd server && npm ci --omit=dev
COPY server/ ./server/
COPY --from=web /app/client/dist ./client/dist
EXPOSE 5000
CMD ["node", "server/index.js"]
