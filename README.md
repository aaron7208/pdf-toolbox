English | [中文](README_CN.md)

# 🧰 PDF Toolbox

> **Process PDFs locally in your browser. Zero uploads. Zero leaks.**

Free, open-source PDF tools — merge, compress, split, convert to images, add watermarks. Everything runs entirely in your browser. Your files never leave your device.

[🌐 Live Demo](https://aaron7208.github.io/pdf-toolbox/) · [🔒 Security Commitment](SECURITY.md) · [📋 Report Issues](https://github.com/aaron7208/pdf-toolbox/issues)

---

## 📸 Screenshots

> *[Screenshot: Homepage feature grid]*

> *[Screenshot: Pipeline workflow UI]*

> *[Screenshot: Processing result download]*

---

## ✨ Features

| Feature | Description |
|---------|-------------|
| 🏠 **Pure Frontend** | All processing runs in the browser — no backend server needed |
| 📴 **Offline Ready** | PWA support, fully usable after installation without internet |
| 🔒 **Zero Uploads** | Files never leave your device. Period. |
| 🛡️ **Security Mode** | One-click cleanup — leaves no local traces after processing |
| ⚡ **Pipeline** | Chain multiple processing steps and run complex tasks in one click |
| 📋 **Templates** | Pre-built templates for common scenarios (invoice merge, report compress, contract protection) |
| 🎨 **Dark Mode** | Light/dark theme with system preference detection |
| 📱 **PWA Installable** | Add to desktop, works like a native app |
| 🆓 **MIT License** | Free to use, modify, and distribute |

---

## 🛠️ Tools

| Tool | Description |
|------|-------------|
| 👁️ **View PDF** | Preview PDFs in-browser with zoom and page navigation |
| 🔗 **Merge PDF** | Combine multiple PDF files into one document |
| 📦 **Compress PDF** | Optimize file size for easier sharing and storage |
| 🖼️ **PDF to Images** | Export each PDF page as PNG or JPG |
| ✂️ **Split PDF** | Split a PDF into individual pages by page number |
| 📸 **Images to PDF** | Combine multiple images into a single PDF |
| 💧 **Watermark** | Add text or image watermarks, centered or tiled |
| 📝 **Edit Metadata** | Modify PDF title, author, subject, and keywords |
| ⚡ **Pipeline** | Chain multiple steps for batch processing |

---

## 🚀 Quick Start

### Prerequisites

- Node.js >= 18
- npm >= 9

### Development

```bash
# 1. Clone the repository
git clone https://github.com/aaron7208/pdf-toolbox.git
cd pdf-toolbox

# 2. Install dependencies
npm install

# 3. Start the dev server
npm run dev
```

The development server runs at `http://localhost:5173`.

### Production Build

```bash
# Build to dist/ directory
npm run build

# Preview the production build locally
npm run preview
```

The build output can be deployed to any static hosting service — GitHub Pages, Vercel, Netlify, Cloudflare Pages, etc.

### Deploy to GitHub Pages

The project uses the `docs/` directory as the GitHub Pages entry point. After building, copy the output to `docs/`:

```bash
npm run build
cp -r dist/* docs/
git add docs/ && git commit -m "deploy: update docs" && git push
```

---

## 📱 Install as PWA

After installation, PDF Toolbox works fully offline.

### Desktop (Chrome / Edge)

1. Visit the site — an **install** icon appears in the address bar
2. Click install, or use the browser menu → **Install PDF Toolbox**
3. The app opens as a standalone window and can be pinned to the taskbar

### Mobile (iOS Safari)

1. Open the site in **Safari**
2. Tap **Share** → **Add to Home Screen**
3. Confirm — the app icon appears on your home screen

### Mobile (Android Chrome)

1. Open the site in **Chrome**
2. Tap the menu (⋮) → **Install app**
3. Confirm installation

---

## 🔧 Tech Stack

| Technology | Purpose |
|------------|---------|
| [Vite](https://vitejs.dev/) | Build tool and dev server |
| [pdf-lib](https://pdf-lib.js.org/) | PDF manipulation (merge, compress, watermark, metadata) |
| [pdf.js](https://mozilla.github.io/pdf.js/) | PDF rendering (view, export to images) |
| [JSZip](https://stuk.github.io/jszip/) | Batch processing and ZIP downloads |
| [Workbox](https://developer.chrome.com/docs/workbox/) | PWA Service Worker caching |

**Zero backend dependencies.** Pure static files, deployable anywhere.

---

## 🔒 Security

We are committed to:

- **100% client-side processing** — your files never leave your device
- **No server-side storage** — no database, no cloud, no analytics
- **Security Mode** — one-click cleanup leaves no local traces
- **Open source** — code is fully auditable

Read our full [Security Commitment →](SECURITY.md)

---

## 🆚 PDF Toolbox vs Cloud PDF Tools

Cloud-based tools are great for many use cases. PDF Toolbox takes a different approach — everything runs locally in your browser, giving you full control over your data.

| Feature | PDF Toolbox | Typical Cloud Tools |
|---------|-------------|--------------------|
| Processing | Runs in your browser | Requires uploading files |
| Offline use | ✅ PWA support | Requires internet |
| File size | Limited by browser memory | Often capped at 5–100MB on free tiers |
| Cost | Free forever | Free tiers with paid upgrades |
| Source code | Fully open (MIT) | Generally closed source |
| Self-hostable | Yes, deploy anywhere | Not applicable |

---

## 📄 License

[MIT License](LICENSE) — free for personal and commercial use.

---

## ⭐ Support the Project

If you find PDF Toolbox useful, a star goes a long way.

[![GitHub stars](https://img.shields.io/github/stars/aaron7208/pdf-toolbox?style=social)](https://github.com/aaron7208/pdf-toolbox)
