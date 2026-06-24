# ═══════════════════════════════════════════════════════════════
# GuidEasy Logistics — Dockerfile (Node.js Production)
# Multi-stage build para imagem mínima.
# ═══════════════════════════════════════════════════════════════

# ─── Stage 1: Build ────────────────────────────────────────────
FROM node:22-alpine AS builder

WORKDIR /app

# Instalar dependências primeiro (cache de layers)
COPY package.json package-lock.json* ./
RUN npm ci --ignore-scripts

# Copiar código fonte e construir
COPY . .
RUN npm run build

# ─── Stage 2: Production ──────────────────────────────────────
FROM node:22-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production

# Copiar apenas o necessário
COPY --from=builder /app/.output ./.output
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./package.json

# Utilizador não-root para segurança
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 appuser
USER appuser

EXPOSE 3000

CMD ["node", ".output/server/index.mjs"]
