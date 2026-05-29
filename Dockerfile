FROM node:24-bookworm-slim AS deps
WORKDIR /app
RUN apt-get update -y \
  && apt-get install -y --no-install-recommends openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/*
COPY package*.json prisma.config.ts ./
COPY prisma ./prisma
RUN DATABASE_URL="mysql://dummy:dummy@localhost:3306/dummy?ssl=false" npm ci

FROM deps AS build
WORKDIR /app
COPY backend ./backend
COPY frontend ./frontend
RUN npm run build

FROM node:24-bookworm-slim AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3000
RUN apt-get update -y \
  && apt-get install -y --no-install-recommends openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/*
COPY package*.json prisma.config.ts ./
COPY prisma ./prisma
RUN DATABASE_URL="mysql://dummy:dummy@localhost:3306/dummy?ssl=false" npm ci --omit=dev && npm cache clean --force
COPY --from=build /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=build /app/dist ./dist
COPY backend ./backend
EXPOSE 3000
CMD ["npm", "run", "start"]
