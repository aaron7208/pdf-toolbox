/**
 * page-reorder.js - 页面重排模块（拖拽排序）
 */

import { showStatus, showProgress, downloadBlob } from '../utils.js'
import { PDFDocument } from 'pdf-lib'
import * as pdfjsLib from 'pdfjs-dist'

let pdfDoc = null
let pdfBytes = null
let fileName = ''
let totalPages = 0
let pageOrder = []

export function initPageReorder() {
  console.log('[PageReorder] Initializing...')
  
  const uploadZone = document.getElementById('page-reorder-upload')
  const fileInput = document.getElementById('page-reorder-file')
  
  if (uploadZone && fileInput) {
    uploadZone.addEventListener('click', () => fileInput.click())
    fileInput.addEventListener('change', (e) => {
      if (e.target.files.length > 0) handleFileSelect(e.target.files[0])
    })
    
    uploadZone.addEventListener('dragover', (e) => { e.preventDefault(); uploadZone.classList.add('dragover') })
    uploadZone.addEventListener('dragleave', () => uploadZone.classList.remove('dragover'))
    uploadZone.addEventListener('drop', (e) => {
      e.preventDefault()
      uploadZone.classList.remove('dragover')
      if (e.dataTransfer.files.length > 0) handleFileSelect(e.dataTransfer.files[0])
    })
  }
  
  const saveBtn = document.getElementById('pr-save-btn')
  const closeBtn = document.getElementById('pr-close')
  
  if (saveBtn) saveBtn.addEventListener('click', saveReorder)
  if (closeBtn) closeBtn.addEventListener('click', () => { closeModal('page-reorder'); resetState() })
}

async function handleFileSelect(file) {
  if (!file || file.type !== 'application/pdf') {
    showStatus('page-reorder-status', '请选择有效的 PDF 文件', 'error')
    return
  }

  showStatus('page-reorder-status', '正在加载 PDF...', 'info')
  
  try {
    const arrayBuffer = await file.arrayBuffer()
    pdfBytes = new Uint8Array(arrayBuffer)
    pdfDoc = await PDFDocument.load(pdfBytes)
    totalPages = pdfDoc.getPageCount()
    fileName = file.name.replace('.pdf', '')
    pageOrder = Array.from({ length: totalPages }, (_, i) => i)
    
    document.getElementById('page-reorder-filename').textContent = file.name
    document.getElementById('page-reorder-pages').textContent = `${totalPages} 页`
    document.getElementById('page-reorder-card').style.display = 'block'
    
    await renderPageGrid()
    showStatus('page-reorder-status', '', 'success')
  } catch (error) {
    showStatus('page-reorder-status', '加载失败：' + error.message, 'error')
  }
}

async function renderPageGrid() {
  const grid = document.getElementById('pr-page-grid')
  grid.innerHTML = ''
  grid.style.cssText = 'display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:12px;margin-top:1rem;'
  
  const pdfjsDoc = await pdfjsLib.getDocument({ data: pdfBytes.slice() }).promise
  
  for (let displayIndex = 0; displayIndex < pageOrder.length; displayIndex++) {
    const originalIndex = pageOrder[displayIndex]
    const page = pdfDoc.getPage(originalIndex)
    const { width, height } = page.getSize()
    
    const card = document.createElement('div')
    card.className = 'page-card'
    card.dataset.displayIndex = displayIndex
    card.draggable = true
    card.style.cssText = 'position:relative;border:2px solid var(--border);border-radius:8px;padding:8px;cursor:move;background:var(--bg-secondary);transition:all 0.2s;'
    
    const canvas = document.createElement('canvas')
    canvas.width = 150
    canvas.height = Math.round(150 * (height / width))
    canvas.style.cssText = 'width:100%;border-radius:4px;'
    
    const pageNum = document.createElement('div')
    pageNum.style.cssText = 'text-align:center;margin-top:4px;font-size:0.85rem;color:var(--text-secondary);'
    pageNum.textContent = `第 ${displayIndex + 1} 页`
    
    const dragHandle = document.createElement('div')
    dragHandle.style.cssText = 'position:absolute;top:4px;left:4px;font-size:16px;color:var(--text-secondary);cursor:move;'
    dragHandle.textContent = '⋮⋮'
    
    card.appendChild(canvas)
    card.appendChild(pageNum)
    card.appendChild(dragHandle)
    grid.appendChild(card)
    
    const pdfjsPage = await pdfjsDoc.getPage(originalIndex + 1)
    const viewport = pdfjsPage.getViewport({ scale: 0.5 })
    canvas.width = viewport.width
    canvas.height = viewport.height
    const ctx = canvas.getContext('2d')
    await pdfjsPage.render({ canvasContext: ctx, viewport }).promise
    
    card.addEventListener('dragstart', (e) => {
      e.dataTransfer.setData('text/plain', displayIndex)
      card.style.opacity = '0.5'
    })
    
    card.addEventListener('dragend', () => {
      card.style.opacity = '1'
    })
    
    card.addEventListener('dragover', (e) => {
      e.preventDefault()
      card.style.borderColor = 'var(--primary)'
    })
    
    card.addEventListener('dragleave', () => {
      card.style.borderColor = 'var(--border)'
    })
    
    card.addEventListener('drop', (e) => {
      e.preventDefault()
      card.style.borderColor = 'var(--border)'
      const fromIndex = parseInt(e.dataTransfer.getData('text/plain'))
      const toIndex = displayIndex
      if (fromIndex !== toIndex) {
        reorderPages(fromIndex, toIndex)
      }
    })
  }
}

function reorderPages(fromIndex, toIndex) {
  const [movedItem] = pageOrder.splice(fromIndex, 1)
  pageOrder.splice(toIndex, 0, movedItem)
  renderPageGrid()
  showStatus('page-reorder-status', '页面顺序已更新', 'success')
}

async function saveReorder() {
  showStatus('page-reorder-status', '正在保存...', 'info')
  
  try {
    const newPdf = await PDFDocument.create()
    
    for (let i = 0; i < pageOrder.length; i++) {
      showProgress('page-reorder-status', `正在处理第 ${i + 1} 页...`, (i / pageOrder.length) * 80)
      const [copiedPage] = await newPdf.copyPages(pdfDoc, [pageOrder[i]])
      newPdf.addPage(copiedPage)
    }
    
    showProgress('page-reorder-status', '正在保存...', 90)
    const bytes = await newPdf.save()
    const blob = new Blob([bytes], { type: 'application/pdf' })
    downloadBlob(blob, `${fileName}_已重排.pdf`, true)
    
    showProgress('page-reorder-status', '完成！', 100)
    showStatus('page-reorder-status', '✅ 页面重排成功！', 'success')
  } catch (error) {
    showStatus('page-reorder-status', '保存失败：' + error.message, 'error')
  }
}

function resetState() {
  pdfDoc = null
  pdfBytes = null
  fileName = ''
  totalPages = 0
  pageOrder = []
  document.getElementById('page-reorder-card').style.display = 'none'
  document.getElementById('pr-page-grid').innerHTML = ''
  document.getElementById('page-reorder-status').innerHTML = ''
}
