/**
 * view.js - PDF 查看模块
 * 修复：保持 PDF 原始宽高比，正确适配窗口大小，支持缩放
 */

import * as pdfjsLib from 'pdfjs-dist'
import { state } from '../state.js'
import { renderPageResponsive, downloadBlob, showStatus, clearStatus, PDFJS_CDN_FALLBACK, trackEvent, showUploadFileInfo, resetUploadZone } from '../utils.js'

export function initView() {
  const uploadZone = document.getElementById('view-upload')
  const fileInput = document.getElementById('view-file')
  const card = document.getElementById('view-card')
  const canvas = document.getElementById('view-canvas')
  const canvasContainer = document.querySelector('.pdf-canvas-container')
  const pageInfo = document.getElementById('view-page-info')
  const prevBtn = document.getElementById('view-prev')
  const nextBtn = document.getElementById('view-next')
  const downloadBtn = document.getElementById('view-download')
  const closeBtn = document.getElementById('view-close')
  const zoomInBtn = document.getElementById('view-zoom-in')
  const zoomOutBtn = document.getElementById('view-zoom-out')
  const zoomLevel = document.getElementById('view-zoom-level')

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
    if (file && file.type === 'application/pdf') loadViewPDF(file)
  })
  fileInput.addEventListener('change', () => {
    if (fileInput.files[0]) loadViewPDF(fileInput.files[0])
  })

  async function loadViewPDF(file) {
    try {
      const bytes = await file.arrayBuffer()
      state.view.pdfBytes = new Uint8Array(bytes)
      state.view.pdfDoc = await loadPDFWithFallback(state.view.pdfBytes.slice())
      state.view.currentPage = 1
      state.view.totalPages = state.view.pdfDoc.numPages
      state.view.scale = 1 // 1 = 100% fit to container
      // 追踪：文件上传
      trackEvent('file_uploaded', { function: 'view', name: file.name, size: file.size, pages: state.view.totalPages })
      // Show file info in upload zone instead of hiding it
      showUploadFileInfo(uploadZone, file)
      card.style.display = 'block'
      renderCurrentPage()
    } catch (err) {
      showStatus(uploadZone, '❌ 无法加载 PDF: ' + err.message, 'error')
    }
  }

  // 加载 PDF，主 CDN worker 失败时自动切换备用 CDN
  async function loadPDFWithFallback(data) {
    try {
      return await pdfjsLib.getDocument({ data: data.slice() }).promise
    } catch (err) {
      // 如果 worker 加载失败，切换到备用 CDN 并重试
      if (pdfjsLib.GlobalWorkerOptions.workerSrc &&
          pdfjsLib.GlobalWorkerOptions.workerSrc.includes('cdnjs') &&
          (err.message.includes('worker') || err.message.includes('NetworkError'))) {
        pdfjsLib.GlobalWorkerOptions.workerSrc = PDFJS_CDN_FALLBACK
        return await pdfjsLib.getDocument({ data: data.slice() }).promise
      }
      throw err
    }
  }

  async function renderCurrentPage() {
    const s = state.view
    if (!s.pdfDoc) return
    pageInfo.textContent = `${s.currentPage} / ${s.totalPages}`
    prevBtn.disabled = s.currentPage <= 1
    nextBtn.disabled = s.currentPage >= s.totalPages
    await renderPageResponsive(s.pdfDoc, s.currentPage, canvas, canvasContainer, s.scale)
    updateZoomDisplay()
  }

  function updateZoomDisplay() {
    const pct = Math.round(state.view.scale * 100)
    if (zoomLevel) zoomLevel.textContent = `${pct}%`
  }

  prevBtn.addEventListener('click', () => {
    if (state.view.currentPage > 1) {
      state.view.currentPage--
      renderCurrentPage()
    }
  })

  nextBtn.addEventListener('click', () => {
    if (state.view.currentPage < state.view.totalPages) {
      state.view.currentPage++
      renderCurrentPage()
    }
  })

  zoomInBtn.addEventListener('click', () => {
    state.view.scale = Math.min(state.view.scale + 0.25, 4)
    renderCurrentPage()
  })

  zoomOutBtn.addEventListener('click', () => {
    state.view.scale = Math.max(state.view.scale - 0.25, 0.25)
    renderCurrentPage()
  })

  downloadBtn.addEventListener('click', () => {
    if (state.view.pdfBytes) {
      downloadBlob(new Blob([state.view.pdfBytes], { type: 'application/pdf' }), 'document.pdf')
      // 追踪：文件下载
      trackEvent('file_downloaded', { function: 'view', size: state.view.pdfBytes.length })
    }
  })

  closeBtn.addEventListener('click', () => {
    state.view.pdfDoc = null
    state.view.pdfBytes = null
    state.view.scale = 1
    card.style.display = 'none'
    resetUploadZone(uploadZone)
    fileInput.value = ''
  })

  // Window resize: re-render to fit new container size
  let resizeTimer
  window.addEventListener('resize', () => {
    clearTimeout(resizeTimer)
    resizeTimer = setTimeout(() => {
      if (state.view.pdfDoc && state.view.pdfDoc.numPages > 0) {
        renderCurrentPage()
      }
    }, 200)
  })
}
