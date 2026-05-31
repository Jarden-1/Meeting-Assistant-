FROM node:24-alpine AS base
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable
WORKDIR /app

FROM base AS build
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/api/package.json apps/api/package.json
COPY apps/web/package.json apps/web/package.json
RUN pnpm install --frozen-lockfile --filter meeting-assistant-api...

COPY apps/api apps/api
RUN pnpm --filter meeting-assistant-api prisma:generate
RUN pnpm --filter meeting-assistant-api build
RUN pnpm --filter meeting-assistant-api deploy --prod --legacy /prod/meeting-assistant-api
RUN cd /prod/meeting-assistant-api && ./node_modules/.bin/prisma generate --schema prisma/schema.prisma

FROM node:24-alpine AS runner
ENV NODE_ENV=production
ENV PORT=3001
WORKDIR /app
RUN addgroup -S nodejs && adduser -S nodejs -G nodejs
COPY --from=build --chown=nodejs:nodejs /prod/meeting-assistant-api ./
USER nodejs
EXPOSE 3001
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD wget -qO- http://127.0.0.1:3001/api/v1/health >/dev/null || exit 1
CMD ["node", "dist/main.js"]
