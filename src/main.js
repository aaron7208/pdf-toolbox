/**
 * main.js - PDF 工具箱 入口
 */

import { initModal } from './modules/modal.js'
import { initView } from './modules/view.js'
import { initMerge } from './modules/merge.js'
import { initCompress } from './modules/compress.js'
import { initImg } from './modules/img.js'
import { initSplit } from './modules/split.js'
import { initImg2Pdf } from './modules/img2pdf.js'
import { initWatermark } from './modules/watermark.js'
import { initInvoiceNup } from './modules/invoice-nup.js'
import { initRedaction } from './modules/redaction.js'
import { initPipeline } from './modules/pipeline-ui.js'
import { initPageManager } from './modules/page-manager.js'
import { initEncrypt } from './modules/encrypt.js'
import { initPageNumber } from './modules/page-number.js'
import { initSearch } from './modules/search.js'
import { initShortcuts } from './modules/shortcuts.js'
import { initSignature } from './modules/signature.js'
import { initRecentUsage } from './modules/recent-usage.js'
import { initBatchExtract } from './modules/batch-extract.js'
import { initBatchDelete } from './modules/batch-delete.js'
import { initBatchRotate } from './modules/batch-rotate.js'
import { initReverseOrder } from './modules/reverse-order.js'

// Web Worker client
import { initWorker } from './worker-client.js'
import PdfWorkerUrl from './pdf-worker.js?url'

// PDF.js - npm import
import * as pdfjsLib from 'pdfjs-dist'

// PDF.js worker — 主 CDN（cdnjs）+ 备用 CDN（jsdelivr）
import { PDFJS_CDN_PRIMARY, PDFJS_CDN_FALLBACK } from './utils.js'
pdfjsLib.GlobalWorkerOptions.workerSrc = PDFJS_CDN_PRIMARY

// Expose globally so utils.js showUploadFileInfo can access it
window.pdfjsLib = pdfjsLib

// pdf-lib - npm import
import * as PDFLib from 'pdf-lib'

// ===== Safe Mode (default ON, no toggle needed) =====
// 应用 100% 纯前端，所有文件本地处理，天然安全。
// 安全模式始终启用：严格 CSP + 关闭时清除本地数据。
window.__safeMode = true

/**
 * Apply strict CSP meta tag for safe mode
 */
function applyStrictCSP() {
  // Remove existing CSP meta if any
  const existing = document.querySelector('meta[http-equiv="Content-Security-Policy"]')
  if (existing) existing.remove()

  const meta = document.createElement('meta')
  meta.setAttribute('http-equiv', 'Content-Security-Policy')
  // Strict CSP: only same-origin scripts/styles, no inline eval, allow Clarity + GA for analytics
  meta.content = [
    "default-src 'self'",
    "script-src 'self' https://www.clarity.ms https://www.googletagmanager.com 'unsafe-inline'",
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob:",
    "font-src 'self' data:",
    "connect-src 'self' https://www.clarity.ms https://*.clarity.ms https://www.google-analytics.com",
    "frame-src 'none'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'"
  ].join('; ')
  document.head.appendChild(meta)
}

/**
 * Remove CSP meta tag when safe mode is disabled
 */
function removeStrictCSP() {
  const meta = document.querySelector('meta[http-equiv="Content-Security-Policy"]')
  if (meta) meta.remove()
}

/**
 * Clear all local data: Service Worker caches, IndexedDB, sessionStorage
 */
async function clearAllLocalData() {
  try {
    // 1. Clear Service Worker caches
    if ('caches' in window) {
      const cacheNames = await caches.keys()
      await Promise.all(cacheNames.map(name => caches.delete(name)))
    }

    // 2. Clear IndexedDB databases
    if ('indexedDB' in window && indexedDB.databases) {
      const dbNames = await indexedDB.databases()
      await Promise.all(
        dbNames
          .map(db => db.name)
          .filter(Boolean)
          .map(name => new Promise((resolve) => {
            const req = indexedDB.deleteDatabase(name)
            req.onsuccess = () => resolve()
            req.onerror = () => resolve() // 静默处理
          }))
      )
    }

    // 3. Clear sessionStorage (safe mode state only)
    sessionStorage.removeItem('pdf-toolbox-safe-mode')
  } catch (e) {
    // 静默处理清除失败
  }
}

