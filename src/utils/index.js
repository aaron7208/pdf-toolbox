/**
 * utils/index.js - Barrel exports for all utility modules
 * Maintains backwards compatibility with existing imports
 */

// Core utilities
export {
  MAX_FILE_SIZE,
  formatSize,
  parsePageRange,
  hexToRgb01,
  escapeHtml,
  computeResponsiveScale,
} from './core.js'

// UI utilities
export {
  showStatus,
  showProcessing,
  showProgress,
  showSuccess,
  showError,
  clearStatus,
  showReport,
} from './ui.js'

// File utilities
export {
  checkFileSize,
  downloadBlob,
  cleanupResources,
} from './file.js'

// Analytics
export {
  trackEvent,
} from './analytics.js'

// PDF rendering
export {
  renderPage,
  renderPageResponsive,
} from './pdf-render.js'

// Upload zone management
export {
  showUploadFileInfo,
  highlightUploadZone,
  resetUploadZone,
} from './upload-zone.js'

// Resource management
export {
  createTrackedBlobUrl,
  revokeTrackedBlobUrl,
  cleanupAll,
  releaseArrayBuffer,
  getMemoryInfo,
  isMemoryCritical,
  getTrackedResourceCount,
  cleanupDomBlobRefs,
} from './resource-manager.js'
