# PDF Toolbox — 一键部署指南

## 🚀 快速开始（3 选 1）

### 方式一：Docker Compose（推荐）

```bash
docker compose -f deploy/docker-compose.yml up -d --build
```

访问 `http://localhost:8080`

### 方式二：Windows 一键安装

```powershell
powershell -ExecutionPolicy Bypass -File deploy\install.ps1
```

自动完成：检查 Node.js → 安装依赖 → 构建 → 启动开发服务器

### 方式三：Linux/macOS 一键安装

```bash
chmod +x deploy/install.sh && ./deploy/install.sh
```

---

## 手动部署

```bash
npm ci && npm run build
```

产物在 `dist/` 目录，可部署到任何静态服务器。

### Docker 手动

```bash
docker build -f deploy/Dockerfile -t pdf-toolbox .
docker run -d -p 8080:80 --name pdf-toolbox pdf-toolbox
```

---

## 生产环境建议

- **HTTPS** — 使用 Let's Encrypt
- **CDN** — Cloudflare 等
- **监控** — 替换 `index.html` 中的 Clarity/GA4 占位 ID
- **PWA** — 已内置 Service Worker，支持离线
