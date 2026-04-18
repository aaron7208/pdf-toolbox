/**
 * error-handler.js - 统一错误处理模块
 *
 * 提供：
 * - 统一错误处理入口
 * - 用户友好错误消息
 * - 开发环境日志输出
 * - 模块专属错误处理器工厂
 */

import { showError, showStatus } from './utils/ui.js'

/**
 * 错误类型映射（技术错误 → 用户友好消息）
 */
const ERROR_MESSAGES = {
  'PDF_ENCRYPTED': '该 PDF 文件已加密，无法处理',
  'PDF_INVALID': '该 PDF 文件已损坏或格式无效',
  'FILE_TOO_LARGE': '文件过大，建议不超过 50MB',
  'NETWORK_ERROR': '网络连接失败，请检查后重试',
  'WORKER_ERROR': 'PDF 处理引擎加载失败，请刷新页面重试',
  'MEMORY_ERROR': '内存不足，请尝试处理较小的文件',
  'CANCELLED': '操作已取消',
}

/**
 * 处理错误
 * @param {Error|string} error - 错误对象或消息
 * @param {object} [context] - 错误上下文
 * @param {HTMLElement} [context.statusEl] - 状态显示元素
 * @param {string} [context.moduleName] - 模块名称（用于日志）
 * @param {string} [context.actionName] - 操作名称（如"压缩"、"拆分"）
 * @param {boolean} [context.silent=false] - 是否静默处理（不显示 UI）
 * @returns {object} 处理结果 { handled: boolean, message: string }
 */
export function handleError(error, context = {}) {
  const { statusEl, moduleName = 'unknown', actionName = '操作', silent = false } = context

  // 解析错误
  const errorInfo = parseError(error, actionName)

  // 开发环境日志
  if (import.meta.env?.DEV || window.location.hostname === 'localhost') {
    console.error(`[${moduleName}] 错误:`, errorInfo)
  }

  // 静默模式
  if (silent) {
    return { handled: true, message: errorInfo.message }
  }

  // 显示错误
  if (statusEl) {
    showError(statusEl, errorInfo.message)
  } else {
    console.error(`[${moduleName}]`, errorInfo.message)
  }

  return { handled: true, message: errorInfo.message }
}

/**
 * 解析错误对象
 * @param {Error|string} error - 错误对象或消息
 * @param {string} actionName - 操作名称
 * @returns {object} 错误信息 { code: string, message: string, original: Error }
 */
function parseError(error, actionName) {
  if (typeof error === 'string') {
    return {
      code: error,
      message: ERROR_MESSAGES[error] || `❌ ${error}`,
      original: null,
    }
  }

  if (!error) {
    return {
      code: 'UNKNOWN',
      message: `❌ ${actionName}失败：未知错误`,
      original: null,
    }
  }

  const message = error.message || String(error)

  // 检查已知错误类型
  if (message.includes('encrypted') || message.includes('password')) {
    return {
      code: 'PDF_ENCRYPTED',
      message: `❌ 该 PDF 文件已加密，无法${actionName}`,
      original: error,
    }
  }

  if (message.includes('Invalid PDF') || message.includes('corrupt')) {
    return {
      code: 'PDF_INVALID',
      message: `❌ 该 PDF 文件已损坏或格式无效`,
      original: error,
    }
  }

  if (message.includes('worker') || message.includes('Worker')) {
    return {
      code: 'WORKER_ERROR',
      message: `❌ PDF 处理引擎加载失败，请刷新页面重试`,
      original: error,
    }
  }

  if (message.includes('memory') || message.includes('allocation')) {
    return {
      code: 'MEMORY_ERROR',
      message: `❌ 内存不足，请尝试处理较小的文件`,
      original: error,
    }
  }

  if (message.includes('network') || message.includes('NetworkError')) {
    return {
      code: 'NETWORK_ERROR',
      message: `❌ 网络连接失败，请检查后重试`,
      original: error,
    }
  }

  // 默认错误
  return {
    code: 'UNKNOWN',
    message: `❌ ${actionName}失败：${message}`,
    original: error,
  }
}

/**
 * 创建模块专属错误处理器
 * @param {string} moduleName - 模块名称（如 'compress'、'split'）
 * @param {object} [options] - 选项
 * @param {HTMLElement} [options.statusEl] - 状态显示元素
 * @param {string} [options.actionName] - 操作名称
 * @returns {function} 错误处理函数 (error) => void
 */
export function createErrorHandler(moduleName, options = {}) {
  const { statusEl, actionName = moduleName } = options

  return function(error) {
    return handleError(error, {
      statusEl,
      moduleName,
      actionName,
    })
  }
}

/**
 * 安全执行异步操作（自动捕获错误）
 * @param {function} fn - 异步操作函数
 * @param {object} [context] - 错误上下文（同 handleError）
 * @returns {Promise<any>} 操作结果，失败时返回 null
 */
export async function safeExecute(fn, context = {}) {
  try {
    return await fn()
  } catch (error) {
    handleError(error, context)
    return null
  }
}

/**
 * 显示警告消息
 * @param {HTMLElement} statusEl - 状态显示元素
 * @param {string} message - 警告消息
 */
export function showWarning(statusEl, message) {
  if (statusEl) {
    showStatus(statusEl, `⚠️ ${message}`, 'warning')
  }
}

/**
 * 显示信息消息
 * @param {HTMLElement} statusEl - 状态显示元素
 * @param {string} message - 信息消息
 */
export function showInfo(statusEl, message) {
  if (statusEl) {
    showStatus(statusEl, `ℹ️ ${message}`, 'info')
  }
}
