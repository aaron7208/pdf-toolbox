/**
 * recent-usage.js - 最近使用记录模块
 * 
 * 功能：
 * - 记录最近使用的 5 个功能
 * - 使用 localStorage 存储
 * - 首页优先展示常用功能
 */

const STORAGE_KEY = 'pdf-toolbox-recent-usage'
const MAX_RECENT = 5

const FEATURE_INFO = {
  view: { name: '查看', icon: '👁️' },
  merge: { name: '合并', icon: '🔗' },
  compress: { name: '压缩', icon: '📦' },
  img: { name: '转图片', icon: '🖼️' },
  split: { name: '拆分', icon: '✂️' },
  img2pdf: { name: '图片转PDF', icon: '📸' },
  watermark: { name: '水印', icon: '💧' },
  'invoice-nup': { name: '发票拼版', icon: '🧾' },
  redaction: { name: '隐私遮盖', icon: '🛡️' },
  pipeline: { name: '工作流', icon: '⚡' },
  'page-manager': { name: '页面管理', icon: '📄' },
  encrypt: { name: '加密/解密', icon: '🔐' },
  'page-number': { name: '批量页码', icon: '🔢' },
  signature: { name: '签名', icon: '✍️' },
}

export function initRecentUsage() {
  renderRecentUsage()
  
  const originalOpenModal = window.openModal
  if (originalOpenModal) {
    window.openModal = function(key) {
      recordUsage(key)
      originalOpenModal(key)
    }
  }
}

function recordUsage(featureKey) {
  if (!FEATURE_INFO[featureKey]) return
  
  let recent = getRecentUsage()
  
  recent = recent.filter(item => item.key !== featureKey)
  
  recent.unshift({
    key: featureKey,
    name: FEATURE_INFO[featureKey].name,
    icon: FEATURE_INFO[featureKey].icon,
    timestamp: Date.now()
  })
  
  if (recent.length > MAX_RECENT) {
    recent = recent.slice(0, MAX_RECENT)
  }
  
  localStorage.setItem(STORAGE_KEY, JSON.stringify(recent))
  
  renderRecentUsage()
}

function getRecentUsage() {
  try {
    const data = localStorage.getItem(STORAGE_KEY)
    return data ? JSON.parse(data) : []
  } catch (error) {
    return []
  }
}

function renderRecentUsage() {
  const recent = getRecentUsage()
  const section = document.getElementById('recently-used-section')
  const list = document.getElementById('recently-used-list')
  
  if (!section || !list) return
  
  if (recent.length === 0) {
    section.style.display = 'none'
    return
  }
  
  section.style.display = 'block'
  
  list.innerHTML = recent.map(item => `
    <button 
      class="recent-item" 
      data-modal="${item.key}"
      style="
        display:flex;
        align-items:center;
        gap:8px;
        padding:8px 16px;
        background:var(--bg-secondary);
        border:1px solid var(--border);
        border-radius:8px;
        cursor:pointer;
        transition:all 0.2s;
      "
    >
      <span style="font-size:1.2rem;">${item.icon}</span>
      <span>${item.name}</span>
    </button>
  `).join('')
  
  list.querySelectorAll('.recent-item').forEach(btn => {
    btn.addEventListener('click', () => {
      const modalKey = btn.dataset.modal
      if (typeof openModal === 'function') {
        openModal(modalKey)
      }
    })
    
    btn.addEventListener('mouseenter', () => {
      btn.style.borderColor = 'var(--primary)'
      btn.style.transform = 'translateY(-2px)'
    })
    
    btn.addEventListener('mouseleave', () => {
      btn.style.borderColor = 'var(--border)'
      btn.style.transform = 'translateY(0)'
    })
  })
}
