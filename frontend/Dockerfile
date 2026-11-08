# ==============================================================================
# Dockerfile para Frontend React + Vite + Material UI
# Multi-stage build optimizado con servidor Nginx ligero
# ==============================================================================

# Etapa 1: Build de la aplicación con Node.js
FROM node:20-alpine AS builder

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build

# Etapa 2: Servidor estático de alto rendimiento Nginx
FROM nginx:alpine

# Copiar archivos compilados de la etapa anterior
COPY --from=builder /app/dist /usr/share/nginx/html

# Configuración de Nginx para SPA y Proxy inverso hacia el Backend
RUN echo 'server { \
  listen 80; \
  location / { \
  root /usr/share/nginx/html; \
  index index.html index.htm; \
  try_files $uri $uri/ /index.html; \
  } \
  location /analisis-forestal { \
  proxy_pass http://backend:8080/analisis-forestal; \
  proxy_set_header Host $host; \
  proxy_set_header X-Real-IP $remote_addr; \
  } \
  location /muestras { \
  proxy_pass http://backend:8080/muestras; \
  proxy_set_header Host $host; \
  proxy_set_header X-Real-IP $remote_addr; \
  } \
  }' > /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]