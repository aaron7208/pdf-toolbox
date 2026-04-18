/**
 * pdf/pdfjs-init.js - 统一 PDF.js 初始化模块
 *
 * 集中管理 PDF.js 的 Worker 配置和实例获取，避免各模块重复处理。
 * 支持 CDN 主备切换和延迟加载。
 */

const PDFJS_WORKER_VERSION = '3.11.174'
const PDFJS_CDN_PRIMARY = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${PDFJS_WORKER_VERSION}/pdf.worker.min.js`
const PDFJS_CDN_FALLBACK = `https://cdn.jsdelivr.net/npm/pdfjs-dist@${PDFJS_WORKER_VERSION}/build/pdf.worker.min.js`

let pdfjsLib = null
let isInitialized = false
let initPromise = null

/**
 * 初始化 PDF.js（设置 Worker 源）
 * @param {object} [options] - 初始化选项
 * @param {string} [options.workerSrc] - 自定义 Worker 源（可选）
 * @returns {Promise<object>} PDF.js 实例
 */
export async function initPdfjs(options = {}) {
  if (isInitialized && pdfjsLib) {
    return pdfjsLib
  }

  if (initPromise) {
    return initPromise
  }

  initPromise = (async () => {
    try {
      const lib = await import('pdfjs-dist')
      pdfjsLib = lib

      const workerSrc = options.workerSrc || PDFJS_CDN_PRIMARY
      lib.GlobalWorkerOptions.workerSrc = workerSrc

      isInitialized = true
      return lib
    } catch (err) {
      console.warn('[PDF.js] 主 CDN 加载失败，尝试备用 CDN:', err.message)
      try {
        const lib = await import('pdfjs-dist')
        pdfjsLib = lib
        lib.GlobalWorkerOptions.workerSrc = PDFJS_CDN_FALLBACK
        isInitialized = true
        return lib
      } catch (fallbackErr) {
        console.error('[PDF.js] 备用 CDN 也加载失败:', fallbackErr.message)
        throw new Error('PDF.js 加载失败，请检查网络连接')
      }
    }
  })()

  return initPromise
}

/**
 * 获取 PDF.js 实例（如果未初始化则自动初始化）
 * @returns {Promise<object>} PDF.js 实例
 */
export async function getPdfjs() {
  if (isInitialized && pdfjsLib) {
    return pdfjsLib
  }
  return initPdfjs()
}

/**
 * 同步获取 PDF.js 实例（仅当已初始化时）
 * @returns {object|null} PDF.js 实例，未初始化时返回 null
 */
export function getPdfjsSync() {
  return isInitialized ? pdfjsLib : null
}

/**
 * 重置 PDF.js 实例（用于测试或重新初始化）
 */
export function resetPdfjs() {
  pdfjsLib = null
  isInitialized = false
  initPromise = null
}

/**
 * 检查 PDF.js 是否已初始化
 * @returns {boolean}
 */
export function isPdfjsReady() {
  return isInitialized && pdfjsLib !== null
}

/**
 * 获取 Worker 配置信息
 * @returns {object} Worker 配置
 */
export function getWorkerConfig() {
  return {
    version: PDFJS_WORKER_VERSION,
    primary: PDFJS_CDN_PRIMARY,
    fallback: PDFJS_CDN_FALLBACK,
    isInitialized,
  }
}
