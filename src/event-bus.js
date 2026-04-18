/**
 * event-bus.js - 轻量级事件总线
 *
 * 提供模块间解耦通信机制：
 * - 发布-订阅模式
 * - 支持一次性订阅
 * - 支持事件命名空间
 * - 支持通配符订阅
 */

class EventBus {
  constructor() {
    this.listeners = new Map()
    this.onceListeners = new Map()
  }

  /**
   * 订阅事件
   * @param {string} event - 事件名称（支持命名空间，如 'file:loaded'）
   * @param {function} handler - 处理函数 (data, event) => void
   * @returns {function} 取消订阅函数
   */
  on(event, handler) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, [])
    }
    this.listeners.get(event).push(handler)

    return () => this.off(event, handler)
  }

  /**
   * 订阅一次性事件（触发后自动移除）
   * @param {string} event - 事件名称
   * @param {function} handler - 处理函数
   * @returns {function} 取消订阅函数
   */
  once(event, handler) {
    const onceWrapper = (data, event) => {
      handler(data, event)
      this.off(event, onceWrapper)
    }

    if (!this.onceListeners.has(event)) {
      this.onceListeners.set(event, [])
    }
    this.onceListeners.get(event).push({ handler, wrapper: onceWrapper })

    return this.on(event, onceWrapper)
  }

  /**
   * 取消订阅
   * @param {string} event - 事件名称
   * @param {function} handler - 处理函数
   */
  off(event, handler) {
    const cbs = this.listeners.get(event)
    if (cbs) {
      const idx = cbs.indexOf(handler)
      if (idx >= 0) cbs.splice(idx, 1)
    }

    const onceCbs = this.onceListeners.get(event)
    if (onceCbs) {
      const item = onceCbs.find(item => item.handler === handler)
      if (item) {
        const idx = onceCbs.indexOf(item)
        if (idx >= 0) onceCbs.splice(idx, 1)
      }
    }
  }

  /**
   * 触发事件
   * @param {string} event - 事件名称
   * @param {*} [data] - 事件数据
   */
  emit(event, data) {
    // 触发精确匹配
    const cbs = this.listeners.get(event)
    if (cbs) {
      for (const cb of [...cbs]) {
        try {
          cb(data, event)
        } catch (err) {
          console.error(`[EventBus] 事件处理失败 (${event}):`, err)
        }
      }
    }

    // 触发命名空间通配符（如 'file:*' 匹配 'file:loaded'）
    const namespace = event.split(':')[0]
    if (namespace) {
      const wildcardCbs = this.listeners.get(`${namespace}:*`)
      if (wildcardCbs) {
        for (const cb of [...wildcardCbs]) {
          try {
            cb(data, event)
          } catch (err) {
            console.error(`[EventBus] 通配符事件处理失败 (${namespace}:*):`, err)
          }
        }
      }
    }

    // 触发全局通配符
    const globalCbs = this.listeners.get('*')
    if (globalCbs) {
      for (const cb of [...globalCbs]) {
        try {
          cb(data, event)
        } catch (err) {
          console.error(`[EventBus] 全局事件处理失败 (*):`, err)
        }
      }
    }
  }

  /**
   * 移除事件的所有监听器
   * @param {string} [event] - 事件名称，不传则移除所有
   */
  removeAllListeners(event) {
    if (event) {
      this.listeners.delete(event)
      this.onceListeners.delete(event)
    } else {
      this.listeners.clear()
      this.onceListeners.clear()
    }
  }

  /**
   * 获取事件的监听器数量
   * @param {string} event - 事件名称
   * @returns {number} 监听器数量
   */
  listenerCount(event) {
    return this.listeners.get(event)?.length || 0
  }

  /**
   * 获取所有已注册的事件
   * @returns {string[]} 事件名称数组
   */
  events() {
    return [...this.listeners.keys()]
  }
}

// 导出单例
export const eventBus = new EventBus()

// 预定义事件常量
export const EVENTS = {
  // 文件相关
  FILE_LOADED: 'file:loaded',
  FILE_UPLOADED: 'file:uploaded',
  FILE_REMOVED: 'file:removed',

  // 处理相关
  PROCESS_START: 'process:start',
  PROCESS_PROGRESS: 'process:progress',
  PROCESS_COMPLETE: 'process:complete',
  PROCESS_ERROR: 'process:error',

  // 模块相关
  MODULE_OPEN: 'module:open',
  MODULE_CLOSE: 'module:close',
  MODULE_SWITCH: 'module:switch',

  // 状态相关
  STATE_CHANGE: 'state:change',
  SAFE_MODE_TOGGLE: 'safe-mode:toggle',

  // 模板相关
  TEMPLATE_SAVE: 'template:save',
  TEMPLATE_LOAD: 'template:load',
  TEMPLATE_DELETE: 'template:delete',

  // 下载相关
  DOWNLOAD_START: 'download:start',
  DOWNLOAD_COMPLETE: 'download:complete',
}
