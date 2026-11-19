# SPDX-License-Identifier: AGPL-3.0-or-later
# © 2026 rrstudio — rrstudio tools
#
# Immagine per tools.rr-dev.eu: build statica di Angular servita da nginx senza root.
# Se typecheck, test o build falliscono l'immagine non si crea e il sito resta com'è.

FROM node:24-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY . .
RUN npm run typecheck && npm test && npm run build

FROM nginxinc/nginx-unprivileged:1.29-alpine
COPY deploy/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist/rrstudio-tools/browser /usr/share/nginx/html
EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=3s \
  CMD wget -qO- http://127.0.0.1:8080/ > /dev/null || exit 1
