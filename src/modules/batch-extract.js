/**
 * batch-extract.js - 批量提取页面模块
 * 
 * 功能：
 * - 从 PDF 中提取多个页面为独立的 PDF 文件
 * - 支持全选/取消/反选/范围选择
 * - 打包成 ZIP 下载
 */

import { showStatus, showProgress, downloadBlob } from '../utils.js'
import { PDFDocument } from 'pdf-lib'
import * as pdfjsLib from 'pdfjs-dist'
import JSZip from 'jszip'

let pdfDoc = null
let pdfBytes = null
let fileName = ''
let totalPages = 0
let selectedPages = new Set()

export function initBatchExtract() {
  console.log('[BatchExtract] Initializing...')
  
  const uploadZone = document.getElementById('batch-extract-upload')
  const fileInput = document.getElementById('batch-extract-file')
  
  if (uploadZone && fileInput) {
    console.log('[BatchExtract] Setting up upload zone...')
    uploadZone.addEventListener('click', () => fileInput.click())
    fileInput.addEventListener('change', (e) => {
      if (e.target.files.length > 0) {
        handleFileSelect(e.target.files[0])
      }
    })
    
    uploadZone.addEventListener('dragover', (e) => {
      e.preventDefault()
      uploadZone.classList.add('dragover')
    })
    
    uploadZone.addEventListener('dragleave', () => {
      uploadZone.classList.remove('dragover')
    })
    
    uploadZone.addEventListener('drop', (e) => {
      e.preventDefault()
      uploadZone.classList.remove('dragover')
      if (e.dataTransfer.files.length > 0) {
        handleFileSelect(e.dataTransfer.files[0])
      }
    })
    console.log('[BatchExtract] Upload zone set up successfully')
  } else {
    console.error('[BatchExtract] uploadZone or fileInput not found!')
  }
  
  const selectAllBtn = document.getElementById('be-select-all')
  const deselectAllBtn = document.getElementById('be-deselect-all')
  const invertBtn = document.getElementById('be-invert-selection')
  const rangeBtn = document.getElementById('be-select-range')
  const extractBtn = document.getElementById('be-extract-btn')
  const closeBtn = document.getElementById('be-close')
  
  if (selectAllBtn) selectAllBtn.addEventListener('click', selectAll)
  if (deselectAllBtn) deselectAllBtn.addEventListener('click', deselectAll)
  if (invertBtn) invertBtn.addEventListener('click', invertSelection)
  if (rangeBtn) rangeBtn.addEventListener('click', selectRange)
  if (extractBtn) extractBtn.addEventListener('click', batchExtract)
  if (closeBtn) closeBtn.addEventListener('click', () => {
    closeModal('batch-extract')
    resetState()
  })
}

async function handleFileSelect(file) {
  if (!file || file.type !== 'application/pdf') {
    showStatus('batch-extract-status', '请选择有效的 PDF 文件', 'error')
    return
  }

  showStatus('batch-extract-status', '正在加载 PDF...', 'info')
  
  try {
    const arrayBuffer = await file.arrayBuffer()
    pdfBytes = new Uint8Array(arrayBuffer)
    
    pdfDoc = await PDFDocument.load(pdfBytes)
    totalPages = pdfDoc.getPageCount()
    
    fileName = file.name.replace('.pdf', '')
    selectedPages.clear()
    
    document.getElementById('batch-extract-filename').textContent = file.name
    document.getElementById('batch-extract-pages').textContent = `${totalPages} 页`
    document.getElementById('batch-extract-selected').textContent = '0 页'
    document.getElementById('batch-extract-card').style.display = 'block'
    document.getElementById('be-extract-btn').disabled = true
    
    await renderPageGrid()
    
    showStatus('batch-extract-status', '', 'success')
  } catch (error) {
    showStatus('batch-extract-status', '加载失败：' + error.message, 'error')
    console.error(error)
  }
}

