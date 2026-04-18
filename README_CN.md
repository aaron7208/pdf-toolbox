[English](README.md) | 中文

# 🧰 PDF 工具箱

> **文件不出本地，财务 PDF 一次搞定。**

免费在线 PDF 工具箱 — 合并、压缩、拆分、转图片、加水印。所有处理在浏览器中完成，文件不离开你的设备。

[🌐 在线演示](https://aaron7208.github.io/pdf-toolbox/) · [🔒 安全白皮书](SECURITY.md) · [📋 反馈问题](https://github.com/aaron7208/pdf-toolbox/issues)

---

## 📸 功能演示

> *[截图占位：首页功能网格]*

> *[截图占位：工作流 Pipeline 界面]*

> *[截图占位：处理结果下载]*

---

## ✨ 核心特性

| 特性 | 说明 |
|------|------|
| 🏠 **纯前端** | 所有处理在浏览器中完成，无需后端服务器 |
| 📴 **离线可用** | PWA 支持，安装后可完全离线使用 |
| 🔒 **零上传** | 文件永远不会离开你的设备，隐私有保障 |
| 🛡️ **安全模式** | 一键开启，处理完成后不留任何本地痕迹 |
| ⚡ **Pipeline 工作流** | 组合多个处理步骤，一键执行复杂操作 |
| 📋 **快速模板** | 预置发票合并、报表压缩、合同保护等财务场景模板 |
| 🎨 **深色模式** | 支持浅色/深色主题，跟随系统偏好 |
| 📱 **PWA 安装** | 添加到桌面，像原生应用一样使用 |
| 🆓 **开源免费** | MIT 协议，可自由使用和修改 |

---

## 🛠️ 功能列表

- **👁️ 查看 PDF** — 在浏览器中预览，支持缩放和翻页
- **🔗 合并 PDF** — 将多个 PDF 合并为一个文件
- **📦 压缩 PDF** — 优化文件体积，便于传输和存储
- **🖼️ 转图片** — 将 PDF 页面导出为 PNG 或 JPG
- **✂️ 拆分 PDF** — 按页码拆分 PDF 为独立文件
- **📸 图片转 PDF** — 将多张图片合并为 PDF
- **💧 加水印** — 添加文字或图片水印，支持居中和平铺
- **📝 编辑元数据** — 设置 PDF 标题、作者、主题、关键词
- **⚡ 工作流** — 组合多个步骤，一键完成复杂处理

---

## 🚀 本地开发

### 环境要求

- Node.js >= 18
- npm >= 9

### 快速开始

```bash
# 1. 克隆仓库
git clone https://github.com/aaron7208/pdf-toolbox.git
cd pdf-toolbox

# 2. 安装依赖
npm install

# 3. 启动开发服务器
npm run dev
```

开发服务器默认在 `http://localhost:5173` 启动。

### 构建生产版本

```bash
# 构建到 dist/ 目录
npm run build

# 本地预览构建结果
npm run preview
```

构建产物也可部署到任意静态托管服务（GitHub Pages、Vercel、Netlify 等）。

### 部署到 GitHub Pages

项目已配置 `docs/` 目录作为 Pages 入口。构建后将产物复制到 `docs/`：

```bash
npm run build
cp dist/* docs/
git add docs/ && git commit -m "deploy: update docs" && git push
```

---

## 📱 安装为 PWA

安装后支持完全离线使用：

### 桌面端（Chrome / Edge）

1. 访问网站后，地址栏右侧会出现 **安装** 图标
2. 点击安装，或使用菜单 → **安装 PDF 工具箱**
3. 安装后作为独立窗口打开，可固定到任务栏

### 移动端（iOS Safari）

1. 用 Safari 打开网站
2. 点击 **分享** 按钮 → **添加到主屏幕**
3. 确认后即可在主屏幕看到应用图标

### 移动端（Android Chrome）

1. 用 Chrome 打开网站
2. 点击菜单（⋮）→ **安装应用**
3. 确认安装

---

## 🔧 技术栈

| 技术 | 用途 |
|------|------|
| [Vite](https://vitejs.dev/) | 构建工具 |
| [pdf-lib](https://pdf-lib.js.org/) | PDF 编辑（合并、压缩、水印、元数据） |
| [pdf.js](https://mozilla.github.io/pdf.js/) | PDF 渲染（查看、转图片） |
| [JSZip](https://stuk.github.io/jszip/) | 批量处理后 ZIP 打包下载 |
| [Workbox](https://developer.chrome.com/docs/workbox/) | PWA Service Worker 缓存 |

**零后端依赖** — 纯静态文件，可部署到任何支持静态托管的平台。

---

## 🔒 安全承诺

我们承诺：

- 所有 PDF 处理在浏览器中完成
- 文件不会上传到任何服务器
- 开启安全模式后不留任何本地痕迹
- 代码开源可审计

详细信息请参阅 [🔒 安全白皮书](SECURITY.md)。

---

## 📝 许可证

[MIT License](LICENSE)

---

## ⭐ 如果你觉得这个项目有用，欢迎 Star 支持！

[![GitHub stars](https://img.shields.io/github/stars/aaron7208/pdf-toolbox?style=social)](https://github.com/aaron7208/pdf-toolbox)
