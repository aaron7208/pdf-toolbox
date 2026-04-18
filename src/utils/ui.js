/**
 * utils/ui.js - UI 状态显示相关函数
 */

import { escapeHtml, formatSize } from './core.js'

/**
 * 骨架屏进度文案定时器管理
 */
const _skeletonTimers = new WeakMap()

/**
 * 显示状态消息（自动添加图标）
 */
export function showStatus(el, message, type = 'info') {
  const timers = _skeletonTimers.get(el)
  if (timers) {
    clearTimeout(timers.timer1)
    clearTimeout(timers.timer2)
    _skeletonTimers.delete(el)
  }
  let icon = ''
  if (type === 'success' && !message.includes('✅')) {
    icon = '<span class="checkmark"></span>'
  } else if (type === 'error' && !message.includes('❌')) {
    icon = '<span class="error-icon"></span>'
  } else if (type === 'loading' && !message.includes('<span class="spinner"')) {
    icon = '<span class="spinner"></span>'
  }
  el.innerHTML = `<div class="status ${type}">${icon}${message}</div>`
}

/**
 * 显示处理状态(带安全锁动画 + 骨架屏动画 + 进度文案)
 */
export function showProcessing(el, message, percent) {
  const prevTimer = _skeletonTimers.get(el)
  if (prevTimer) clearTimeout(prevTimer)

  const progressBar = percent != null
    ? `<div class="progress-bar-container"><div class="progress-bar" style="width:${percent}%"></div></div>`
    : ''

  el.innerHTML = `
    <div class="status processing has-skeleton">
      <span class="lock-icon"></span>${message}
      <span class="local-tip">🔒 文件正在本地处理,不会上传到任何服务器</span>
      <div class="skeleton-bars">
        <div class="skeleton-bar"></div>
        <div class="skeleton-bar"></div>
        <div class="skeleton-bar"></div>
      </div>
      <div class="progress-text" data-step="0">⏳ 正在解析文件...</div>
      ${progressBar}
    </div>`

  const progressTextEl = el.querySelector('.progress-text')
  let step = 0
  const timer1 = setTimeout(() => {
    if (!progressTextEl.isConnected) return
    progressTextEl.textContent = '⚙️ 正在处理...'
    progressTextEl.dataset.step = '1'
    step = 1
  }, 500)

  const timer2 = setTimeout(() => {
    if (!progressTextEl.isConnected) return
    progressTextEl.textContent = '✅ 处理完成!'
    progressTextEl.dataset.step = '2'
    step = 2
  }, 1200)

  _skeletonTimers.set(el, { timer1, timer2 })
}

/**
 * 显示进度条
 */
export function showProgress(el, message, percent = 0) {
  el.innerHTML = `
    <div class="status loading">
      <span class="spinner"></span>${message}
      <div class="progress-bar-container">
        <div class="progress-bar" style="width:${percent}%"></div>
      </div>
      <div class="skeleton-bars">
        <div class="skeleton-bar"></div>
        <div class="skeleton-bar"></div>
        <div class="skeleton-bar"></div>
      </div>
    </div>`
}

/**
 * 显示成功状态(带动画)
 */
export function showSuccess(el, message) {
  const timers = _skeletonTimers.get(el)
  if (timers) {
    clearTimeout(timers.timer1)
    clearTimeout(timers.timer2)
    _skeletonTimers.delete(el)
  }
  el.innerHTML = `<div class="status success"><span class="checkmark"></span>${message}</div>`
}

/**
 * 显示错误状态(带动画)
 */
export function showError(el, message) {
  const timers = _skeletonTimers.get(el)
  if (timers) {
    clearTimeout(timers.timer1)
    clearTimeout(timers.timer2)
    _skeletonTimers.delete(el)
  }
  el.innerHTML = `<div class="status error"><span class="error-icon"></span>${message}</div>`
}

/**
 * 清除状态消息
 */
export function clearStatus(el) {
  const timers = _skeletonTimers.get(el)
  if (timers) {
    clearTimeout(timers.timer1)
    clearTimeout(timers.timer2)
    _skeletonTimers.delete(el)
  }
  el.innerHTML = ''
}

