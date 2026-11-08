# Multi-stage production Dockerfile for React + Vite Frontend
FROM node:20-alpine AS builder

WORKDIR /app
COPY package*.json ./
RUN npm ci

COPY . .

# Build argument for API base URL at build time
ARG VITE_API_URL=/api
ARG VITE_AI_URL=/ai
ENV VITE_API_URL=${VITE_API_URL} \
    VITE_AI_URL=${VITE_AI_URL}

RUN npm run build

FROM nginx:alpine AS runner

COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

HEALTHCHECK --interval=30s --timeout=3s --retries=3 \
  CMD wget --spider http://127.0.0.1/ || exit 1

CMD ["nginx", "-g", "daemon off;"]
