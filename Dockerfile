# Etapa 1: Compilar el frontend con Vite
FROM node:20-alpine AS build
WORKDIR /app

# Copiar dependencias e instalarlas
COPY package*.json ./
RUN npm install

# Copiar el código y compilar
COPY . .
RUN npm run build

# Etapa 2: Servir los archivos estáticos con nginx
FROM nginx:alpine

# Copiar los archivos compilados de la etapa anterior
COPY --from=build /app/dist /usr/share/nginx/html

# Copiar la configuración de nginx (para que las rutas de React funcionen)
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]