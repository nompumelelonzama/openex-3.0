FROM node:20-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .

# Render translates env vars set on this service into Docker build args
# with matching names -- declaring them here makes them available to the
# `npm run build` step below, so Vite can bake the real API URLs into the
# built JS bundle (Vite only exposes VITE_-prefixed vars, and only at
# build time, not runtime).
ARG VITE_API_BASE
ARG VITE_ANALYTICS_API_BASE
ENV VITE_API_BASE=$VITE_API_BASE
ENV VITE_ANALYTICS_API_BASE=$VITE_ANALYTICS_API_BASE

RUN npm run build

FROM node:20-alpine
WORKDIR /app
RUN npm install -g serve
COPY --from=build /app/dist ./dist
EXPOSE 5173
CMD ["serve", "-s", "dist", "-l", "5173"]
