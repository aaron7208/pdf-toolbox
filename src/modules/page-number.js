/**
 * page-number.js - 批量添加页码模块
 * 
 * 功能：
 * - 为 PDF 批量添加页码
 * - 支持多种格式（简单数字、带总页数、中文格式）
 * - 自定义位置、字号、颜色
 */

import { showStatus, downloadBlob, resetUploadZone } from '../utils.js'
import { PDFDocument, rgb, StandardFonts } from 'pdf-lib'

function setupUploadZone(uploadZoneId, fileInputId, handler) {
  console.log(`[PageNumber] Setting up upload zone: ${uploadZoneId}`)
  const uploadZone = document.getElementById(uploadZoneId)
  const fileInput = document.getElementById(fileInputId)
  
  console.log(`[PageNumber] uploadZone:`, uploadZone)
  console.log(`[PageNumber] fileInput:`, fileInput)
  
  if (uploadZone && fileInput) {
    uploadZone.addEventListener('click', () => {
      console.log(`[PageNumber] ${uploadZoneId} clicked`)
      fileInput.click()
    })
    fileInput.addEventListener('change', (e) => {
      console.log(`[PageNumber] File selected:`, e.target.files[0])
      if (e.target.files.length > 0) {
        handler(e.target.files[0])
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
        handler(e.dataTransfer.files[0])
      }
    })
    console.log(`[PageNumber] Upload zone ${uploadZoneId} set up successfully`)
  } else {
    console.error(`[PageNumber] uploadZone or fileInput not found for ${uploadZoneId}!`)
  }
}

let pageNumberPdfBytes = null
let pageNumberFileName = ''
let pageNumberTotalPages = 0

export function initPageNumber() {
  setupUploadZone('page-number-upload', 'page-number-file', handleFileSelect)
  
  const applyBtn = document.getElementById('pn-apply-btn')
  const closeBtn = document.getElementById('pn-close')
  const fontsizeInput = document.getElementById('pn-fontsize')
  const fontsizeVal = document.getElementById('pn-fontsize-val')
  
  if (applyBtn) applyBtn.addEventListener('click', addPageNumbers)
  if (closeBtn) closeBtn.addEventListener('click', () => {
    closeModal('page-number')
    resetState()
  })
  if (fontsizeInput && fontsizeVal) {
    fontsizeInput.addEventListener('input', (e) => {
      fontsizeVal.textContent = e.target.value
    })
  }
}

async function handleFileSelect(file) {
  if (!file || file.type !== 'application/pdf') {
    showStatus('page-number-status', '请选择有效的 PDF 文件', 'error')
    return
  }

  try {
    const arrayBuffer = await file.arrayBuffer()
    pageNumberPdfBytes = new Uint8Array(arrayBuffer)
    
    const pdfDoc = await PDFDocument.load(pageNumberPdfBytes)
    pageNumberTotalPages = pdfDoc.getPageCount()
    
    pageNumberFileName = file.name.replace('.pdf', '')
    
    document.getElementById('page-number-filename').textContent = file.name
    document.getElementById('page-number-pages').textContent = `${pageNumberTotalPages} 页`
    document.getElementById('page-number-card').style.display = 'block'
    document.getElementById('pn-apply-btn').disabled = false
    
    showStatus('page-number-status', '', 'success')
  } catch (error) {
    showStatus('page-number-status', '加载失败：' + error.message, 'error')
    console.error(error)
  }
}

async function addPageNumbers() {
  showStatus('page-number-status', '正在添加页码...', 'info')
  
  try {
    const format = document.getElementById('pn-format').value
    const position = document.getElementById('pn-position').value
    const fontSize = parseInt(document.getElementById('pn-fontsize').value)
    const colorHex = document.getElementById('pn-color').value
    const startPage = parseInt(document.getElementById('pn-start').value) || 1
    
    const color = hexToRgb(colorHex)
    
    const fontUpload = document.getElementById('pn-font-upload').files[0]
    let customFont = null
    
    if (fontUpload) {
      const fontBytes = await fontUpload.arrayBuffer()
      customFont = await pdfDoc.embedFont(fontBytes)
    }
    
    const pdfDoc = await PDFDocument.load(pageNumberPdfBytes)
    const font = customFont || await pdfDoc.embedFont(StandardFonts.Helvetica)
    
    const pages = pdfDoc.getPages()
    
    for (let i = 0; i < pages.length; i++) {
      const page = pages[i]
      const { width, height } = page.getSize()
      const currentPageNum = startPage + i
      const pageNumText = formatPageNumber(currentPageNum, pageNumberTotalPages, format)
      
      const textWidth = font.widthOfTextAtSize(pageNumText, fontSize)
      const textHeight = font.heightAtSize(fontSize)
      
      let x, y
      
      switch (position) {
        case 'bottom-center':
          x = (width - textWidth) / 2
          y = 20
          break
        case 'bottom-left':
          x = 20
          y = 20
          break
        case 'bottom-right':
          x = width - textWidth - 20
          y = 20
          break
        case 'top-center':
          x = (width - textWidth) / 2
          y = height - 20 - textHeight
          break
        case 'top-left':
          x = 20
          y = height - 20 - textHeight
          break
        case 'top-right':
          x = width - textWidth - 20
          y = height - 20 - textHeight
          break
        default:
          x = (width - textWidth) / 2
          y = 20
      }
      
      page.drawText(pageNumText, {
        x,
        y,
        size: fontSize,
        font,
        color: rgb(color.r, color.g, color.b),
      })
    }
    
    const bytes = await pdfDoc.save()
    const blob = new Blob([bytes], { type: 'application/pdf' })
    downloadBlob(blob, `${pageNumberFileName}_已添加页码.pdf`)
    
    showStatus('page-number-status', '页码添加成功！', 'success')
  } catch (error) {
    showStatus('page-number-status', '添加失败：' + error.message, 'error')
    console.error(error)
  }
}

function formatPageNumber(current, total, format) {
  switch (format) {
    case 'simple':
      return `${current}`
    case 'with-total':
      return `${current}/${total}`
    case 'chinese':
      return `第${current}页`
    case 'chinese-total':
      return `第${current}页/共${total}页`
    default:
      return `${current}`
  }
}

function hexToRgb(hex) {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex)
  return result ? {
    r: parseInt(result[1], 16) / 255,
    g: parseInt(result[2], 16) / 255,
    b: parseInt(result[3], 16) / 255
  } : { r: 0, g: 0, b: 0 }
}

function resetState() {
  pageNumberPdfBytes = null
  pageNumberFileName = ''
  pageNumberTotalPages = 0
  document.getElementById('page-number-card').style.display = 'none'
  document.getElementById('page-number-status').innerHTML = ''
}
