FROM node:20-alpine

WORKDIR /app

# Install pnpm
RUN npm install -g pnpm@9

# Copy package files
COPY package.json pnpm-lock.yaml ./
COPY packages/db/package.json ./packages/db/

# Install dependencies
RUN pnpm install --filter=db

# Copy source
COPY packages/db ./packages/db
COPY db ./db

# Run migrations
CMD ["pnpm", "--filter=db", "run", "migrate"]
