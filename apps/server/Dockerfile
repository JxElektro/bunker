# syntax=docker/dockerfile:1

FROM node:22-alpine AS build
WORKDIR /app

# Workspace install (root lockfile)
COPY package.json package-lock.json ./
COPY apps/server/package.json apps/server/package.json
COPY packages/protocol/package.json packages/protocol/package.json
COPY packages/protocol/tsconfig.json packages/protocol/tsconfig.json

RUN npm ci

COPY tsconfig.base.json ./tsconfig.base.json
COPY packages/protocol/src packages/protocol/src
COPY apps/server/tsconfig.json apps/server/tsconfig.json
COPY apps/server/src apps/server/src

RUN npm -w @bunker/protocol run build && npm -w @bunker/server run build

FROM node:22-alpine AS run
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=4040

COPY --from=build /app/package.json /app/package-lock.json ./
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/apps/server/package.json ./apps/server/package.json
COPY --from=build /app/apps/server/dist ./apps/server/dist
COPY --from=build /app/packages/protocol/package.json ./packages/protocol/package.json
COPY --from=build /app/packages/protocol/dist ./packages/protocol/dist

EXPOSE 4040
CMD ["node", "apps/server/dist/index.js"]

