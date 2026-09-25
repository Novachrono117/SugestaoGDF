# syntax=docker/dockerfile:1
# Imagem de produção do Voz DF (ver docs/DEPLOY.md). Três alvos:
#   builder  → compila o app (tem todas as dependências)
#   migrador → aplica migrações + limites das RAs + seed e sai (roda a cada deploy)
#   app      → só o servidor standalone, usuário sem privilégios (padrão)

FROM node:24-bookworm-slim AS base
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
# O Prisma CLI (generate/migrate) detecta a versão do OpenSSL para escolher o engine certo.
RUN apt-get update && apt-get install -y --no-install-recommends openssl && rm -rf /var/lib/apt/lists/*

# ---------------------------------------------------------------- dependências
FROM base AS deps
COPY package.json package-lock.json prisma.config.ts ./
COPY prisma ./prisma
RUN npm ci

# ---------------------------------------------------------------- build
FROM base AS builder
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# O singleton do Prisma exige DATABASE_URL ao ser importado; o build importa as rotas mas não consulta
# o banco (páginas dinâmicas). URL fictícia só neste RUN — não fica na imagem. Porta 1: se algo tentar
# conectar durante o build, falha na hora em vez de passar despercebido.
RUN DATABASE_URL="postgresql://build:build@127.0.0.1:1/build" sh -c "npx prisma generate && npm run build"

# ---------------------------------------------------------------- migrações + seed (one-off)
FROM builder AS migrador
# Limites oficiais das RAs: baixados na hora (licença não declarada → fora do git e da imagem).
# Se a fonte estiver fora do ar, segue sem eles (RA escolhida à mão).
CMD ["sh", "-c", "npx prisma migrate deploy && (npm run ras:baixar || echo 'Aviso: limites das RAs indisponíveis; seguindo sem detecção automática') && npx prisma db seed"]

# ---------------------------------------------------------------- servidor
FROM base AS app
ENV NODE_ENV=production \
    PORT=3000 \
    HOSTNAME=0.0.0.0 \
    UPLOAD_DIR=/app/uploads
RUN groupadd --system --gid 1001 nodejs \
 && useradd --system --uid 1001 --gid nodejs nextjs \
 && mkdir -p /app/uploads && chown nextjs:nodejs /app/uploads
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=builder --chown=nextjs:nodejs /app/public ./public
USER nextjs
EXPOSE 3000
# Fotos das denúncias: montar um volume aqui (sem ele, somem a cada deploy).
VOLUME ["/app/uploads"]
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:3000/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "server.js"]