async function renderPageGrid() {
  const grid = document.getElementById('be-page-grid')
  grid.innerHTML = ''
  grid.style.cssText = 'display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:12px;margin-top:1rem;'
  
  const pdfjsDoc = await pdfjsLib.getDocument({ data: pdfBytes.slice() }).promise
  
  for (let i = 0; i < totalPages; i++) {
    const page = pdfDoc.getPage(i)
    const { width, height } = page.getSize()
    
    const card = document.createElement('div')
    card.className = 'page-card'
    card.dataset.pageIndex = i
    card.style.cssText = `
      position:relative;
      border:2px solid ${selectedPages.has(i) ? 'var(--primary)' : 'var(--border)'};
      border-radius:8px;
      padding:8px;
      cursor:pointer;
      background:var(--bg-secondary);
      transition:all 0.2s;
    `
    
    const canvas = document.createElement('canvas')
    canvas.width = 150
    canvas.height = Math.round(150 * (height / width))
    canvas.style.cssText = 'width:100%;border-radius:4px;'
    
    const pageNum = document.createElement('div')
    pageNum.style.cssText = 'text-align:center;margin-top:4px;font-size:0.85rem;color:var(--text-secondary);'
    pageNum.textContent = `第 ${i + 1} 页`
    
    const checkbox = document.createElement('div')
    checkbox.style.cssText = `
      position:absolute;
      top:4px;
      right:4px;
      width:20px;
      height:20px;
      border-radius:4px;
      background:${selectedPages.has(i) ? 'var(--primary)' : 'rgba(255,255,255,0.9)'};
      border:2px solid var(--primary);
      display:flex;
      align-items:center;
      justify-content:center;
      color:white;
      font-size:12px;
    `
    checkbox.textContent = selectedPages.has(i) ? '✓' : ''
    
    card.appendChild(canvas)
    card.appendChild(pageNum)
    card.appendChild(checkbox)
    grid.appendChild(card)
    
    renderThumbnail(canvas, i, pdfjsDoc)
    
    card.addEventListener('click', () => {
      toggleSelection(i)
    })
  }
}

async function renderThumbnail(canvas, pageIndex, pdfjsDoc) {
  try {
    const page = await pdfjsDoc.getPage(pageIndex + 1)
    const viewport = page.getViewport({ scale: 0.5 })
    canvas.width = viewport.width
    canvas.height = viewport.height
    
    const ctx = canvas.getContext('2d')
    await page.render({ canvasContext: ctx, viewport }).promise
  } catch (error) {
    console.error('渲染缩略图失败:', error)
  }
}

function toggleSelection(pageIndex) {
  if (selectedPages.has(pageIndex)) {
    selectedPages.delete(pageIndex)
  } else {
    selectedPages.add(pageIndex)
  }
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
    if (!selectedPages.has(i)) {
      newSelection.add(i)
    }
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
    showStatus('batch-extract-status', `已选择 ${pages.length} 页`, 'success')
  } catch (error) {
    showStatus('batch-extract-status', '页码范围格式错误：' + error.message, 'error')
  }
}

function parsePageRange(rangeStr, maxPages) {
  const pages = new Set()
  const parts = rangeStr.split(',')
  
  for (const part of parts) {
    const trimmed = part.trim()
    if (trimmed.includes('-')) {
      const [start, end] = trimmed.split('-').map(Number)
      if (isNaN(start) || isNaN(end) || start < 1 || end > maxPages || start > end) {
        throw new Error(`无效范围：${trimmed}`)
      }
      for (let i = start; i <= end; i++) {
        pages.add(i)
      }
    } else {
      const page = Number(trimmed)
      if (isNaN(page) || page < 1 || page > maxPages) {
        throw new Error(`无效页码：${trimmed}`)
      }
      pages.add(page)
    }
  }
  
  return Array.from(pages).sort((a, b) => a - b)
}

function updateSelectionUI() {
  document.getElementById('batch-extract-selected').textContent = `${selectedPages.size} 页`
  document.getElementById('be-extract-btn').disabled = selectedPages.size === 0
}

async function batchExtract() {
  if (selectedPages.size === 0) {
    showStatus('batch-extract-status', '请先选择要提取的页面', 'error')
    return
  }
  
  showStatus('batch-extract-status', '正在提取页面...', 'info')
  
  try {
    const zip = new JSZip()
    const sortedPages = Array.from(selectedPages).sort((a, b) => a - b)
    
    for (let i = 0; i < sortedPages.length; i++) {
      const pageIndex = sortedPages[i]
      showProgress('batch-extract-status', `正在提取第 ${pageIndex + 1} 页 (${i + 1}/${sortedPages.length})...`, 
        (i / sortedPages.length) * 80)
      
      const newPdf = await PDFDocument.create()
      const [copiedPage] = await newPdf.copyPages(pdfDoc, [pageIndex])
      newPdf.addPage(copiedPage)
      
      const bytes = await newPdf.save()
      const pageFileName = `${fileName}_第${pageIndex + 1}页.pdf`
      zip.file(pageFileName, bytes)
    }
    
    showProgress('batch-extract-status', '正在打包 ZIP...', 90)
    
    const zipBlob = await zip.generateAsync({ type: 'blob' })
    downloadBlob(zipBlob, `${fileName}_批量提取.zip`, true)
    
    showProgress('batch-extract-status', '完成！', 100)
    showStatus('batch-extract-status', `✅ 成功提取 ${sortedPages.length} 个页面！`, 'success')
  } catch (error) {
    showStatus('batch-extract-status', '提取失败：' + error.message, 'error')
    console.error(error)
  }
}

function resetState() {
  pdfDoc = null
  pdfBytes = null
  fileName = ''
  totalPages = 0
  selectedPages.clear()
  document.getElementById('batch-extract-card').style.display = 'none'
  document.getElementById('be-page-grid').innerHTML = ''
  document.getElementById('batch-extract-status').innerHTML = ''
}
