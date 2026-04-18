# ============================================================
# PDF Toolbox — Docker 一键部署
# ============================================================
# 用法:
#   docker compose -f deploy/docker-compose.yml up -d --build
# 或:
#   docker build -f deploy/Dockerfile -t pdf-toolbox .
#   docker run -d -p 8080:80 --name pdf-toolbox pdf-toolbox
# ============================================================

FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci --ignore-scripts
COPY . .
RUN npm run build

# ---- 生产阶段 ----
FROM nginx:alpine
COPY --from=builder /app/dist /usr/share/nginx/html
COPY deploy/nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
