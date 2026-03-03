FROM node:20-alpine AS base
WORKDIR /app

FROM base AS deps
COPY package.json package-lock.json ./
RUN npm ci

FROM deps AS build
COPY tsconfig.json tsconfig.build.json ./
COPY prisma ./prisma
COPY src ./src
RUN npm run prisma:generate
RUN npm run build

FROM base AS runtime
ENV NODE_ENV=production
COPY package.json package-lock.json ./
RUN npm ci --omit=dev
COPY --from=build /app/dist ./dist
COPY --from=build /app/prisma ./prisma
COPY .env.example ./.env.example
RUN npm run prisma:generate
CMD ["node", "dist/src/main.js"]
