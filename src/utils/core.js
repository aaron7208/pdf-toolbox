/**
 * utils/core.js - 核心工具函数（纯数据操作，无 DOM 依赖）
 */

// 统一文件大小上限(50MB)
export const MAX_FILE_SIZE = 50 * 1024 * 1024

/**
 * 格式化文件大小
 */
export function formatSize(bytes) {
  if (bytes < 1024) return bytes + ' B'
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB'
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB'
}

/**
 * 解析页码范围字符串
 * 支持格式: "1,3,5-8,10"
 */
export function parsePageRange(str, max) {
  const pages = new Set()
  const warnings = []
  const parts = str.split(',')
  for (const part of parts) {
    const trimmed = part.trim()
    if (!trimmed) continue
    if (trimmed.includes('-')) {
      const [a, b] = trimmed.split('-').map(Number)
      if (!isNaN(a) && !isNaN(b)) {
        if (a > b) {
          warnings.push(`页码范围 "${trimmed}" 无效(起始页 ${a} 大于结束页 ${b})`)
          continue
        }
        for (let i = Math.max(1, a); i <= Math.min(max, b); i++) pages.add(i)
      }
    } else {
      const n = Number(trimmed)
      if (!isNaN(n) && n >= 1 && n <= max) pages.add(n)
    }
  }
  return { pages: [...pages].sort((a, b) => a - b), warnings }
}

/**
 * 十六进制颜色转 RGB 0-1 范围
 */
export function hexToRgb01(hex) {
  const r = parseInt(hex.slice(1, 3), 16) / 255
  const g = parseInt(hex.slice(3, 5), 16) / 255
  const b = parseInt(hex.slice(5, 7), 16) / 255
  return { r, g, b }
}

/**
 * HTML 转义
 */
export function escapeHtml(str) {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

/**
 * 计算响应式缩放比例
 */
export function computeResponsiveScale(page, containerWidth, containerHeight, padding = 32) {
  const { width: pageWidth, height: pageHeight } = page.getViewport({ scale: 1 })
  const availableWidth = containerWidth - padding
  const availableHeight = containerHeight - padding
  const scaleX = availableWidth / pageWidth
  const scaleY = availableHeight / pageHeight
  return Math.max(Math.min(scaleX, scaleY), 0.25)
}
