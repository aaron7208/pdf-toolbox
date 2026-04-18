/**
 * batch-rotate.js - 批量旋转页面模块
 */

import { showStatus, showProgress, downloadBlob } from '../utils.js'
import { PDFDocument, degrees } from 'pdf-lib'
import * as pdfjsLib from 'pdfjs-dist'

let pdfDoc = null
let pdfBytes = null
let fileName = ''
let totalPages = 0
let selectedPages = new Set()

export function initBatchRotate() {
  console.log('[BatchRotate] Initializing...')
  
  const uploadZone = document.getElementById('batch-rotate-upload')
  const fileInput = document.getElementById('batch-rotate-file')
  
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
  
  const selectAllBtn = document.getElementById('br-select-all')
  const deselectAllBtn = document.getElementById('br-deselect-all')
  const invertBtn = document.getElementById('br-invert-selection')
  const rangeBtn = document.getElementById('br-select-range')
  const rotateBtn = document.getElementById('br-rotate-btn')
  const closeBtn = document.getElementById('br-close')
  
  if (selectAllBtn) selectAllBtn.addEventListener('click', selectAll)
  if (deselectAllBtn) deselectAllBtn.addEventListener('click', deselectAll)
  if (invertBtn) invertBtn.addEventListener('click', invertSelection)
  if (rangeBtn) rangeBtn.addEventListener('click', selectRange)
  if (rotateBtn) rotateBtn.addEventListener('click', batchRotate)
  if (closeBtn) closeBtn.addEventListener('click', () => { closeModal('batch-rotate'); resetState() })
}

async function handleFileSelect(file) {
  if (!file || file.type !== 'application/pdf') {
    showStatus('batch-rotate-status', '请选择有效的 PDF 文件', 'error')
    return
  }

  showStatus('batch-rotate-status', '正在加载 PDF...', 'info')
  
  try {
    const arrayBuffer = await file.arrayBuffer()
    pdfBytes = new Uint8Array(arrayBuffer)
    pdfDoc = await PDFDocument.load(pdfBytes)
    totalPages = pdfDoc.getPageCount()
    fileName = file.name.replace('.pdf', '')
    selectedPages.clear()
    
    document.getElementById('batch-rotate-filename').textContent = file.name
    document.getElementById('batch-rotate-pages').textContent = `${totalPages} 页`
    updateSelectionUI()
    document.getElementById('batch-rotate-card').style.display = 'block'
    
    await renderPageGrid()
    showStatus('batch-rotate-status', '', 'success')
  } catch (error) {
    showStatus('batch-rotate-status', '加载失败：' + error.message, 'error')
  }
}

async function renderPageGrid() {
  const grid = document.getElementById('br-page-grid')
  grid.innerHTML = ''
  grid.style.cssText = 'display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:12px;margin-top:1rem;'
  
  const pdfjsDoc = await pdfjsLib.getDocument({ data: pdfBytes.slice() }).promise
  
  for (let i = 0; i < totalPages; i++) {
    const page = pdfDoc.getPage(i)
    const { width, height } = page.getSize()
    
    const card = document.createElement('div')
    card.dataset.pageIndex = i
    card.style.cssText = `position:relative;border:2px solid ${selectedPages.has(i) ? 'var(--primary)' : 'var(--border)'};border-radius:8px;padding:8px;cursor:pointer;background:var(--bg-secondary);transition:all 0.2s;`
    
    const canvas = document.createElement('canvas')
    canvas.width = 150
    canvas.height = Math.round(150 * (height / width))
    canvas.style.cssText = 'width:100%;border-radius:4px;'
    
    const pageNum = document.createElement('div')
    pageNum.style.cssText = 'text-align:center;margin-top:4px;font-size:0.85rem;color:var(--text-secondary);'
    pageNum.textContent = `第 ${i + 1} 页`
    
    const checkbox = document.createElement('div')
    checkbox.style.cssText = `position:absolute;top:4px;right:4px;width:20px;height:20px;border-radius:4px;background:${selectedPages.has(i) ? 'var(--primary)' : 'rgba(255,255,255,0.9)'};border:2px solid var(--primary);display:flex;align-items:center;justify-content:center;color:white;font-size:12px;`
    checkbox.textContent = selectedPages.has(i) ? '✓' : ''
    
    card.appendChild(canvas)
    card.appendChild(pageNum)
    card.appendChild(checkbox)
    grid.appendChild(card)
    
    const pdfjsPage = await pdfjsDoc.getPage(i + 1)
    const viewport = pdfjsPage.getViewport({ scale: 0.5 })
    canvas.width = viewport.width
    canvas.height = viewport.height
    const ctx = canvas.getContext('2d')
    await pdfjsPage.render({ canvasContext: ctx, viewport }).promise
    
    card.addEventListener('click', () => toggleSelection(i))
  }
}

