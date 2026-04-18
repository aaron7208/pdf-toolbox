/**
 * page-manager.js - PDF 页面管理模块
 * 
 * 功能：
 * - 旋转页面（90°/180°/270°）
 * - 删除指定页面
 * - 拖拽重新排序页面
 * - 提取指定页面为新 PDF
 */

import { state, setState } from '../state.js'
import { formatSize, showStatus, downloadBlob } from '../utils.js'
import { showUploadFileInfo, resetUploadZone } from '../utils/upload-zone.js'
import * as pdfjsLib from 'pdfjs-dist'
import { PDFDocument, degrees } from 'pdf-lib'

let pdfDoc = null
let pdfBytes = null
let fileName = ''
let pageRotations = []
let pageOrder = []
let selectedPages = new Set()

export function initPageManager() {
  console.log('[PageManager] Initializing...')
  const uploadZone = document.getElementById('page-manager-upload')
  const fileInput = document.getElementById('page-manager-file')
  
  console.log('[PageManager] uploadZone:', uploadZone)
  console.log('[PageManager] fileInput:', fileInput)
  
  if (uploadZone && fileInput) {
    console.log('[PageManager] Setting up event listeners...')
    uploadZone.addEventListener('click', () => {
      console.log('[PageManager] Upload zone clicked')
      fileInput.click()
    })
    fileInput.addEventListener('change', (e) => {
      console.log('[PageManager] File selected:', e.target.files[0])
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
    console.log('[PageManager] Event listeners set up successfully')
  } else {
    console.error('[PageManager] uploadZone or fileInput not found!')
  }
  
  const rotateCwBtn = document.getElementById('pm-rotate-cw')
  const rotateCcwBtn = document.getElementById('pm-rotate-ccw')
  const deleteBtn = document.getElementById('pm-delete')
  const extractBtn = document.getElementById('pm-extract')
  const selectAllBtn = document.getElementById('pm-select-all')
  const deselectAllBtn = document.getElementById('pm-deselect-all')
  const saveBtn = document.getElementById('pm-save-btn')
  const closeBtn = document.getElementById('pm-close')
  
  if (rotateCwBtn) rotateCwBtn.addEventListener('click', () => rotateSelected(90))
  if (rotateCcwBtn) rotateCcwBtn.addEventListener('click', () => rotateSelected(-90))
  if (deleteBtn) deleteBtn.addEventListener('click', deleteSelected)
  if (extractBtn) extractBtn.addEventListener('click', extractSelected)
  if (selectAllBtn) selectAllBtn.addEventListener('click', selectAll)
  if (deselectAllBtn) deselectAllBtn.addEventListener('click', deselectAll)
  if (saveBtn) saveBtn.addEventListener('click', saveChanges)
  if (closeBtn) closeBtn.addEventListener('click', () => {
    closeModal('page-manager')
    resetState()
  })
}

async function handleFileSelect(file) {
  if (!file || file.type !== 'application/pdf') {
    showStatus('page-manager-status', '请选择有效的 PDF 文件', 'error')
    return
  }

  showStatus('page-manager-status', '正在加载 PDF...', 'info')
  
  try {
    const arrayBuffer = await file.arrayBuffer()
    pdfBytes = new Uint8Array(arrayBuffer)
    
    pdfDoc = await PDFDocument.load(pdfBytes)
    const totalPages = pdfDoc.getPageCount()
    
    fileName = file.name.replace('.pdf', '')
    
    pageRotations = new Array(totalPages).fill(0)
    pageOrder = Array.from({ length: totalPages }, (_, i) => i)
    selectedPages.clear()
    
    document.getElementById('page-manager-filename').textContent = file.name
    document.getElementById('page-manager-pages').textContent = `${totalPages} 页`
    document.getElementById('page-manager-card').style.display = 'block'
    document.getElementById('pm-save-btn').disabled = false
    
    await renderPageGrid()
    
    showStatus('page-manager-status', '', 'success')
  } catch (error) {
    showStatus('page-manager-status', '加载失败：' + error.message, 'error')
    console.error(error)
  }
}

async function renderPageGrid() {
  const grid = document.getElementById('page-grid')
  grid.innerHTML = ''
  grid.style.cssText = 'display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:12px;margin-top:1rem;'
  
  const totalPages = pageOrder.length
  
  for (let displayIndex = 0; displayIndex < totalPages; displayIndex++) {
    const originalIndex = pageOrder[displayIndex]
    const page = pdfDoc.getPage(originalIndex)
    const { width, height } = page.getSize()
    
    const card = document.createElement('div')
    card.className = 'page-card'
    card.dataset.displayIndex = displayIndex
    card.dataset.originalIndex = originalIndex
    card.draggable = true
    
    card.style.cssText = `
      position:relative;
      border:2px solid ${selectedPages.has(displayIndex) ? 'var(--primary)' : 'var(--border)'};
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
    
    const rotation = pageRotations[originalIndex]
    if (rotation !== 0) {
      canvas.style.transform = `rotate(${rotation}deg)`
    }
    
    const pageNum = document.createElement('div')
    pageNum.style.cssText = 'text-align:center;margin-top:4px;font-size:0.85rem;color:var(--text-secondary);'
    pageNum.textContent = `第 ${displayIndex + 1} 页`
    
    const checkbox = document.createElement('div')
    checkbox.style.cssText = `
      position:absolute;
      top:4px;
      right:4px;
      width:20px;
      height:20px;
      border-radius:4px;
      background:${selectedPages.has(displayIndex) ? 'var(--primary)' : 'rgba(255,255,255,0.9)'};
      border:2px solid var(--primary);
      display:flex;
      align-items:center;
      justify-content:center;
      color:white;
      font-size:12px;
    `
    checkbox.textContent = selectedPages.has(displayIndex) ? '✓' : ''
    
    card.appendChild(canvas)
    card.appendChild(pageNum)
    card.appendChild(checkbox)
    grid.appendChild(card)
    
    renderThumbnail(canvas, originalIndex, rotation)
    
    card.addEventListener('click', (e) => {
      if (e.target === checkbox || e.target.closest('.page-card')) {
        toggleSelection(displayIndex)
      }
    })
    
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
      card.style.borderColor = selectedPages.has(displayIndex) ? 'var(--primary)' : 'var(--border)'
    })
    
    card.addEventListener('drop', (e) => {
      e.preventDefault()
      const fromIndex = parseInt(e.dataTransfer.getData('text/plain'))
      const toIndex = displayIndex
      if (fromIndex !== toIndex) {
        reorderPages(fromIndex, toIndex)
      }
    })
  }
}

async function renderThumbnail(canvas, pageIndex, rotation) {
  try {
    const pdf = await pdfjsLib.getDocument({ data: pdfBytes.slice() }).promise
    const page = await pdf.getPage(pageIndex + 1)
    
    const viewport = page.getViewport({ scale: 0.5 })
    canvas.width = viewport.width
    canvas.height = viewport.height
    
    const ctx = canvas.getContext('2d')
    await page.render({ canvasContext: ctx, viewport }).promise
  } catch (error) {
    console.error('渲染缩略图失败:', error)
  }
}

function toggleSelection(displayIndex) {
  if (selectedPages.has(displayIndex)) {
    selectedPages.delete(displayIndex)
  } else {
    selectedPages.add(displayIndex)
  }
  renderPageGrid()
}

function selectAll() {
  const totalPages = pageOrder.length
  selectedPages = new Set(Array.from({ length: totalPages }, (_, i) => i))
  renderPageGrid()
}

function deselectAll() {
  selectedPages.clear()
  renderPageGrid()
}

function rotateSelected(degrees) {
  if (selectedPages.size === 0) {
    showStatus('page-manager-status', '请先选择要旋转的页面', 'error')
    return
  }
  
  selectedPages.forEach(displayIndex => {
    const originalIndex = pageOrder[displayIndex]
    pageRotations[originalIndex] = (pageRotations[originalIndex] + degrees + 360) % 360
  })
  
  renderPageGrid()
  showStatus('page-manager-status', `已旋转 ${selectedPages.size} 个页面`, 'success')
}

function deleteSelected() {
  if (selectedPages.size === 0) {
    showStatus('page-manager-status', '请先选择要删除的页面', 'error')
    return
  }
  
  const indicesToDelete = Array.from(selectedPages).sort((a, b) => b - a)
  indicesToDelete.forEach(displayIndex => {
    pageOrder.splice(displayIndex, 1)
  })
  
  selectedPages.clear()
  renderPageGrid()
  showStatus('page-manager-status', `已删除 ${indicesToDelete.length} 个页面`, 'success')
}

async function extractSelected() {
  if (selectedPages.size === 0) {
    showStatus('page-manager-status', '请先选择要提取的页面', 'error')
    return
  }
  
  showStatus('page-manager-status', '正在提取页面...', 'info')
  
  try {
    const newPdf = await PDFDocument.create()
    const indicesToExtract = Array.from(selectedPages).sort((a, b) => a - b)
    
    for (const displayIndex of indicesToExtract) {
      const originalIndex = pageOrder[displayIndex]
      const [copiedPage] = await newPdf.copyPages(pdfDoc, [originalIndex])
      if (pageRotations[originalIndex] !== 0) {
        copiedPage.setRotation(degrees(pageRotations[originalIndex]))
      }
      newPdf.addPage(copiedPage)
    }
    
    const bytes = await newPdf.save()
    const blob = new Blob([bytes], { type: 'application/pdf' })
    downloadBlob(blob, `${fileName}_提取.pdf`)
    
    showStatus('page-manager-status', '提取成功！', 'success')
  } catch (error) {
    showStatus('page-manager-status', '提取失败：' + error.message, 'error')
    console.error(error)
  }
}

function reorderPages(fromIndex, toIndex) {
  const [movedItem] = pageOrder.splice(fromIndex, 1)
  pageOrder.splice(toIndex, 0, movedItem)
  renderPageGrid()
  showStatus('page-manager-status', '页面已重新排序', 'success')
}

async function saveChanges() {
  showStatus('page-manager-status', '正在保存...', 'info')
  
  try {
    const newPdf = await PDFDocument.create()
    
    for (const originalIndex of pageOrder) {
      const [copiedPage] = await newPdf.copyPages(pdfDoc, [originalIndex])
      if (pageRotations[originalIndex] !== 0) {
        copiedPage.setRotation(degrees(pageRotations[originalIndex]))
      }
      newPdf.addPage(copiedPage)
    }
    
    const bytes = await newPdf.save()
    const blob = new Blob([bytes], { type: 'application/pdf' })
    downloadBlob(blob, `${fileName}_已修改.pdf`)
    
    showStatus('page-manager-status', '保存成功！', 'success')
  } catch (error) {
    showStatus('page-manager-status', '保存失败：' + error.message, 'error')
    console.error(error)
  }
}

function resetState() {
  pdfDoc = null
  pdfBytes = null
  fileName = ''
  pageRotations = []
  pageOrder = []
  selectedPages.clear()
  document.getElementById('page-manager-card').style.display = 'none'
  document.getElementById('page-grid').innerHTML = ''
  document.getElementById('page-manager-status').innerHTML = ''
}
