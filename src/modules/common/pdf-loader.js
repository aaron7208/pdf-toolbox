/**
 * pdf-loader.js - PDF 加载与加密检查封装
 *
 * 统一处理 PDF 文件的加载逻辑，包括：
 * - PDF.js 加载（用于预览和获取页数）
 * - pdf-lib 加载（用于处理）
 * - 加密检查与错误处理
 * - CDN 回退机制
 */

import * as PDFLib from 'pdf-lib'

/**
 * 使用 PDF.js 加载 PDF 文档（用于预览和获取页数）
 * @param {Uint8Array} data - PDF 文件数据
 * @returns {Promise<object>} PDF.js 文档对象
 */
export async function loadPdfForPreview(data) {
  // 使用全局 PDF.js 实例（由 main.js 初始化）
  const pdfjsLib = window.pdfjsLib
  if (!pdfjsLib) {
    throw new Error('PDF.js 未初始化')
  }

  try {
    const pdfDoc = await pdfjsLib.getDocument({ data: data.slice() }).promise
    return pdfDoc
  } catch (err) {
    // Worker 加载失败时尝试使用备用 CDN
    if (err.message.includes('worker') || err.message.includes('NetworkError')) {
      const PDFJS_CDN_FALLBACK = `https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/build/pdf.worker.min.js`
      pdfjsLib.GlobalWorkerOptions.workerSrc = PDFJS_CDN_FALLBACK
      const pdfDoc = await pdfjsLib.getDocument({ data: data.slice() }).promise
      return pdfDoc
    }
    throw err
  }
}

/**
 * 使用 pdf-lib 加载 PDF 文档（用于处理）
 * @param {Uint8Array} data - PDF 文件数据
 * @param {object} [options] - 加载选项
 * @param {boolean} [options.ignoreEncryption=false] - 是否忽略加密
 * @returns {Promise<object>} pdf-lib 文档对象
 * @throws {Error} 如果 PDF 已加密或无法加载
 */
export async function loadPdfForProcessing(data, options = {}) {
  const { ignoreEncryption = false } = options

  try {
    const pdfDoc = await PDFLib.PDFDocument.load(data, { ignoreEncryption })
    return pdfDoc
  } catch (err) {
    if (err.message.includes('encrypted') || err.message.includes('password')) {
      throw new Error('PDF_ENCRYPTED')
    }
    throw err
  }
}

/**
 * 检查 PDF 是否已加密
 * @param {Uint8Array} data - PDF 文件数据
 * @returns {Promise<boolean>} 是否已加密
 */
export async function isPdfEncrypted(data) {
  try {
    await PDFLib.PDFDocument.load(data, { ignoreEncryption: false })
    return false
  } catch (err) {
    if (err.message.includes('encrypted') || err.message.includes('password')) {
      return true
    }
    // 其他错误也视为无法加载
    throw err
  }
}

/**
 * 获取 PDF 页数（使用 pdf-lib）
 * @param {Uint8Array} data - PDF 文件数据
 * @returns {Promise<number>} 页数
 */
export async function getPdfPageCount(data) {
  const pdfDoc = await PDFLib.PDFDocument.load(data, { ignoreEncryption: false })
  return pdfDoc.getPageCount()
}

/**
 * 加载 PDF 并返回完整信息
 * @param {File} file - 文件对象
 * @returns {Promise<{data: Uint8Array, pageCount: number, file: File}>}
 */
export async function loadPdfFile(file) {
  const bytes = await file.arrayBuffer()
  const data = new Uint8Array(bytes)
  const pageCount = await getPdfPageCount(data)
  return { data, pageCount, file }
}

/**
 * 安全加载 PDF（处理加密异常）
 * @param {Uint8Array} data - PDF 文件数据
 * @param {object} [context] - 错误处理上下文
 * @param {HTMLElement} [context.statusEl] - 状态显示元素
 * @param {string} [context.actionName='此文件'] - 操作名称（如"压缩"、"拆分"）
 * @returns {Promise<object|null>} pdf-lib 文档对象，加密时返回 null
 */
export async function loadPdfSafely(data, context = {}) {
  const { statusEl, actionName = '此文件' } = context

  try {
    const pdfDoc = await loadPdfForProcessing(data)
    return pdfDoc
  } catch (err) {
    if (err.message === 'PDF_ENCRYPTED') {
      const msg = `❌ 该 PDF 文件已加密，无法${actionName}`
      if (statusEl) {
        const { showStatus } = await import('../utils.js')
        showStatus(statusEl, msg, 'error')
      }
      return null
    }
    throw err
  }
}
