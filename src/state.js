/**
 * state.js - 全局状态管理（带订阅机制）
 *
 * 提供：
 * - 单一状态树管理所有模块状态
 * - 发布-订阅模式的状态变更通知
 * - 状态重置和批量更新
 * - 状态快照和恢复
 */

// 订阅者映射：key 为状态路径，value 为回调函数数组
const subscribers = new Map()

// 状态变更历史（用于调试）
const stateHistory = []
const MAX_HISTORY = 50

/**
 * 全局状态树
 */
export const state = {
  // View module state
  view: {
    pdfDoc: null,
    pdfBytes: null,
    currentPage: 1,
    totalPages: 0,
    scale: 1.5
  },

  // Merge module state
  merge: {
    files: []
  },

  // Compress module state
  compress: {
    pdfFile: null,
    pdfBytes: null,
    totalPages: 0
  },

  // Img module state (PDF to image)
  img: {
    pdfDoc: null,
    file: null,
    totalPages: 0
  },

  // Split module state
  split: {
    pdfDoc: null,
    pdfBytes: null,
    file: null,
    totalPages: 0
  },

  // Img2Pdf module state (images to PDF)
  img2pdf: {
    files: [],
    pdfDoc: null
  },

  // Watermark module state
  watermark: {
    pdfDoc: null,
    pdfBytes: null,
    file: null,
    totalPages: 0
  },

  // Invoice N-up module state
  invoiceNup: {
    files: []
  },

  // Redaction module state
  redaction: {
    pdfDoc: null,
    pdfBytes: null,
    file: null,
    totalPages: 0
  },

  // 全局状态
  global: {
    safeMode: false,
    processing: false,
    lastAction: null,
  }
}

/**
 * 订阅状态变更
 * @param {string} path - 状态路径（如 'view.currentPage' 或 'view'）
 * @param {function} callback - 回调函数 (newValue, oldValue, path) => void
 * @returns {function} 取消订阅函数
 */
export function subscribe(path, callback) {
  if (!subscribers.has(path)) {
    subscribers.set(path, [])
  }
  subscribers.get(path).push(callback)

  // 返回取消订阅函数
  return () => {
    const cbs = subscribers.get(path)
    if (cbs) {
      const idx = cbs.indexOf(callback)
      if (idx >= 0) cbs.splice(idx, 1)
    }
  }
}

/**
 * 订阅多个状态路径
 * @param {object} pathsMap - 路径到回调的映射 { 'view.currentPage': cb1, 'merge.files': cb2 }
 * @returns {function} 取消所有订阅的函数
 */
export function subscribeMany(pathsMap) {
  const unsubscribes = []
  for (const [path, callback] of Object.entries(pathsMap)) {
    unsubscribes.push(subscribe(path, callback))
  }
  return () => unsubscribes.forEach(unsub => unsub())
}

/**
 * 通知订阅者
 * @param {string} path - 状态路径
 * @param {*} newValue - 新值
 * @param {*} oldValue - 旧值
 */
function notifySubscribers(path, newValue, oldValue) {
  const cbs = subscribers.get(path)
  if (cbs) {
    for (const cb of cbs) {
      try {
        cb(newValue, oldValue, path)
      } catch (err) {
        console.error(`[State] 订阅者回调执行失败 (${path}):`, err)
      }
    }
  }

  // 通知父路径（如 'view.currentPage' 变更时通知 'view'）
  const parts = path.split('.')
  if (parts.length > 1) {
    const parentPath = parts.slice(0, -1).join('.')
    const parentCbs = subscribers.get(parentPath)
    if (parentCbs) {
      const parentValue = getState(parentPath)
      for (const cb of parentCbs) {
        try {
          cb(parentValue, parentValue, parentPath)
        } catch (err) {
          console.error(`[State] 订阅者回调执行失败 (${parentPath}):`, err)
        }
      }
    }
  }
}

/**
 * 获取状态值（支持路径）
 * @param {string} [path] - 状态路径（如 'view.currentPage'），不传则返回整个状态树
 * @returns {*} 状态值
 */
export function getState(path) {
  if (!path) return state

  const parts = path.split('.')
  let current = state
  for (const part of parts) {
    if (current == null) return undefined
    current = current[part]
  }
  return current
}