/**
 * Initialize safe mode (always ON, no toggle)
 */
function initSafeMode() {
  // 始终启用安全模式：应用 CSP + 关闭时清除数据
  applyStrictCSP()
  document.body.classList.add('safe-mode-active')

  // 页面关闭时清除本地数据
  window.addEventListener('beforeunload', () => {
    clearAllLocalData()
  })
}

// ===== Dark Mode Toggle =====
function initThemeToggle() {
  const btn = document.getElementById('theme-toggle')
  if (!btn) return

  // Update button icon based on current theme
  function updateIcon() {
    const theme = document.documentElement.getAttribute('data-theme')
    btn.textContent = theme === 'dark' ? '☀️' : '🌙'
  }
  updateIcon()

  btn.addEventListener('click', () => {
    const current = document.documentElement.getAttribute('data-theme')
    if (current === 'dark') {
      document.documentElement.removeAttribute('data-theme')
      if (!window.__safeMode) localStorage.setItem('pdf-toolbox-theme', 'light')
    } else {
      document.documentElement.setAttribute('data-theme', 'dark')
      if (!window.__safeMode) localStorage.setItem('pdf-toolbox-theme', 'dark')
    }
    updateIcon()
    
    // 强制重绘所有 modal 以应用新主题
    document.querySelectorAll('.modal-overlay').forEach(modal => {
      if (modal.classList.contains('open')) {
        modal.style.display = 'none'
        modal.offsetHeight // 触发重排
        modal.style.display = ''
      }
    })
  })
}

// ===== Privacy Counter =====
function initPrivacyCounter() {
  const STORAGE_KEY = 'pdf-toolbox-processed-count'
  const el = document.getElementById('privacy-counter-value')
  if (!el) return

  let count = parseInt(localStorage.getItem(STORAGE_KEY), 10)
  if (isNaN(count)) count = 0

  // 初始显示 0，然后滚动到目标值
  el.dataset.current = '0'
  el.textContent = '0'
  setTimeout(() => {
    const duration = 800
    const startTime = performance.now()
    function step(currentTime) {
      const elapsed = currentTime - startTime
      const progress = Math.min(elapsed / duration, 1)
      const eased = progress === 1 ? 1 : 1 - Math.pow(2, -10 * progress)
      const currentValue = Math.round(count * eased)
      el.textContent = currentValue.toLocaleString('en-US')
      el.dataset.current = currentValue.toString()
      if (progress < 1) requestAnimationFrame(step)
    }
    requestAnimationFrame(step)
  }, 300)
}

// ===== PWA Install Prompt =====
function initPWAInstall() {
  const prompt = document.getElementById('install-prompt')
  const installBtn = document.getElementById('install-btn')
  const dismissBtn = document.getElementById('install-dismiss')
  if (!prompt || !installBtn) return

  let deferredPrompt = null

  // 用户已安装过则不再显示
  if (window.matchMedia('(display-mode: standalone)').matches) return
  // 安全模式下不读取安装提示状态
  if (!window.__safeMode && localStorage.getItem('pdf-toolbox-install-dismissed')) return

  // 监听 beforeinstallprompt 事件
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault()
    deferredPrompt = e
    prompt.classList.add('visible')
  })

  // 点击安装按钮
  installBtn.addEventListener('click', async () => {
    if (!deferredPrompt) return
    deferredPrompt.prompt()
    const { outcome } = await deferredPrompt.userChoice
    if (outcome === 'accepted') {
      prompt.classList.remove('visible')
    }
    deferredPrompt = null
  })

  // 关闭提示条
  dismissBtn.addEventListener('click', () => {
    prompt.classList.remove('visible')
    // 安全模式下不保存安装提示状态
    if (!window.__safeMode) localStorage.setItem('pdf-toolbox-install-dismissed', '1')
  })

  // 安装完成后自动隐藏
  window.addEventListener('appinstalled', () => {
    prompt.classList.remove('visible')
    deferredPrompt = null
  })
}

