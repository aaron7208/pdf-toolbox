/**
 * search.js - 首页搜索功能模块
 * 
 * 功能：
 * - 实时搜索功能卡片
 * - 支持中文和英文关键词匹配
 * - 高亮显示搜索结果
 */

const FEATURES = [
  { key: 'view', name: '查看', keywords: ['查看', 'view', '阅读', '浏览', '打开'] },
  { key: 'merge', name: '合并', keywords: ['合并', 'merge', '组合', '拼接', '连接'] },
  { key: 'compress', name: '压缩', keywords: ['压缩', 'compress', '减小', '优化', '缩小'] },
  { key: 'img', name: '转图片', keywords: ['转图片', 'image', 'png', 'jpg', '导出', '转换'] },
  { key: 'split', name: '拆分', keywords: ['拆分', 'split', '分割', '分离', '切割'] },
  { key: 'img2pdf', name: '图片转PDF', keywords: ['图片转pdf', 'image to pdf', '照片', 'jpg转pdf', 'png转pdf'] },
  { key: 'watermark', name: '水印', keywords: ['水印', 'watermark', '文字', '图片水印', '平铺'] },
  { key: 'invoice-nup', name: '发票拼版', keywords: ['发票', 'invoice', '拼版', 'n-up', '打印'] },
  { key: 'redaction', name: '隐私遮盖', keywords: ['隐私', 'redaction', '遮盖', '遮挡', '敏感', '隐藏'] },
  { key: 'pipeline', name: '工作流', keywords: ['工作流', 'pipeline', '批量', '自动化', '模板'] },
  { key: 'page-manager', name: '页面管理', keywords: ['页面', 'page', '旋转', '删除', '排序', '提取', ' reorder'] },
  { key: 'encrypt', name: '加密/解密', keywords: ['加密', 'encrypt', '解密', 'decrypt', '密码', 'password', '保护'] },
  { key: 'page-number', name: '批量页码', keywords: ['页码', 'page number', '页码', '编号', '分页'] },
]

export function initSearch() {
  const searchInput = document.getElementById('feature-search-input')
  const clearBtn = document.getElementById('search-clear-btn')
  const searchResults = document.getElementById('search-results')
  const featuresGrid = document.querySelector('.features-grid')
  
  if (!searchInput) return
  
  searchInput.addEventListener('input', (e) => {
    const query = e.target.value.trim()
    
    if (query) {
      clearBtn.style.display = 'block'
      const results = searchFeatures(query)
      displayResults(results, query)
      filterFeatureCards(results)
    } else {
      clearBtn.style.display = 'none'
      searchResults.style.display = 'none'
      filterFeatureCards(null)
    }
  })
  
  clearBtn.addEventListener('click', () => {
    searchInput.value = ''
    clearBtn.style.display = 'none'
    searchResults.style.display = 'none'
    filterFeatureCards(null)
    searchInput.focus()
  })
  
  searchInput.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      searchInput.value = ''
      clearBtn.style.display = 'none'
      searchResults.style.display = 'none'
      filterFeatureCards(null)
      searchInput.blur()
    }
  })
}

function searchFeatures(query) {
  const lowerQuery = query.toLowerCase()
  
  return FEATURES.filter(feature => {
    return feature.keywords.some(keyword => 
      keyword.toLowerCase().includes(lowerQuery)
    )
  })
}

function displayResults(results, query) {
  const searchResults = document.getElementById('search-results')
  
  if (results.length === 0) {
    searchResults.innerHTML = `
      <div style="padding:12px;text-align:center;color:var(--text-secondary);background:var(--bg-secondary);border-radius:8px;">
        未找到匹配的功能
      </div>
    `
    searchResults.style.display = 'block'
    return
  }
  
  searchResults.innerHTML = `
    <div style="display:flex;flex-wrap:wrap;gap:8px;">
      ${results.map(feature => `
        <button 
          class="search-result-item" 
          data-modal="${feature.key}"
          style="padding:8px 16px;background:var(--primary);color:white;border:none;border-radius:20px;cursor:pointer;font-size:0.9rem;"
        >
          ${highlightText(feature.name, query)}
        </button>
      `).join('')}
    </div>
  `
  
  searchResults.style.display = 'block'
  
  searchResults.querySelectorAll('.search-result-item').forEach(btn => {
    btn.addEventListener('click', () => {
      const modalKey = btn.dataset.modal
      if (typeof openModal === 'function') {
        openModal(modalKey)
      }
      document.getElementById('feature-search-input').value = ''
      document.getElementById('search-clear-btn').style.display = 'none'
      searchResults.style.display = 'none'
      filterFeatureCards(null)
    })
  })
}

function highlightText(text, query) {
  if (!query) return text
  
  const regex = new RegExp(`(${query})`, 'gi')
  return text.replace(regex, '<mark style="background:yellow;color:black;padding:0 2px;">$1</mark>')
}

function filterFeatureCards(results) {
  const cards = document.querySelectorAll('.feature-card[data-modal]')
  
  if (!results) {
    cards.forEach(card => {
      card.style.display = 'block'
    })
    return
  }
  
  const matchedKeys = new Set(results.map(r => r.key))
  
  cards.forEach(card => {
    const modalKey = card.dataset.modal
    if (matchedKeys.has(modalKey)) {
      card.style.display = 'block'
    } else {
      card.style.display = 'none'
    }
  })
}
