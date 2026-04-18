/**
 * utils/analytics.js - 事件追踪相关函数
 */

/**
 * 数据监测:自定义事件追踪
 * 同时发送到 Microsoft Clarity 和 Google Analytics 4
 */
export function trackEvent(eventName, params = {}) {
  // Microsoft Clarity 自定义标签
  if (typeof window.clarity === 'function') {
    try {
      const label = Object.keys(params).length > 0
        ? `${eventName}: ${JSON.stringify(params)}`
        : eventName
      window.clarity('set', eventName, JSON.stringify(params))
    } catch (e) {
      // 静默忽略
    }
  }

  // Google Analytics 4 自定义事件
  if (typeof window.gtag === 'function') {
    try {
      window.gtag('event', eventName, params)
    } catch (e) {
      // 静默忽略
    }
  }

  // 开发环境:console 输出(方便调试)
  if (import.meta.env?.DEV || window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
    console.log(`[trackEvent] ${eventName}`, params)
  }
}
