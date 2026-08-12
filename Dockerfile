# syntax=docker/dockerfile:1

# ---- Build stage: compile the Angular SSR bundle ----
# Node 24 is pinned so node:sqlite (used by src/server/db.ts) behaves the same
# here as in production, independent of the host's default Node.
FROM node:24-slim AS build
WORKDIR /app

# Install all deps (incl. devDependencies) — the Angular build needs them.
COPY package.json package-lock.json ./
RUN npm ci

COPY . .
RUN npm run build

# ---- Runtime stage: slim image with production deps only ----
FROM node:24-slim AS runtime
ENV NODE_ENV=production
WORKDIR /app

# Only the runtime dependencies (express, @angular/ssr, nodemailer, stripe, …).
COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force

# The compiled server + browser assets.
COPY --from=build /app/dist ./dist

# The SQLite database lives on a mounted volume at /data (see render.yaml).
# Create it now and hand ownership to the unprivileged user we run as.
RUN mkdir -p /data && chown -R node:node /data
USER node

# Render (and most platforms) inject PORT; src/server.ts reads it, defaulting
# to 4000. EXPOSE is documentation — the platform maps the real port.
EXPOSE 4000

CMD ["node", "dist/heartdog-homestead/server/server.mjs"]
