/**
 * shortcuts.js - 快捷键支持模块
 * 
 * 功能：
 * - 全局快捷键监听
 * - 支持打开功能、关闭弹窗、翻页等操作
 * - 显示快捷键帮助面板
 */

const SHORTCUTS = {
  'Ctrl+O': { action: 'openFile', description: '打开文件' },
  'Ctrl+S': { action: 'saveFile', description: '保存结果' },
  'Ctrl+Shift+M': { action: 'openModal', modal: 'merge', description: '合并PDF' },
  'Ctrl+Shift+C': { action: 'openModal', modal: 'compress', description: '压缩PDF' },
  'Ctrl+Shift+V': { action: 'openModal', modal: 'view', description: '查看PDF' },
  'Ctrl+Shift+I': { action: 'openModal', modal: 'img', description: '转图片' },
  'Ctrl+Shift+S': { action: 'openModal', modal: 'split', description: '拆分PDF' },
  'Ctrl+Shift+W': { action: 'openModal', modal: 'watermark', description: '添加水印' },
  'Ctrl+Shift+E': { action: 'openModal', modal: 'encrypt', description: '加密/解密' },
  'Ctrl+Shift+P': { action: 'openModal', modal: 'page-manager', description: '页面管理' },
  'Ctrl+Shift+N': { action: 'openModal', modal: 'page-number', description: '批量页码' },
  'Escape': { action: 'closeModal', description: '关闭弹窗' },
  'ArrowLeft': { action: 'prevPage', description: '上一页（查看器）' },
  'ArrowRight': { action: 'nextPage', description: '下一页（查看器）' },
  'Plus': { action: 'zoomIn', description: '放大（查看器）' },
  'Minus': { action: 'zoomOut', description: '缩小（查看器）' },
  'Ctrl+H': { action: 'showHelp', description: '显示快捷键帮助' },
}

export function initShortcuts() {
  document.addEventListener('keydown', handleShortcut)
  
  const helpBtn = document.getElementById('shortcuts-help-btn')
  if (helpBtn) {
    helpBtn.addEventListener('click', showShortcutsHelp)
  }
}

function handleShortcut(e) {
  const key = getShortcutKey(e)
  const shortcut = SHORTCUTS[key]
  
  if (!shortcut) return
  
  e.preventDefault()
  
  switch (shortcut.action) {
    case 'openModal':
      if (typeof openModal === 'function') {
        openModal(shortcut.modal)
      }
      break
      
    case 'closeModal':
      const openModalEl = document.querySelector('.modal-overlay.open')
      if (openModalEl) {
        const modalKey = openModalEl.id.replace('modal-', '')
        if (typeof closeModal === 'function') {
          closeModal(modalKey)
        }
      }
      break
      
    case 'prevPage':
      triggerButton('view-prev')
      break
      
    case 'nextPage':
      triggerButton('view-next')
      break
      
    case 'zoomIn':
      triggerButton('view-zoom-in')
      break
      
    case 'zoomOut':
      triggerButton('view-zoom-out')
      break
      
    case 'showHelp':
      showShortcutsHelp()
      break
      
    case 'openFile':
      const activeModal = document.querySelector('.modal-overlay.open')
      if (activeModal) {
        const fileInput = activeModal.querySelector('input[type="file"]')
        if (fileInput) fileInput.click()
      }
      break
      
    case 'saveFile':
      const saveBtn = document.querySelector('.modal-overlay.open .btn-primary, .modal-overlay.open .btn-success')
      if (saveBtn && !saveBtn.disabled) saveBtn.click()
      break
  }
}

function getShortcutKey(e) {
  const parts = []
  
  if (e.ctrlKey || e.metaKey) parts.push('Ctrl')
  if (e.shiftKey) parts.push('Shift')
  if (e.altKey) parts.push('Alt')
  
  if (e.key === ' ') {
    parts.push('Space')
  } else if (e.key === '+') {
    parts.push('Plus')
  } else if (e.key === '-') {
    parts.push('Minus')
  } else if (e.key.length === 1) {
    parts.push(e.key.toUpperCase())
  } else {
    parts.push(e.key)
  }
  
  return parts.join('+')
}

function triggerButton(buttonId) {
  const btn = document.getElementById(buttonId)
  if (btn && !btn.disabled) {
    btn.click()
  }
}

function showShortcutsHelp() {
  const existing = document.getElementById('shortcuts-help-modal')
  if (existing) {
    existing.remove()
    return
  }
  
  const modal = document.createElement('div')
  modal.id = 'shortcuts-help-modal'
  modal.style.cssText = `
    position:fixed;
    top:0;
    left:0;
    right:0;
    bottom:0;
    background:rgba(0,0,0,0.5);
    display:flex;
    align-items:center;
    justify-content:center;
    z-index:10000;
  `
  
  modal.innerHTML = `
    <div style="
      background:var(--bg-primary);
      border-radius:12px;
      padding:2rem;
      max-width:600px;
      max-height:80vh;
      overflow-y:auto;
      box-shadow:0 4px 20px rgba(0,0,0,0.3);
    ">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:1.5rem;">
        <h2 style="margin:0;">⌨️ 快捷键</h2>
        <button id="close-shortcuts-help" style="background:none;border:none;font-size:1.5rem;cursor:pointer;color:var(--text-secondary);">✕</button>
      </div>
      
      <div style="display:grid;gap:12px;">
        ${Object.entries(SHORTCUTS).map(([key, shortcut]) => `
          <div style="display:flex;justify-content:space-between;align-items:center;padding:8px 12px;background:var(--bg-secondary);border-radius:6px;">
            <span style="color:var(--text-primary);">${shortcut.description}</span>
            <kbd style="
              background:var(--bg-primary);
              border:1px solid var(--border);
              border-radius:4px;
              padding:4px 8px;
              font-family:monospace;
              font-size:0.9rem;
              color:var(--text-secondary);
            ">${key}</kbd>
          </div>
        `).join('')}
      </div>
      
      <p style="margin-top:1.5rem;color:var(--text-secondary);font-size:0.85rem;text-align:center;">
        按 Ctrl+H 可随时打开此帮助
      </p>
    </div>
  `
  
  document.body.appendChild(modal)
  
  modal.addEventListener('click', (e) => {
    if (e.target === modal) modal.remove()
  })
  
  document.getElementById('close-shortcuts-help').addEventListener('click', () => {
    modal.remove()
  })
  
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && document.getElementById('shortcuts-help-modal')) {
      modal.remove()
    }
  }, { once: true })
}
