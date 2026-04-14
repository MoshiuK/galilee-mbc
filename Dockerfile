FROM node:20-alpine AS base
WORKDIR /app

# Install dependencies
COPY package.json package-lock.json* ./
RUN npm ci --production=false

# Copy prisma schema and generate client
COPY prisma ./prisma
RUN npx prisma generate

# Copy server code
COPY server ./server

# Build client
COPY client ./client
RUN cd client && npm ci && npm run build

# Production stage
FROM node:20-alpine AS production
WORKDIR /app

COPY --from=base /app/node_modules ./node_modules
COPY --from=base /app/prisma ./prisma
COPY --from=base /app/server ./server
COPY --from=base /app/client/dist ./client/dist
COPY package.json ./

# Create storage directory
RUN mkdir -p /app/storage/voicemail /app/storage/recordings /app/storage/branding

EXPOSE 3000

CMD ["sh", "-c", "npx prisma migrate deploy && node server/index.js"]
