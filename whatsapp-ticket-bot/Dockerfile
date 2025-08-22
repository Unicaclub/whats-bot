# ================================================
# DOCKERFILE PARA WHATSAPP-TICKET-BOT
# Otimizado para produção na nuvem
# ================================================

# Usar Node.js LTS com Alpine para menor tamanho
FROM node:18-alpine

# Instalar dependências do sistema para Puppeteer
RUN apk add --no-cache \
    chromium \
    nss \
    freetype \
    freetype-dev \
    harfbuzz \
    ca-certificates \
    ttf-freefont

# Definir variáveis de ambiente para Puppeteer
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true \
    PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium-browser

# Criar usuário não-root para segurança
RUN addgroup -g 1001 -S nodejs
RUN adduser -S whatsapp -u 1001

# Criar diretório da aplicação
WORKDIR /app

# Copiar package.json e package-lock.json
COPY package*.json ./

# Instalar dependências de produção
RUN npm ci --only=production && npm cache clean --force

# Copiar código da aplicação
COPY . .

# Criar diretórios necessários
RUN mkdir -p uploads logs tokens temp public
RUN chown -R whatsapp:nodejs /app

# Expor porta da aplicação
EXPOSE 3006

# Mudar para usuário não-root
USER whatsapp

# Comando de inicialização
CMD ["npm", "start"]

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node healthcheck.js || exit 1
