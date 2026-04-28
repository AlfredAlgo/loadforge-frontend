FROM node:20-alpine AS builder

WORKDIR /app

RUN corepack enable && corepack prepare pnpm@9.15.4 --activate

COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

COPY . .

ARG NEXT_PUBLIC_APP_URL
ARG NEXT_PUBLIC_BETTER_AUTH_CALLBACK

ENV NEXT_PUBLIC_APP_URL=$NEXT_PUBLIC_APP_URL
ENV NEXT_PUBLIC_BETTER_AUTH_CALLBACK=$NEXT_PUBLIC_BETTER_AUTH_CALLBACK


RUN pnpm build

FROM node:20-alpine AS runner

WORKDIR /app

RUN corepack enable && corepack prepare pnpm@9.15.4 --activate

COPY --from=builder /app/package.json ./
COPY --from=builder /app/pnpm-lock.yaml ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/src ./src
COPY --from=builder /app/tsconfig.json ./

EXPOSE 8080
ENV PORT=8080
ENV NODE_ENV=production

# Server-side vars — must be injected by Azure App Service at runtime.
# Declaring them here so Next.js env validation doesn't crash on startup
# if Azure hasn't propagated them yet, but they MUST be set in App Settings.
ARG DATABASE_URL
ARG SOCKET_URL
ARG BETTER_AUTH_SECRET
ARG BETTER_AUTH_URL
ENV DATABASE_URL=${DATABASE_URL}
ENV SOCKET_URL=${SOCKET_URL}
ENV BETTER_AUTH_SECRET=${BETTER_AUTH_SECRET}
ENV BETTER_AUTH_URL=${BETTER_AUTH_URL}

CMD ["pnpm", "start"]