// 功能列表（用于推荐引导）
const ALL_FEATURES = [
  { key: 'merge', label: '合并 PDF', icon: '📎' },
  { key: 'compress', label: '压缩 PDF', icon: '📦' },
  { key: 'split', label: '拆分 PDF', icon: '✂️' },
  { key: 'img', label: 'PDF 转图片', icon: '🖼️' },
  { key: 'watermark', label: '加水印', icon: '💧' },
  { key: 'img2pdf', label: '图片转 PDF', icon: '📸' },
  { key: 'invoice-nup', label: '发票拼版', icon: '🧾' },
]

/**
 * 显示处理报告卡片(带淡入动画)
 */
export function showReport(el, data) {
  const statusDiv = el.querySelector('.status.success')
  if (!statusDiv) return

  let html = '<div class="report-card">'
  html += '<div class="report-title">📋 处理报告</div>'

  if (data.fileName) {
    html += `<div class="report-row"><span class="report-label">📄 文件名</span><span class="report-value">${escapeHtml(data.fileName)}</span></div>`
  }

  if (data.originalSize != null) {
    if (data.processedSize != null && data.processedSize !== data.originalSize) {
      const diff = data.processedSize - data.originalSize
      const pct = Math.abs((diff / data.originalSize) * 100).toFixed(1)
      const direction = diff < 0 ? '减少' : '增加'
      html += `<div class="report-row"><span class="report-label">📏 大小</span><span class="report-value">${formatSize(data.originalSize)} → ${formatSize(data.processedSize)}（${direction} ${pct}%）</span></div>`
    } else {
      html += `<div class="report-row"><span class="report-label">📏 大小</span><span class="report-value">${formatSize(data.originalSize)}</span></div>`
    }
  }

  if (data.pageCount != null) {
    html += `<div class="report-row"><span class="report-label">📊 页数</span><span class="report-value">${data.pageCount} 页</span></div>`
  }

  if (data.fileCount != null && data.fileCount > 1) {
    html += `<div class="report-row"><span class="report-label">📁 文件</span><span class="report-value">${data.fileCount} 个</span></div>`
  }

  if (data.format) {
    html += `<div class="report-row"><span class="report-label">🎨 格式</span><span class="report-value">${data.format.toUpperCase()}</span></div>`
  }

  html += '<div class="report-divider"></div>'

  if (data.duration != null) {
    const durationSec = (data.duration / 1000).toFixed(1)
    html += `<div class="report-row"><span class="report-label">⏱️ 耗时</span><span class="report-value highlight">${durationSec} 秒</span></div>`
  }

  html += `<div class="report-row"><span class="report-label">🔒 处理</span><span class="report-value">100% 本地处理，未上传任何数据</span></div>`

  html += '</div>'

  statusDiv.insertAdjacentHTML('beforeend', html)

  appendNextSteps(statusDiv, data.currentFeature, el)
}

function appendNextSteps(statusDiv, currentFeature, el) {
  let featureKey = currentFeature
  if (!featureKey) {
    const panel = el.closest('[id^="panel-"]')
    if (panel) {
      featureKey = panel.id.replace('panel-', '')
    }
  }

  const recommendations = ALL_FEATURES
    .filter(f => f.key !== featureKey)
    .slice(0, 3)

  if (recommendations.length === 0) return

  let html = '<div class="next-steps">'
  html += '<div class="next-steps-title">✨ 接下来你可以试试</div>'
  html += '<div class="next-steps-list">'

  recommendations.forEach(f => {
    html += `<a class="next-steps-item" data-next-modal="${f.key}" href="javascript:void(0)">`
    html += `<span class="next-steps-icon">${f.icon}</span>`
    html += `<span class="next-steps-label">${f.label}</span>`
    html += '</a>'
  })

  html += '</div></div>'

  statusDiv.insertAdjacentHTML('beforeend', html)

  const panel = el.closest('[id^="panel-"]')
  const currentModalKey = panel ? panel.id.replace('panel-', '') : featureKey

  statusDiv.querySelectorAll('.next-steps-item').forEach(item => {
    item.addEventListener('click', () => {
      const targetKey = item.dataset.nextModal
      if (typeof window.closeModal === 'function' && typeof window.openModal === 'function') {
        window.closeModal(currentModalKey)
        window.openModal(targetKey)
      }
    })
  })
}
