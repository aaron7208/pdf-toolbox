/**
 * utils/resource-manager.js - 资源管理器
 *
 * 统一管理应用中的资源生命周期，包括：
 * - Blob URL 跟踪和清理
 * - Canvas 上下文清理
 * - ArrayBuffer 内存释放
 * - 内存监控
 */

// 跟踪需要清理的资源
const trackedBlobUrls = new Set()
const trackedCanvases = new WeakSet()
const trackedArrayBuffers = new WeakSet()

/**
 * 创建并跟踪 Blob URL
 * @param {Blob} blob - Blob 对象
 * @returns {string} Blob URL
 */
export function createTrackedBlobUrl(blob) {
  const url = URL.createObjectURL(blob)
  trackedBlobUrls.add(url)
  return url
}

/**
 * 撤销 Blob URL 并从跟踪集合中移除
 * @param {string} url - Blob URL
 */
export function revokeTrackedBlobUrl(url) {
  if (trackedBlobUrls.has(url)) {
    URL.revokeObjectURL(url)
    trackedBlobUrls.delete(url)
  }
}

/**
 * 跟踪 Canvas 元素
 * @param {HTMLCanvasElement} canvas - Canvas 元素
 */
export function trackCanvas(canvas) {
  trackedCanvases.add(canvas)
}

/**
 * 清理所有跟踪的资源
 * @param {object} [options] - 清理选项
 * @param {boolean} [options.immediate=false] - 是否立即清理（不延迟）
 * @param {boolean} [options.blobs=true] - 是否清理 Blob URL
 * @param {boolean} [options.canvases=true] - 是否清理 Canvas
 */
export function cleanupAll(options = {}) {
  const { immediate = false, blobs = true, canvases = true } = options

  if (blobs) {
    if (immediate) {
      for (const url of trackedBlobUrls) {
        try {
          URL.revokeObjectURL(url)
        } catch (_) { /* ignore */ }
      }
      trackedBlobUrls.clear()
    } else {
      // 延迟清理，确保下载已开始
      setTimeout(() => {
        for (const url of trackedBlobUrls) {
          try {
            URL.revokeObjectURL(url)
          } catch (_) { /* ignore */ }
        }
        trackedBlobUrls.clear()
      }, 2000)
    }
  }

  if (canvases) {
    cleanupCanvases()
  }
}

/**
 * 清理所有 Canvas 资源
 */
function cleanupCanvases() {
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

/**
 * 安全释放 ArrayBuffer（不填充零，直接脱离引用）
 * @param {ArrayBuffer} buffer - 要释放的 ArrayBuffer
 */
export function releaseArrayBuffer(buffer) {
  if (buffer && buffer.byteLength > 0) {
    // 不需要 fill(0)，直接让 GC 回收
    // 填充零反而会增加内存压力
    trackedArrayBuffers.delete(buffer)
  }
}

/**
 * 获取内存使用信息（仅 Chrome 支持）
 * @returns {object|null} 内存信息，不支持时返回 null
 */
export function getMemoryInfo() {
  if (performance.memory) {
    return {
      usedJSHeapSize: performance.memory.usedJSHeapSize,
      totalJSHeapSize: performance.memory.totalJSHeapSize,
      jsHeapSizeLimit: performance.memory.jsHeapSizeLimit,
      usedPercent: (performance.memory.usedJSHeapSize / performance.memory.jsHeapSizeLimit * 100).toFixed(1) + '%',
    }
  }
  return null
}

/**
 * 检查内存是否接近限制
 * @param {number} [threshold=0.8] - 阈值（0-1），默认 80%
 * @returns {boolean} 是否接近限制
 */
export function isMemoryCritical(threshold = 0.8) {
  if (performance.memory) {
    const ratio = performance.memory.usedJSHeapSize / performance.memory.jsHeapSizeLimit
    return ratio > threshold
  }
  return false
}

/**
 * 获取跟踪的资源数量
 * @returns {object} 资源统计
 */
export function getTrackedResourceCount() {
  return {
    blobUrls: trackedBlobUrls.size,
    arrayBuffers: 'weak reference (无法统计)',
  }
}

/**
 * 清理 DOM 中的 Blob URL 引用
 * @param {HTMLElement} [container=document] - 容器元素
 */
export function cleanupDomBlobRefs(container = document) {
  try {
    container.querySelectorAll('a[href^="blob:"], img[src^="blob:"]').forEach(el => {
      try {
        const url = el.href || el.src
        if (trackedBlobUrls.has(url)) {
          URL.revokeObjectURL(url)
          trackedBlobUrls.delete(url)
        }
        if (el.href) el.removeAttribute('href')
        if (el.src) el.removeAttribute('src')
      } catch (_) { /* ignore */ }
    })
  } catch (_) { /* ignore */ }
}