// ===== Cache Clear =====
function initCacheClear() {
  const overlay = document.getElementById('cache-confirm-overlay')
  const openBtn = document.getElementById('cache-clear-btn')
  const cancelBtn = document.getElementById('cache-cancel-btn')
  const confirmBtn = document.getElementById('cache-confirm-clear-btn')
  if (!overlay || !openBtn) return

  // 打开确认对话框
  openBtn.addEventListener('click', () => {
    overlay.classList.add('open')
  })

  // 关闭对话框
  function closeDialog() {
    overlay.classList.remove('open')
  }
  cancelBtn.addEventListener('click', closeDialog)
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) closeDialog()
  })

  // 确认清除
  confirmBtn.addEventListener('click', async () => {
    confirmBtn.disabled = true
    confirmBtn.textContent = '清除中...'

    try {
      // 1. 清除 localStorage（保留处理计数）
      const keysToClear = [
        'pdf-toolbox-theme',
        'pdf-toolbox-install-dismissed',
      ]
      keysToClear.forEach(key => localStorage.removeItem(key))

      // 2. 清除 IndexedDB 数据库
      if ('indexedDB' in window) {
        const dbNames = await getIndexedDBNames()
        await Promise.all(dbNames.map(name => deleteIndexedDB(name)))
      }

      // 3. 清除 Service Worker 缓存
      if ('caches' in window) {
        const cacheNames = await caches.keys()
        await Promise.all(cacheNames.map(name => caches.delete(name)))
      }

      // 4. 注销 Service Worker
      if ('serviceWorker' in navigator) {
        const registrations = await navigator.serviceWorker.getRegistrations()
        await Promise.all(registrations.map(reg => reg.unregister()))
      }

      // 反馈：显示成功提示
      closeDialog()
      showToast('✅ 所有缓存已清除，页面将刷新...', 'success')
      setTimeout(() => window.location.reload(), 1500)
    } catch (err) {
      closeDialog()
      showToast('清除失败：' + err.message, 'error')
      confirmBtn.disabled = false
      confirmBtn.textContent = '确认清除'
    }
  })

  // ---- 辅助函数 ----
  function getIndexedDBNames() {
    return new Promise((resolve, reject) => {
      if (!indexedDB.databases) {
        // databases() 不可用时返回空数组（Firefox 旧版本）
        resolve([])
        return
      }
      indexedDB.databases()
        .then(dbs => resolve(dbs.map(db => db.name).filter(Boolean)))
        .catch(() => resolve([]))
    })
  }

  function deleteIndexedDB(name) {
    return new Promise((resolve, reject) => {
      const req = indexedDB.deleteDatabase(name)
      req.onsuccess = () => resolve()
      req.onerror = () => reject(new Error('删除 IndexedDB 失败: ' + name))
      req.onblocked = () => reject(new Error('IndexedDB 被占用: ' + name))
    })
  }

  // ---- Toast 提示 ----
  function showToast(message, type) {
    // 尝试复用现有的 status 元素，或创建一个临时 toast
    const existing = document.querySelector('#cache-toast')
    if (existing) existing.remove()

    const toast = document.createElement('div')
    toast.id = 'cache-toast'
    toast.className = 'status ' + (type === 'success' ? 'success' : 'error')
    toast.textContent = message
    toast.style.cssText = `
      position: fixed; bottom: 2rem; left: 50%; transform: translateX(-50%);
      z-index: 10001; max-width: 90vw; text-align: center;
      animation: statusFadeIn 0.3s ease;
    `
    document.body.appendChild(toast)
    setTimeout(() => toast.remove(), 3000)
  }
}

// Initialize Web Worker
initWorker(PdfWorkerUrl)

// Initialize all modules
document.addEventListener('DOMContentLoaded', () => {
  initSafeMode()
  initThemeToggle()
  initPrivacyCounter()
  initModal()
  initView()
  initMerge()
  initCompress()
  initImg()
  initSplit()
  initImg2Pdf()
  initWatermark()
  initInvoiceNup()
  initRedaction()
  initPWAInstall()
  initCacheClear()
  initPipeline()
  initPageManager()
  initEncrypt()
  initPageNumber()
  initSearch()
  initShortcuts()
  initSignature()
  initRecentUsage()
  initBatchExtract()
  initBatchDelete()
  initBatchRotate()
  initReverseOrder()
})
