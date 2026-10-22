# ---- Stage 1: deps ----
FROM node:20-alpine AS deps
WORKDIR /app

# Install OpenSSL and libc6-compat so Prisma accurately detects OpenSSL 3.x
RUN apk add --no-cache openssl libc6-compat

# Install pnpm matching lockfileVersion 9
RUN npm install -g pnpm@9

# Copy package files
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY .npmrc* ./

# Install all dependencies (dev needed for prisma generate + build)
RUN pnpm install --frozen-lockfile

# ---- Stage 2: builder ----
FROM node:20-alpine AS builder
WORKDIR /app

RUN apk add --no-cache openssl libc6-compat
RUN npm install -g pnpm@9

# Copy installed node_modules from deps stage
COPY --from=deps /app/node_modules ./node_modules

# Copy source
COPY . .

# Prisma: generate client with Alpine/musl target
ENV PRISMA_CLI_BINARY_TARGETS=linux-musl-openssl-3.0.x
RUN pnpm prisma generate

# Compile seed script for standalone execution (no tsx in production)
RUN pnpm exec tsc prisma/seed.ts --target es2022 --module CommonJS --moduleResolution node --outDir prisma/dist

# Ensure Prisma CLI and all @prisma modules are self-contained real directories with no broken symlinks
RUN cp -rL /app/node_modules/.pnpm/node_modules/@prisma/* /app/node_modules/@prisma/ \
    && cp -rL /app/node_modules/.pnpm/prisma@*/node_modules/prisma /app/prisma-cli

# Verify prisma migration CLI works inside builder stage before Next.js build
RUN node /app/prisma-cli/build/index.js migrate --help > /dev/null

# Build Next.js standalone
ENV NODE_ENV=production
RUN pnpm build

# ---- Stage 3: runner ----
FROM node:20-alpine AS runner
WORKDIR /app

# Install runtime OpenSSL and libc6-compat
RUN apk add --no-cache openssl libc6-compat

# Non-root user for security
RUN addgroup --system --gid 1001 nodejs && adduser --system --uid 1001 nextjs

# Next.js standalone output (includes its own node_modules)
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public

# Prisma schema + compiled migrations + seed
COPY --from=builder /app/prisma ./prisma

# Copy Prisma CLI and @prisma modules for runtime migration execution
COPY --from=builder /app/node_modules/@prisma ./node_modules/@prisma
COPY --from=builder /app/prisma-cli ./node_modules/prisma
COPY --from=builder /app/node_modules/.pnpm ./node_modules/.pnpm

# Verify prisma migration CLI works inside runner stage
RUN node /app/node_modules/prisma/build/index.js migrate --help > /dev/null

# Set permissions
RUN chown -R nextjs:nodejs /app

USER nextjs

# Cloud Run sets PORT; default 8080
ENV PORT=8080
ENV HOSTNAME=0.0.0.0
ENV NODE_ENV=production

EXPOSE 8080

CMD ["node", "server.js"]
