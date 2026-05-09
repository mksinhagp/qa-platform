FROM mcr.microsoft.com/playwright:v1.48.0-jammy AS base

WORKDIR /app

# Install dependencies
COPY package.json ./
RUN npm install -g pnpm@9
RUN pnpm install

# Copy source code
COPY . .

# Build TypeScript
RUN pnpm build

# Production stage
FROM base AS runner
WORKDIR /app

ENV NODE_ENV production

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 runner

COPY --from=base /app/dist ./dist
COPY --from=base /app/node_modules ./node_modules
COPY --from=base /app/package.json ./package.json

USER runner

EXPOSE 4000

ENV PORT 4000

CMD ["node", "dist/index.js"]