/**
 * 设置状态值（支持路径）
 * @param {string} path - 状态路径（如 'view.currentPage'）
 * @param {*} value - 新值
 * @param {boolean} [notify=true] - 是否通知订阅者
 */
export function setState(path, value, notify = true) {
  const parts = path.split('.')
  let current = state

  // 导航到父对象
  for (let i = 0; i < parts.length - 1; i++) {
    if (current[parts[i]] == null) {
      current[parts[i]] = {}
    }
    current = current[parts[i]]
  }

  const lastKey = parts[parts.length - 1]
  const oldValue = current[lastKey]
  current[lastKey] = value

  // 记录历史
  if (stateHistory.length >= MAX_HISTORY) {
    stateHistory.shift()
  }
  stateHistory.push({
    path,
    oldValue,
    newValue: value,
    timestamp: Date.now(),
  })

  // 通知订阅者
  if (notify) {
    notifySubscribers(path, value, oldValue)
  }
}

/**
 * 批量设置状态（只通知一次）
 * @param {object} updates - 状态更新映射 { 'view.currentPage': 1, 'view.totalPages': 10 }
 */
export function batchState(updates) {
  const oldValues = {}

  for (const [path, value] of Object.entries(updates)) {
    const parts = path.split('.')
    let current = state

    for (let i = 0; i < parts.length - 1; i++) {
      if (current[parts[i]] == null) {
        current[parts[i]] = {}
      }
      current = current[parts[i]]
    }

    const lastKey = parts[parts.length - 1]
    oldValues[path] = current[lastKey]
    current[lastKey] = value
  }

  // 批量通知
  for (const [path, value] of Object.entries(updates)) {
    notifySubscribers(path, value, oldValues[path])
  }
}

/**
 * 重置指定模块的状态
 * @param {string} moduleKey - 模块键（如 'view'、'compress'）
 */
export function resetModule(moduleKey) {
  if (state[moduleKey]) {
    const oldValue = { ...state[moduleKey] }
    state[moduleKey] = getDefaultState(moduleKey)
    notifySubscribers(moduleKey, state[moduleKey], oldValue)
  }
}

/**
 * 重置所有状态
 */
export function resetAll() {
  const oldState = JSON.parse(JSON.stringify(state))

  // 重置各模块
  for (const key of Object.keys(state)) {
    if (key !== 'global') {
      state[key] = getDefaultState(key)
    }
  }

  // 保留全局状态的部分字段
  state.global.processing = false
  state.global.lastAction = null

  notifySubscribers('*', state, oldState)
}

/**
 * 获取模块的默认状态
 * @param {string} moduleKey - 模块键
 * @returns {object} 默认状态
 */
function getDefaultState(moduleKey) {
  const defaults = {
    view: { pdfDoc: null, pdfBytes: null, currentPage: 1, totalPages: 0, scale: 1.5 },
    merge: { files: [] },
    compress: { pdfFile: null, pdfBytes: null, totalPages: 0 },
    img: { pdfDoc: null, file: null, totalPages: 0 },
    split: { pdfDoc: null, pdfBytes: null, file: null, totalPages: 0 },
    img2pdf: { files: [], pdfDoc: null },
    watermark: { pdfDoc: null, pdfBytes: null, file: null, totalPages: 0 },
    invoiceNup: { files: [] },
    redaction: { pdfDoc: null, pdfBytes: null, file: null, totalPages: 0 },
    global: { safeMode: false, processing: false, lastAction: null },
  }
  return defaults[moduleKey] || {}
}

/**
 * 获取状态变更历史
 * @param {number} [limit=10] - 返回条数
 * @returns {Array} 历史记录
 */
export function getStateHistory(limit = 10) {
  return stateHistory.slice(-limit)
}

/**
 * 清除状态变更历史
 */
export function clearStateHistory() {
  stateHistory.length = 0
}

/**
 * 获取订阅者数量
 * @param {string} [path] - 状态路径，不传则返回总数
 * @returns {number} 订阅者数量
 */
export function getSubscriberCount(path) {
  if (!path) {
    let total = 0
    for (const cbs of subscribers.values()) {
      total += cbs.length
    }
    return total
  }
  return subscribers.get(path)?.length || 0
}

/**
 * 清除所有订阅
 */
export function clearSubscribers() {
  subscribers.clear()
}
