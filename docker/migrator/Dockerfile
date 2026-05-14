FROM node:20-alpine

WORKDIR /app

# Install pnpm
RUN npm install -g pnpm@9

# Copy package files
COPY package.json pnpm-lock.yaml ./
COPY packages/db/package.json ./packages/db/
COPY packages/shared-types/package.json ./packages/shared-types/

# Install dependencies (including devDependencies for tsx)
RUN pnpm install --filter=db --filter=shared-types --dev

# Copy source
COPY packages/db ./packages/db
COPY db ./db

# Run migrations
CMD ["pnpm", "--filter=db", "run", "migrate"]
