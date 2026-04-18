/**
 * compress.js - PDF 压缩模块（带进度条）
 * 
 * 增强功能：
 * - 三级压缩级别（轻度/中度/重度）
 * - 图像重采样（降低 DPI）
 * - 移除元数据（可选）
 */

import * as PDFLib from 'pdf-lib'
import * as pdfjsLib from 'pdfjs-dist'
import { state } from '../state.js'
import { formatSize, showStatus, showProgress, showProcessing, showReport, clearStatus, downloadBlob, MAX_FILE_SIZE, checkFileSize, trackEvent, showUploadFileInfo, resetUploadZone, cleanupResources } from '../utils.js'

export function initCompress() {
  const uploadZone = document.getElementById('compress-upload')
  const fileInput = document.getElementById('compress-file')
  const infoDiv = document.getElementById('compress-info')
  const filenameEl = document.getElementById('compress-filename')
  const originalSizeEl = document.getElementById('compress-original-size')
  const pagesEl = document.getElementById('compress-pages')
  const compressBtn = document.getElementById('compress-btn')
  const closeBtn = document.getElementById('compress-close')
  const status = document.getElementById('compress-status')

  uploadZone.addEventListener('click', () => fileInput.click())
  uploadZone.addEventListener('dragover', e => {
    e.preventDefault()
    uploadZone.classList.add('dragover')
  })
  uploadZone.addEventListener('dragleave', () => uploadZone.classList.remove('dragover'))
  uploadZone.addEventListener('drop', e => {
    e.preventDefault()
    uploadZone.classList.remove('dragover')
    const file = e.dataTransfer.files[0]
    if (file && (file.type === 'application/pdf' || file.name.endsWith('.pdf'))) {
      loadCompressFile(file)
    }
  })
  fileInput.addEventListener('change', () => {
    if (fileInput.files[0]) loadCompressFile(fileInput.files[0])
  })

  async function loadCompressFile(file) {
    if (file.size > MAX_FILE_SIZE) {
      showStatus(status, `⚠️ 文件过大（${formatSize(file.size)}），建议不超过 50MB`, 'warning')
      return
    }

    try {
      showProgress(status, '正在加载文件...', 20)
      const bytes = await file.arrayBuffer()
      state.compress.pdfBytes = new Uint8Array(bytes)
      state.compress.pdfFile = file
      trackEvent('file_uploaded', { function: 'compress', name: file.name, size: file.size })

      showProgress(status, '正在解析 PDF...', 60)
      const pdfDoc = await PDFLib.PDFDocument.load(state.compress.pdfBytes, { ignoreEncryption: false })
      state.compress.totalPages = pdfDoc.getPageCount()
      state.compress.encrypted = false

      filenameEl.textContent = file.name
      originalSizeEl.textContent = formatSize(file.size)
      pagesEl.textContent = state.compress.totalPages + ' 页'

      showUploadFileInfo(uploadZone, file)
      infoDiv.style.display = 'block'
      clearStatus(status)
    } catch (err) {
      if (err.message.includes('encrypted') || err.message.includes('password')) {
        state.compress.pdfBytes = null
        state.compress.pdfFile = null
        state.compress.encrypted = true
        showStatus(status, '❌ 该 PDF 文件已加密，无法压缩', 'error')
      } else {
        showStatus(status, '❌ 无法加载 PDF: ' + err.message, 'error')
      }
    }
  }

  closeBtn.addEventListener('click', () => {
    state.compress.pdfFile = null
    state.compress.pdfBytes = null
    state.compress.totalPages = 0
    infoDiv.style.display = 'none'
    resetUploadZone(uploadZone)
    fileInput.value = ''
    clearStatus(status)
  })

  compressBtn.addEventListener('click', async () => {
    if (!state.compress.pdfBytes) return
    if (state.compress.encrypted) {
      showStatus(status, '❌ 该 PDF 文件已加密，请先解密后再压缩', 'error')
      return
    }
    try {
      showProcessing(status, '正在压缩优化...', 30)
      compressBtn.disabled = true
      const startTime = performance.now()

      const compressLevel = document.querySelector('input[name="compress-level"]:checked').value
      const resampleImages = document.getElementById('compress-resample-images').checked
      const removeMetadata = document.getElementById('compress-remove-metadata').checked

      let compressedBytes
      
      if (resampleImages) {
        compressedBytes = await advancedCompress(state.compress.pdfBytes, compressLevel, removeMetadata, status)
      } else {
        const pdfDoc = await PDFLib.PDFDocument.load(state.compress.pdfBytes)
        compressedBytes = await pdfDoc.save({
          useObjectStreams: true,
          addDefaultPage: false,
          objectsPerTick: 50,
        })
      }

      showProcessing(status, '即将完成...', 90)

      const originalSize = state.compress.pdfBytes.length
      const compressedSize = compressedBytes.length
      const ratio = ((1 - compressedSize / originalSize) * 100).toFixed(1)

      const originalName = state.compress.pdfFile.name.replace(/\.pdf$/i, '')
      const outputFilename = originalName + '_compressed.pdf'

      downloadBlob(new Blob([compressedBytes], { type: 'application/pdf' }), outputFilename, true)
      cleanupResources()
      trackEvent('file_downloaded', { function: 'compress', originalSize, compressedSize, ratio, level: compressLevel })

      showProgress(status, '完成！', 100)

      let msg
      if (compressedSize < originalSize) {
        msg = `压缩完成！${formatSize(originalSize)} → ${formatSize(compressedSize)}（减少 ${ratio}%）`
      } else {
        msg = `已优化。文件大小 ${formatSize(compressedSize)}（该文件已较紧凑，无法进一步压缩）`
      }
      const duration = performance.now() - startTime
      setTimeout(() => {
        showStatus(status, '✅ ' + msg, 'success')
        showReport(status, {
          fileName: state.compress.pdfFile.name,
          originalSize,
          processedSize: compressedSize,
          pageCount: state.compress.totalPages,
          duration,
          compressLevel,
        })
      }, 300)
    } catch (err) {
      showStatus(status, '❌ 压缩失败: ' + err.message, 'error')
    }
    compressBtn.disabled = false
  })
}

