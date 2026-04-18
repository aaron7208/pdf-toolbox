/**
 * utils.js - 共享工具函数
 * 此文件作为 barrel export 维护向后兼容性
 * 所有工具函数已拆分到 utils/ 子目录
 */

export {
  MAX_FILE_SIZE,
  formatSize,
  parsePageRange,
  hexToRgb01,
  escapeHtml,
  computeResponsiveScale,
  showStatus,
  showProcessing,
  showProgress,
  showSuccess,
  showError,
  clearStatus,
  showReport,
  checkFileSize,
  downloadBlob,
  cleanupResources,
  trackEvent,
  renderPage,
  renderPageResponsive,
  showUploadFileInfo,
  highlightUploadZone,
  resetUploadZone,
} from './utils/index.js'

// PDF.js worker CDN 配置（保留在此处，避免循环依赖）
export const PDFJS_WORKER_VERSION = '3.11.174'
export const PDFJS_CDN_PRIMARY = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${PDFJS_WORKER_VERSION}/pdf.worker.min.js`
export const PDFJS_CDN_FALLBACK = `https://cdn.jsdelivr.net/npm/pdfjs-dist@${PDFJS_WORKER_VERSION}/build/pdf.worker.min.js`
