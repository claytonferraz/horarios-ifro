FROM node:18-alpine
WORKDIR /app

# Instala ferramentas necessárias para compilar pacotes nativos (como sqlite3) no Alpine
RUN apk add --no-cache python3 make g++

# Copia os arquivos de dependência
COPY package*.json ./

# Instala as dependências
RUN npm install --production

# Copia o resto do código da aplicação (o .dockerignore vai ignorar o node_modules local)
COPY . .
EXPOSE 3012

# Inicia o servidor Node.js
CMD ["node", "server.js"]