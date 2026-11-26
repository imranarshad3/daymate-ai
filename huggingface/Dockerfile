# Hugging Face Space (Docker SDK) — builds DayMate AI straight from GitHub
FROM node:20-alpine AS build
RUN apk add --no-cache git
# Re-download the code whenever a new commit lands on main
ADD https://api.github.com/repos/imranarshad3/daymate-ai/git/refs/heads/main /tmp/version.json
RUN git clone --depth 1 https://github.com/imranarshad3/daymate-ai.git /src
WORKDIR /src/client
RUN npm ci && npm run build
WORKDIR /src/server
RUN npm ci --omit=dev

FROM node:20-alpine
ENV NODE_ENV=production PORT=7860 DB_FILE=/tmp/daymate.json
WORKDIR /app
COPY --from=build /src/server ./server
COPY --from=build /src/client/dist ./client/dist
EXPOSE 7860
CMD ["node", "server/index.js"]