async function advancedCompress(pdfBytes, level, removeMetadata, status) {
  const dpiSettings = {
    light: 1.5,
    medium: 1.0,
    heavy: 0.7
  }
  
  const scale = dpiSettings[level] || 1.0
  
  const pdfDoc = await PDFLib.PDFDocument.load(pdfBytes)
  const pages = pdfDoc.getPages()
  const totalPages = pages.length
  
  showProgress(status, '正在重采样图像...', 40)
  
  const pdfjsDoc = await pdfjsLib.getDocument({ data: pdfBytes.slice() }).promise
  
  for (let i = 0; i < totalPages; i++) {
    const page = pages[i]
    const { width, height } = page.getSize()
    
    const pdfjsPage = await pdfjsDoc.getPage(i + 1)
    const viewport = pdfjsPage.getViewport({ scale })
    
    const canvas = document.createElement('canvas')
    canvas.width = viewport.width
    canvas.height = viewport.height
    
    const ctx = canvas.getContext('2d')
    await pdfjsPage.render({ canvasContext: ctx, viewport }).promise
    
    const quality = level === 'light' ? 0.8 : level === 'medium' ? 0.6 : 0.4
    const imageData = canvas.toDataURL('image/jpeg', quality)
    const imageBytes = Uint8Array.from(atob(imageData.split(',')[1]), c => c.charCodeAt(0))
    
    const embeddedImage = await pdfDoc.embedJpg(imageBytes)
    
    page.drawImage(embeddedImage, {
      x: 0,
      y: 0,
      width: width,
      height: height,
    })
    
    if (i % 5 === 0) {
      const progress = 40 + (i / totalPages) * 40
      showProgress(status, `正在处理页面 ${i + 1}/${totalPages}...`, progress)
    }
  }
  
  if (removeMetadata) {
    pdfDoc.setTitle('')
    pdfDoc.setAuthor('')
    pdfDoc.setSubject('')
    pdfDoc.setKeywords([])
    pdfDoc.setProducer('')
    pdfDoc.setCreator('')
  }
  
  return await pdfDoc.save({
    useObjectStreams: true,
    addDefaultPage: false,
    objectsPerTick: 50,
  })
}

