/**
 * storage.js - IndexedDB 本地存储模块
 *
 * 用于持久化用户自定义模板和设置。
 * 安全模式下不读写 IndexedDB。
 */

const DB_NAME = 'pdf-toolbox-storage'
const DB_VERSION = 1
const STORE_TEMPLATES = 'templates'
const STORE_SETTINGS = 'settings'

/**
 * 打开 IndexedDB 连接
 */
function openDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION)

    request.onupgradeneeded = (event) => {
      const db = event.target.result
      if (!db.objectStoreNames.contains(STORE_TEMPLATES)) {
        db.createObjectStore(STORE_TEMPLATES, { keyPath: 'name' })
      }
      if (!db.objectStoreNames.contains(STORE_SETTINGS)) {
        db.createObjectStore(STORE_SETTINGS, { keyPath: 'key' })
      }
    }

    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(new Error('IndexedDB open failed: ' + request.error))
  })
}

/**
 * 检查 IndexedDB 是否可用且非安全模式
 */
function isAvailable() {
  return typeof indexedDB !== 'undefined' && !window.__safeMode
}

// ============================================================================
// 模板操作
// ============================================================================

/**
 * 保存自定义模板
 * @param {string} name - 模板名称
 * @param {object} data - 模板数据 { steps, watermark }
 */
export async function saveTemplate(name, data) {
  if (!isAvailable()) return

  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_TEMPLATES, 'readwrite')
    const store = tx.objectStore(STORE_TEMPLATES)
    const request = store.put({ name, data, createdAt: Date.now() })

    request.onsuccess = () => resolve()
    request.onerror = () => reject(new Error('保存模板失败: ' + request.error))
  })
}

/**
 * 加载单个模板
 * @param {string} name - 模板名称
 * @returns {object|null} 模板对象 { name, data, createdAt }，不存在时返回 null
 */
export async function loadTemplate(name) {
  if (!isAvailable()) return null

  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_TEMPLATES, 'readonly')
    const store = tx.objectStore(STORE_TEMPLATES)
    const request = store.get(name)

    request.onsuccess = () => resolve(request.result || null)
    request.onerror = () => reject(new Error('加载模板失败: ' + request.error))
  })
}

/**
 * 加载所有模板
 * @returns {Array} 模板数组 [{ name, data, createdAt }]
 */
export async function loadTemplates() {
  if (!isAvailable()) return []

  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_TEMPLATES, 'readonly')
    const store = tx.objectStore(STORE_TEMPLATES)
    const request = store.getAll()

    request.onsuccess = () => resolve(request.result || [])
    request.onerror = () => reject(new Error('加载模板失败: ' + request.error))
  })
}

/**
 * 删除指定模板
 * @param {string} name - 模板名称
 */
export async function deleteTemplate(name) {
  if (!isAvailable()) return

  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_TEMPLATES, 'readwrite')
    const store = tx.objectStore(STORE_TEMPLATES)
    const request = store.delete(name)

    request.onsuccess = () => resolve()
    request.onerror = () => reject(new Error('删除模板失败: ' + request.error))
  })
}

// ============================================================================
// 设置操作
// ============================================================================

/**
 * 保存设置
 * @param {string} key - 设置键名
 * @param {*} value - 设置值
 */
export async function saveSetting(key, value) {
  if (!isAvailable()) return

  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_SETTINGS, 'readwrite')
    const store = tx.objectStore(STORE_SETTINGS)
    const request = store.put({ key, value, updatedAt: Date.now() })

    request.onsuccess = () => resolve()
    request.onerror = () => reject(new Error('保存设置失败: ' + request.error))
  })
}

/**
 * 读取设置
 * @param {string} key - 设置键名
 * @returns {*} 设置值，不存在时返回 null
 */
export async function loadSetting(key) {
  if (!isAvailable()) return null

  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_SETTINGS, 'readonly')
    const store = tx.objectStore(STORE_SETTINGS)
    const request = store.get(key)

    request.onsuccess = () => {
      resolve(request.result ? request.result.value : null)
    }
    request.onerror = () => reject(new Error('读取设置失败: ' + request.error))
  })
}
