/**
 * modal.js - 功能面板 Modal 模块
 * 
 * 替换原来的 tabs.js：
 * - 点击功能卡片 → 打开对应功能的 modal
 * - 点击关闭按钮 / 背景 / Escape → 关闭 modal
 * - 移动端全屏 modal
 */

import { trackEvent } from '../utils.js'

// 功能名称映射（modal key → 中文名称）
const FUNCTION_NAMES = {
  view: '查看',
  merge: '合并',
  compress: '压缩',
  img: '转图片',
  split: '拆分',
  img2pdf: '图片转PDF',
  watermark: '水印',
  'invoice-nup': '发票拼版',
}

export function initModal() {
  // === 1. 功能卡片点击 → 打开 modal ===
  document.querySelectorAll('.feature-card[data-modal]').forEach(card => {
    card.addEventListener('click', () => {
      const modalKey = card.dataset.modal
      openModal(modalKey)
    })
    // 键盘支持（Enter / Space）
    card.addEventListener('keydown', e => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault()
        openModal(card.dataset.modal)
      }
    })
  })

  // === 2. 关闭按钮点击 → 关闭 modal ===
  document.querySelectorAll('.modal-close[data-close-modal]').forEach(btn => {
    btn.addEventListener('click', () => {
      closeModal(btn.dataset.closeModal)
    })
  })

  // === 3. 面板内的"关闭"按钮 → 关闭 modal ===
  bindPanelCloseButtons()

  // === 4. 点击 modal 背景 → 关闭 modal ===
  document.querySelectorAll('.modal-overlay').forEach(overlay => {
    overlay.addEventListener('click', e => {
      if (e.target === overlay) {
        const modalKey = overlay.id.replace('modal-', '')
        closeModal(modalKey)
      }
    })
  })

  // === 5. Escape 键关闭当前打开的 modal ===
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') {
      const openModalEl = document.querySelector('.modal-overlay.open')
      if (openModalEl) {
        const modalKey = openModalEl.id.replace('modal-', '')
        closeModal(modalKey)
      }
    }
  })
}

function bindPanelCloseButtons() {
  const closeBtnIds = [
    'view-close',
    'compress-close',
    'img-close',
    'split-close',
    'wm-close',
  ]

  closeBtnIds.forEach(id => {
    const btn = document.getElementById(id)
    if (btn) {
      btn.addEventListener('click', () => {
        const panel = btn.closest('.panel')
        if (panel) {
          const modalKey = panel.id.replace('panel-', '')
          closeModal(modalKey)
        }
      })
    }
  })
}

function openModal(key) {
  const overlay = document.getElementById('modal-' + key)
  if (!overlay) return

  overlay.classList.add('open')
  document.body.classList.add('modal-open')

  trackEvent('function_used', { function: key, name: FUNCTION_NAMES[key] || key })
}

function closeModal(key) {
  const overlay = document.getElementById('modal-' + key)
  if (!overlay) return

  overlay.classList.remove('open')
  document.body.classList.remove('modal-open')
}

window.openModal = openModal
window.closeModal = closeModal
