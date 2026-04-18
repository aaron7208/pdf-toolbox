/**
 * utils/file.js - 文件操作相关函数
 */

import { MAX_FILE_SIZE, formatSize } from './core.js'
import { showStatus } from './ui.js'

/**
 * 检查文件大小,超出返回 false 并显示警告
 */
export function checkFileSize(file, statusEl) {
  if (file.size > MAX_FILE_SIZE) {
    showStatus(statusEl, `⚠️ 文件过大(${formatSize(file.size)}),建议不超过 50MB`, 'warning')
    return false
  }
  return true
}

/**
 * 下载 Blob 文件
 */
export function downloadBlob(blob, filename, count = false) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  setTimeout(() => URL.revokeObjectURL(url), 1000)

  if (count) {
    try {
      const STORAGE_KEY = 'pdf-toolbox-processed-count'
      const current = parseInt(localStorage.getItem(STORAGE_KEY) || '0', 10) || 0
      const newCount = current + 1
      localStorage.setItem(STORAGE_KEY, newCount.toString())
      const el = document.getElementById('privacy-counter-value')
      if (el) {
        animateCounter(el, newCount)
      }
    } catch (e) {
      // 静默处理
    }
  }
}

/**
 * 数字滚动动画
 */
function animateCounter(el, targetValue) {
  const duration = 800
  const startTime = performance.now()
  const startValue = parseInt(el.dataset.current || '0', 10) || 0

  function step(currentTime) {
    const elapsed = currentTime - startTime
    const progress = Math.min(elapsed / duration, 1)
    const eased = progress === 1 ? 1 : 1 - Math.pow(2, -10 * progress)
    const currentValue = Math.round(startValue + (targetValue - startValue) * eased)
    el.textContent = currentValue.toLocaleString('en-US')
    el.dataset.current = currentValue.toString()
    if (progress < 1) {
      requestAnimationFrame(step)
    }
  }
  requestAnimationFrame(step)
}

/**
 * 强制释放内存资源
 */
export function cleanupResources() {
  // 清理悬空的 Blob URL
  setTimeout(() => {
    try {
      document.querySelectorAll('a[href^="blob:"], img[src^="blob:"]').forEach(el => {
        try {
          URL.revokeObjectURL(el.href || el.src)
          if (el.href) el.removeAttribute('href')
          if (el.src) el.removeAttribute('src')
        } catch (_) { /* ignore */ }
      })
    } catch (_) { /* ignore */ }
  }, 2000)

  // 清理 Canvas
  try {
    document.querySelectorAll('canvas').forEach(canvas => {
      try {
        const ctx = canvas.getContext('2d')
        if (ctx) {
          ctx.clearRect(0, 0, canvas.width, canvas.height)
        }
        canvas.width = 0
        canvas.height = 0
      } catch (_) { /* ignore */ }
    })
  } catch (_) { /* ignore */ }
}
