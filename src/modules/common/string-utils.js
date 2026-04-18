/**
 * string-utils.js - 字符串工具函数
 *
 * 提供通用的字符串处理工具，包括：
 * - HTML 转义
 * - 文件名处理
 * - 文本格式化
 */

/**
 * HTML 转义（防止 XSS）
 * @param {string} str - 原始字符串
 * @returns {string} 转义后的字符串
 */
export function escapeHtml(str) {
  if (typeof str !== 'string') return ''
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

/**
 * 去除文件扩展名
 * @param {string} filename - 文件名
 * @param {string} [extension] - 指定扩展名（不含点），不传则自动检测
 * @returns {string} 不含扩展名的文件名
 */
export function stripExtension(filename, extension) {
  if (!filename) return ''
  const ext = extension || filename.split('.').pop()
  const regex = new RegExp(`\\.${ext}$`, 'i')
  return filename.replace(regex, '')
}

/**
 * 获取文件扩展名
 * @param {string} filename - 文件名
 * @returns {string} 扩展名（不含点）
 */
export function getExtension(filename) {
  if (!filename) return ''
  const parts = filename.split('.')
  return parts.length > 1 ? parts.pop().toLowerCase() : ''
}

/**
 * 检查文件是否为 PDF
 * @param {string} filename - 文件名
 * @returns {boolean}
 */
export function isPdfFile(filename) {
  return getExtension(filename) === 'pdf'
}

/**
 * 检查文件是否为图片
 * @param {string} filename - 文件名
 * @returns {boolean}
 */
export function isImageFile(filename) {
  const ext = getExtension(filename)
  return ['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp'].includes(ext)
}

/**
 * 截断字符串（超出长度用省略号代替）
 * @param {string} str - 原始字符串
 * @param {number} maxLength - 最大长度
 * @returns {string} 截断后的字符串
 */
export function truncate(str, maxLength) {
  if (!str || str.length <= maxLength) return str
  return str.slice(0, maxLength - 3) + '...'
}

/**
 * 生成唯一 ID（用于元素标识等）
 * @returns {string} 唯一 ID
 */
export function generateId() {
  return `${Date.now()}_${Math.random().toString(36).slice(2, 9)}`
}

/**
 * 将驼峰命名转换为连字符命名
 * @param {string} str - 驼峰命名字符串
 * @returns {string} 连字符命名
 */
export function camelToKebab(str) {
  return str.replace(/([a-z])([A-Z])/g, '$1-$2').toLowerCase()
}

/**
 * 将连字符命名转换为驼峰命名
 * @param {string} str - 连字符命名字符串
 * @returns {string} 驼峰命名
 */
export function kebabToCamel(str) {
  return str.replace(/-([a-z])/g, (_, char) => char.toUpperCase())
}