function toggleSelection(i) {
  selectedPages.has(i) ? selectedPages.delete(i) : selectedPages.add(i)
  updateSelectionUI()
  renderPageGrid()
}

function selectAll() {
  selectedPages = new Set(Array.from({ length: totalPages }, (_, i) => i))
  updateSelectionUI()
  renderPageGrid()
}

function deselectAll() {
  selectedPages.clear()
  updateSelectionUI()
  renderPageGrid()
}

function invertSelection() {
  const newSelection = new Set()
  for (let i = 0; i < totalPages; i++) {
    if (!selectedPages.has(i)) newSelection.add(i)
  }
  selectedPages = newSelection
  updateSelectionUI()
  renderPageGrid()
}

function selectRange() {
  const range = prompt('请输入页码范围（例如：1-5,8,10-12）：')
  if (!range) return
  try {
    const pages = parsePageRange(range, totalPages)
    selectedPages = new Set(pages.map(p => p - 1))
    updateSelectionUI()
    renderPageGrid()
    showStatus('batch-rotate-status', `已选择 ${pages.length} 页`, 'success')
  } catch (error) {
    showStatus('batch-rotate-status', '页码范围格式错误：' + error.message, 'error')
  }
}

function parsePageRange(rangeStr, maxPages) {
  const pages = new Set()
  for (const part of rangeStr.split(',')) {
    const trimmed = part.trim()
    if (trimmed.includes('-')) {
      const [start, end] = trimmed.split('-').map(Number)
      if (isNaN(start) || isNaN(end) || start < 1 || end > maxPages || start > end) throw new Error(`无效范围：${trimmed}`)
      for (let i = start; i <= end; i++) pages.add(i)
    } else {
      const page = Number(trimmed)
      if (isNaN(page) || page < 1 || page > maxPages) throw new Error(`无效页码：${trimmed}`)
      pages.add(page)
    }
  }
  return Array.from(pages).sort((a, b) => a - b)
}

function updateSelectionUI() {
  document.getElementById('batch-rotate-selected').textContent = `${selectedPages.size} 页`
  document.getElementById('br-rotate-btn').disabled = selectedPages.size === 0
}

async function batchRotate() {
  if (selectedPages.size === 0) {
    showStatus('batch-rotate-status', '请先选择要旋转的页面', 'error')
    return
  }
  
  const angleRadio = document.querySelector('input[name="rotate-angle"]:checked')
  const angle = parseInt(angleRadio.value)
  
  showStatus('batch-rotate-status', `正在旋转 ${selectedPages.size} 页（${angle}°）...`, 'info')
  
  try {
    const pages = pdfDoc.getPages()
    selectedPages.forEach(index => {
      const page = pages[index]
      const currentRotation = page.getRotation().angle
      page.setRotation(degrees(currentRotation + angle))
    })
    
    showProgress('batch-rotate-status', '正在保存...', 80)
    const bytes = await pdfDoc.save()
    const blob = new Blob([bytes], { type: 'application/pdf' })
    downloadBlob(blob, `${fileName}_已旋转.pdf`, true)
    
    showProgress('batch-rotate-status', '完成！', 100)
    showStatus('batch-rotate-status', `✅ 成功旋转 ${selectedPages.size} 页（${angle}°）！`, 'success')
  } catch (error) {
    showStatus('batch-rotate-status', '旋转失败：' + error.message, 'error')
  }
}

function resetState() {
  pdfDoc = null
  pdfBytes = null
  fileName = ''
  totalPages = 0
  selectedPages.clear()
  document.getElementById('batch-rotate-card').style.display = 'none'
  document.getElementById('br-page-grid').innerHTML = ''
  document.getElementById('batch-rotate-status').innerHTML = ''
}
