# Usa a imagem oficial do Node.js
FROM node:18-alpine AS base

# Fase 1: Instalando dependências
FROM base AS deps
RUN apk add --no-cache libc6-compat
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

# Fase 2: Configuração do Build do Next.js
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# Ignoramos a pasta backend para o Next.js não tentar buildar arquivos de lá
RUN npx next build

# Fase 3: Imagem Final de Produção (Apenas o necessário para o Next rodar)
FROM base AS runner
WORKDIR /app

ENV NODE_ENV production
ENV NEXT_TELEMETRY_DISABLED 1

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# Cria diretórios importantes para Next.js App Router
RUN mkdir .next
RUN chown nextjs:nodejs .next

# Copia do builder
COPY --from=builder /app/public ./public
# Copia a aplicação construída gerada no standalone
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs

EXPOSE 3001
ENV PORT 3001
ENV HOSTNAME "0.0.0.0"

CMD ["node", "server.js"]
