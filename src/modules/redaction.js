/**
 * redaction.js - PDF 隐私遮盖模块（纯视觉脱敏）
 * 用户在 PDF 预览上框选矩形区域 → pdf-lib 绘制不透明矩形块 → 输出遮盖后的 PDF
 * ⚠️ 法律免责：纯视觉遮盖 ≠ 底层文本删除，专业工具仍可提取被遮盖的文字
 */

import * as PDFLib from 'pdf-lib'
import * as pdfjsLib from 'pdfjs-dist'
import { state } from '../state.js'
import {
  formatSize, showStatus, showProgress, showProcessing, showReport,
  clearStatus, downloadBlob, MAX_FILE_SIZE, checkFileSize, trackEvent,
  showUploadFileInfo, resetUploadZone, cleanupResources, PDFJS_CDN_FALLBACK,
} from '../utils.js'

export function initRedaction() {
  const uploadZone = document.getElementById('redaction-upload')
  const fileInput = document.getElementById('redaction-file')
  const card = document.getElementById('redaction-card')
  const status = document.getElementById('redaction-status')

  // Info elements
  const filenameEl = document.getElementById('redaction-filename')
  const filesizeEl = document.getElementById('redaction-filesize')
  const pagesEl = document.getElementById('redaction-pages')

  // Preview canvas (for PDF.js rendering)
  const previewCanvas = document.getElementById('redaction-canvas')
  const canvasContainer = document.querySelector('#redaction-preview-container .pdf-canvas-container')

  // Page navigation
  const pageInfo = document.getElementById('redaction-page-info')
  const prevBtn = document.getElementById('redaction-prev')
  const nextBtn = document.getElementById('redaction-next')

  // Selection overlay canvas (interactive rectangle drawing)
  const overlayCanvas = document.getElementById('redaction-overlay-canvas')

  // Options
  const colorRadios = document.querySelectorAll('input[name="redaction-color"]')
  const borderRadiusInput = document.getElementById('redaction-border-radius')
  const borderRadiusVal = document.getElementById('redaction-border-radius-val')

  // Buttons
  const clearSelectionsBtn = document.getElementById('redaction-clear-selections')
  const applyBtn = document.getElementById('redaction-apply-btn')
  const closeBtn = document.getElementById('redaction-close')

  // Internal state
  // redactionsByPage[pageNum] = [{xPct, yPct, wPct, hPct}]
  let redactionsByPage = {}
  let currentPage = 1
  let totalPages = 1
  let isDrawing = false
  let drawStart = null

  // ============================================================
  // Upload handlers
  // ============================================================
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
      loadPDF(file)
    }
  })
  fileInput.addEventListener('change', () => {
    if (fileInput.files[0]) loadPDF(fileInput.files[0])
  })

  // ============================================================
  // Load PDF
  // ============================================================
  async function loadPDF(file) {
    if (!checkFileSize(file, status)) return

    try {
      showProgress(status, '正在加载 PDF...', 20)

      const bytes = await file.arrayBuffer()
      const data = new Uint8Array(bytes)

      // Check encryption
      try {
        await PDFLib.PDFDocument.load(data, { ignoreEncryption: false })
      } catch (encErr) {
        if (encErr.message.includes('encrypted') || encErr.message.includes('password')) {
          showStatus(status, '❌ 该 PDF 文件已加密，无法处理', 'error')
          return
        }
      }

      // Load with PDF.js for preview
      let pdfDoc
      try {
        pdfDoc = await pdfjsLib.getDocument({ data: data.slice() }).promise
      } catch (err) {
        if (err.message.includes('worker') || err.message.includes('NetworkError')) {
          pdfjsLib.GlobalWorkerOptions.workerSrc = PDFJS_CDN_FALLBACK
          pdfDoc = await pdfjsLib.getDocument({ data: data.slice() }).promise
        } else {
          throw err
        }
      }

      state.redaction.pdfDoc = pdfDoc
      state.redaction.pdfBytes = data
      state.redaction.file = file
      totalPages = pdfDoc.numPages
      currentPage = 1
      redactionsByPage = {}
      trackEvent('file_uploaded', { function: 'redaction', name: file.name, size: file.size, pages: totalPages })

      // Display info
      filenameEl.textContent = file.name
      filesizeEl.textContent = formatSize(file.size)
      pagesEl.textContent = `${totalPages} 页`

      await renderPage()
      showUploadFileInfo(uploadZone, file)
      card.style.display = 'block'
      clearStatus(status)
    } catch (err) {
      showStatus(status, '❌ 无法加载 PDF: ' + err.message, 'error')
    }
  }

  // ============================================================
  // Render current page
  // ============================================================
  async function renderPage() {
    const s = state.redaction
    if (!s.pdfDoc) return

    try {
      const page = await s.pdfDoc.getPage(currentPage)
      const viewport = page.getViewport({ scale: 1.0 })

      // Fit canvas to container width
      const containerWidth = canvasContainer ? canvasContainer.clientWidth : 600
      const fitScale = containerWidth / viewport.width
      const scaledViewport = page.getViewport({ scale: fitScale })

      // Render PDF page to offscreen canvas
      const offscreen = document.createElement('canvas')
      offscreen.width = Math.round(scaledViewport.width)
      offscreen.height = Math.round(scaledViewport.height)
      const ctx = offscreen.getContext('2d')
      await page.render({ canvasContext: ctx, viewport: scaledViewport }).promise

      // Copy to visible canvas
      previewCanvas.width = offscreen.width
      previewCanvas.height = offscreen.height
      const visibleCtx = previewCanvas.getContext('2d')
      visibleCtx.drawImage(offscreen, 0, 0)

      // Resize overlay canvas to match
      overlayCanvas.width = offscreen.width
      overlayCanvas.height = offscreen.height
      drawOverlay()

      // Page info
      pageInfo.textContent = `${currentPage} / ${totalPages}`
      prevBtn.disabled = currentPage <= 1
      nextBtn.disabled = currentPage >= totalPages

      clearStatus(status)
    } catch (err) {
      showStatus(status, '⚠️ 渲染失败: ' + err.message, 'warning')
    }
  }

  // ============================================================
  // Draw redaction overlays on current page
  // ============================================================
  function drawOverlay() {
    const ctx = overlayCanvas.getContext('2d')
    ctx.clearRect(0, 0, overlayCanvas.width, overlayCanvas.height)

    const rects = redactionsByPage[currentPage] || []
    const color = getRedactionColor()

    for (const r of rects) {
      const x = r.xPct * overlayCanvas.width
      const y = r.yPct * overlayCanvas.height
      const w = r.wPct * overlayCanvas.width
      const h = r.hPct * overlayCanvas.height
      const radius = Number(borderRadiusInput.value)

      ctx.fillStyle = color
      ctx.beginPath()
      roundRect(ctx, x, y, w, h, radius)
      ctx.fill()

      // Semi-transparent border for visibility
      ctx.strokeStyle = 'rgba(255,255,255,0.3)'
      ctx.lineWidth = 1
      ctx.beginPath()
      roundRect(ctx, x, y, w, h, radius)
      ctx.stroke()
    }
  }

  function roundRect(ctx, x, y, w, h, r) {
    r = Math.min(r, Math.min(w, h) / 2)
    ctx.moveTo(x + r, y)
    ctx.lineTo(x + w - r, y)
    ctx.quadraticCurveTo(x + w, y, x + w, y + r)
    ctx.lineTo(x + w, y + h - r)
    ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h)
    ctx.lineTo(x + r, y + h)
    ctx.quadraticCurveTo(x, y + h, x, y + h - r)
    ctx.lineTo(x, y + r)
    ctx.quadraticCurveTo(x, y, x + r, y)
    ctx.closePath()
  }

  function getRedactionColor() {
    const checked = document.querySelector('input[name="redaction-color"]:checked')
    return checked ? checked.value : '#000000'
  }

  // ============================================================
  // Canvas interaction — drag to draw rectangles
  // ============================================================
  function getCanvasPos(e) {
    const rect = overlayCanvas.getBoundingClientRect()
    const scaleX = overlayCanvas.width / rect.width
    const scaleY = overlayCanvas.height / rect.height
    const clientX = e.touches ? e.touches[0].clientX : e.clientX
    const clientY = e.touches ? e.touches[0].clientY : e.clientY
    return {
      x: (clientX - rect.left) * scaleX,
      y: (clientY - rect.top) * scaleY
    }
  }

  overlayCanvas.addEventListener('mousedown', startDraw)
  overlayCanvas.addEventListener('touchstart', startDraw, { passive: false })
  overlayCanvas.addEventListener('mousemove', moveDraw)
  overlayCanvas.addEventListener('touchmove', moveDraw, { passive: false })
  overlayCanvas.addEventListener('mouseup', endDraw)
  overlayCanvas.addEventListener('touchend', endDraw)

  function startDraw(e) {
    e.preventDefault()
    isDrawing = true
    drawStart = getCanvasPos(e)
  }

  function moveDraw(e) {
    if (!isDrawing || !drawStart) return
    e.preventDefault()
    const pos = getCanvasPos(e)

    // Temporarily draw the in-progress rectangle
    const ctx = overlayCanvas.getContext('2d')
    drawOverlay() // clear and redraw existing rects

    const x = Math.min(drawStart.x, pos.x)
    const y = Math.min(drawStart.y, pos.y)
    const w = Math.abs(pos.x - drawStart.x)
    const h = Math.abs(pos.y - drawStart.y)

    if (w > 2 && h > 2) {
      ctx.fillStyle = getRedactionColor()
      ctx.globalAlpha = 0.5
      ctx.fillRect(x, y, w, h)
      ctx.globalAlpha = 1
    }
  }

  function endDraw(e) {
    if (!isDrawing || !drawStart) return
    isDrawing = false

    const pos = e.changedTouches ? getCanvasTouchEvent(e) : getCanvasPos(e)
    const x = Math.min(drawStart.x, pos.x)
    const y = Math.min(drawStart.y, pos.y)
    const w = Math.abs(pos.x - drawStart.x)
    const h = Math.abs(pos.y - drawStart.y)

    // Only register if large enough
    if (w > 10 && h > 10) {
      const xPct = x / overlayCanvas.width
      const yPct = y / overlayCanvas.height
      const wPct = w / overlayCanvas.width
      const hPct = h / overlayCanvas.height

      if (!redactionsByPage[currentPage]) {
        redactionsByPage[currentPage] = []
      }
      redactionsByPage[currentPage].push({ xPct, yPct, wPct, hPct })
    }

    drawStart = null
    drawOverlay()
    updateApplyButton()
  }

  function getCanvasTouchEvent(e) {
    const rect = overlayCanvas.getBoundingClientRect()
    const scaleX = overlayCanvas.width / rect.width
    const scaleY = overlayCanvas.height / rect.height
    const touch = e.changedTouches[0]
    return {
      x: (touch.clientX - rect.left) * scaleX,
      y: (touch.clientY - rect.top) * scaleY
    }
  }

  // ============================================================
  // Page navigation
  // ============================================================
  prevBtn.addEventListener('click', () => {
    if (currentPage > 1) {
      currentPage--
      renderPage()
    }
  })

  nextBtn.addEventListener('click', () => {
    if (currentPage < totalPages) {
      currentPage++
      renderPage()
    }
  })

  // ============================================================
  // Border radius display
  // ============================================================
  borderRadiusInput.addEventListener('input', () => {
    borderRadiusVal.textContent = borderRadiusInput.value + 'px'
    drawOverlay()
  })

  // Color change triggers re-render
  colorRadios.forEach(radio => {
    radio.addEventListener('change', () => drawOverlay())
  })

  // ============================================================
  // Clear selections
  // ============================================================
  clearSelectionsBtn.addEventListener('click', () => {
    redactionsByPage[currentPage] = []
    drawOverlay()
    updateApplyButton()
  })

  // ============================================================
  // Update apply button state
  // ============================================================
  function updateApplyButton() {
    const hasAny = Object.values(redactionsByPage).some(arr => arr.length > 0)
    applyBtn.disabled = !hasAny
  }

  // ============================================================
  // Apply redaction and download
  // ============================================================
  applyBtn.addEventListener('click', async () => {
    const s = state.redaction
    if (!s.pdfBytes) return

    const hasAny = Object.values(redactionsByPage).some(arr => arr.length > 0)
    if (!hasAny) return

    try {
      applyBtn.disabled = true
      showProcessing(status, '正在应用遮盖...', 20)
      const startTime = performance.now()

      const pdfDoc = await PDFLib.PDFDocument.load(s.pdfBytes)
      const pages = pdfDoc.getPages()

      const color = getRedactionColor()
      const radius = Number(borderRadiusInput.value)

      // Parse color hex to 0-1 RGB
      const rgb = hexToRgb01(color)

      // Apply redactions page by page
      for (const [pageNumStr, rects] of Object.entries(redactionsByPage)) {
        const pageNum = parseInt(pageNumStr, 10)
        if (pageNum < 1 || pageNum > pages.length) continue
        if (rects.length === 0) continue

        const page = pages[pageNum - 1]
        const { width, height } = page.getSize()

        for (const r of rects) {
          // Convert percentage to PDF points
          // PDF.js and pdf-lib both use bottom-left origin
          // But our canvas uses top-left origin, so we need to flip Y
          const x = r.xPct * width
          const pdfY = height - (r.yPct + r.hPct) * height // flip Y
          const w = r.wPct * width
          const h = r.hPct * height

          page.drawRectangle({
            x,
            y: pdfY,
            width: w,
            height: h,
            color: PDFLib.rgb(rgb.r, rgb.g, rgb.b),
            opacity: 1,
            borderWidth: 0,
            borderRadius: radius,
          })
        }
      }

      showProcessing(status, '正在生成文件...', 80)
      const redactedBytes = await pdfDoc.save()
      const baseName = s.file.name.replace(/\.pdf$/i, '')
      const outputFilename = `${baseName}_redacted.pdf`

      downloadBlob(new Blob([redactedBytes], { type: 'application/pdf' }), outputFilename, true)
      cleanupResources()
      trackEvent('file_downloaded', { function: 'redaction', pages: pages.length, size: redactedBytes.length })

      showProgress(status, '完成！', 100)
      const duration = performance.now() - startTime
      setTimeout(() => {
        showStatus(status, `✅ 遮盖完成！共 ${pages.length} 页，${formatSize(redactedBytes.length)}，已下载`, 'success')
        showReport(status, {
          fileName: s.file.name,
          originalSize: s.file.size,
          processedSize: redactedBytes.length,
          pageCount: pages.length,
          duration,
        })
      }, 300)

      // Update state with new bytes
      s.pdfBytes = redactedBytes
    } catch (err) {
      showStatus(status, '❌ 遮盖失败: ' + err.message, 'error')
    } finally {
      applyBtn.disabled = false
    }
  })

  // Helper: hex to 0-1 RGB
  function hexToRgb01(hex) {
    const r = parseInt(hex.slice(1, 3), 16) / 255
    const g = parseInt(hex.slice(3, 5), 16) / 255
    const b = parseInt(hex.slice(5, 7), 16) / 255
    return { r, g, b }
  }

  // ============================================================
  // Close
  // ============================================================
  closeBtn.addEventListener('click', () => {
    state.redaction.pdfDoc = null
    state.redaction.pdfBytes = null
    state.redaction.file = null
    redactionsByPage = {}
    currentPage = 1
    totalPages = 1
    card.style.display = 'none'
    resetUploadZone(uploadZone)
    previewCanvas.width = 0
    previewCanvas.height = 0
    overlayCanvas.width = 0
    overlayCanvas.height = 0
    fileInput.value = ''
    clearStatus(status)
    cleanupResources()
  })

  // ============================================================
  // Window resize
  // ============================================================
  let resizeTimer
  window.addEventListener('resize', () => {
    clearTimeout(resizeTimer)
    resizeTimer = setTimeout(() => {
      if (state.redaction.pdfDoc) {
        renderPage()
      }
    }, 200)
  })
}
