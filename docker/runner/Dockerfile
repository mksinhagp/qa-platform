FROM mcr.microsoft.com/playwright:v1.48.0-jammy AS base

WORKDIR /workspace

# Copy workspace root files for pnpm
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN npm install -g pnpm@9
RUN pnpm install --frozen-lockfile

# Copy source code
COPY . .

# Build TypeScript
RUN pnpm --filter runner build

# Production stage
FROM base AS runner
WORKDIR /app

ENV NODE_ENV production

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 runner

COPY --from=base /workspace/apps/runner/dist ./dist
COPY --from=base /workspace/node_modules ./node_modules
COPY --from=base /workspace/apps/runner/package.json ./package.json

USER runner

EXPOSE 4000

ENV PORT 4000

CMD ["node", "dist/index.js"]
