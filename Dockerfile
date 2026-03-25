# ======================
# Stage 1: Base
# ======================
FROM node:20-alpine

WORKDIR /app

# Enable Corepack and pnpm
RUN corepack enable && corepack prepare pnpm@latest --activate

# Add unprivileged user
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# Copy entire project (mirrors local structure exactly)
COPY . .

ARG NEXT_PUBLIC_APP_URL
ARG NEXT_PUBLIC_BETTER_AUTH_CALLBACK

# Set as environment variables for the build
ENV NEXT_PUBLIC_APP_URL=$NEXT_PUBLIC_APP_URL
ENV NEXT_PUBLIC_BETTER_AUTH_CALLBACK=$NEXT_PUBLIC_BETTER_AUTH_CALLBACK


# Install dependencies
RUN pnpm install --frozen-lockfile

# Build project
ENV SKIP_ENV_VALIDATION=true
RUN pnpm build

# Set user
USER nextjs

# Expose port
EXPOSE 3000
ENV NODE_ENV=production
ENV PORT=3000

# Start server
CMD ["pnpm", "start"]
