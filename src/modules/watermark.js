/**
 * watermark.js - PDF 水印模块
 * 支持文字水印和图片水印，居中和平铺两种模式
 * 文字水印支持自定义字体（用于中文等 CJK 字符）
 */

import * as PDFLib from 'pdf-lib'
import * as pdfjsLib from 'pdfjs-dist'
import { state } from '../state.js'
import { formatSize, showStatus, showProgress, showProcessing, showReport, clearStatus, downloadBlob, MAX_FILE_SIZE, checkFileSize, hexToRgb01, PDFJS_CDN_FALLBACK, trackEvent, showUploadFileInfo, resetUploadZone, cleanupResources } from '../utils.js'

export function initWatermark() {
  const uploadZone = document.getElementById('watermark-upload')
  const fileInput = document.getElementById('watermark-file')
  const card = document.getElementById('watermark-card')
  const status = document.getElementById('watermark-status')

  // Info elements
  const filenameEl = document.getElementById('watermark-filename')
  const filesizeEl = document.getElementById('watermark-filesize')
  const pagesEl = document.getElementById('watermark-pages')

  // Preview
  const previewCanvas = document.getElementById('watermark-canvas')

  // Watermark type toggle
  const typeRadios = document.querySelectorAll('input[name="wm-type"]')
  const textOptions = document.getElementById('wm-text-options')
  const imageOptions = document.getElementById('wm-image-options')

  // Text watermark elements
  const wmText = document.getElementById('wm-text')
  const wmFontsize = document.getElementById('wm-fontsize')
  const wmFontsizeVal = document.getElementById('wm-fontsize-val')
  const wmRotation = document.getElementById('wm-rotation')
  const wmRotationVal = document.getElementById('wm-rotation-val')
  const wmColor = document.getElementById('wm-color')
  const wmOpacity = document.getElementById('wm-opacity')
  const wmOpacityVal = document.getElementById('wm-opacity-val')
  const wmFontUpload = document.getElementById('wm-font-upload')

  // Image watermark elements
  const wmImageUpload = document.getElementById('wm-image-upload')
  const wmImageFile = document.getElementById('wm-image-file')
  const wmImageInfo = document.getElementById('wm-image-info')
  const wmImageName = document.getElementById('wm-image-name')
  const wmImageScale = document.getElementById('wm-image-scale')
  const wmImageScaleVal = document.getElementById('wm-image-scale-val')
  const wmImageOpacity = document.getElementById('wm-image-opacity')
  const wmImageOpacityVal = document.getElementById('wm-image-opacity-val')

  // Position
  const positionRadios = document.querySelectorAll('input[name="wm-position"]')

  // Buttons
  const previewBtn = document.getElementById('wm-preview-btn')

  // Debounced preview re-render — avoids flashing when user drags sliders
  let previewDebounceTimer = null
  function schedulePreviewUpdate() {
    clearTimeout(previewDebounceTimer)
    previewDebounceTimer = setTimeout(() => renderPreview(), 200)
  }
  const applyBtn = document.getElementById('wm-apply-btn')
  const closeBtn = document.getElementById('wm-close')

  // Upload handlers
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
      loadWatermarkFile(file)
    }
  })
  fileInput.addEventListener('change', () => {
    if (fileInput.files[0]) loadWatermarkFile(fileInput.files[0])
  })

  // Type toggle
  typeRadios.forEach(radio => {
    radio.addEventListener('change', () => {
      const isText = radio.value === 'text'
      textOptions.style.display = isText ? '' : 'none'
      imageOptions.style.display = isText ? 'none' : ''
      // Reset image upload state when switching back
      if (isText && state.watermark.watermarkImage) {
        state.watermark.watermarkImage = null
        wmImageInfo.style.display = 'none'
        wmImageUpload.style.display = ''
        wmImageFile.value = ''
      }
      // Refresh preview when switching between text/image watermark
      schedulePreviewUpdate()
    })
  })

  // Range value updates + real-time preview
  wmFontsize.addEventListener('input', () => { wmFontsizeVal.textContent = wmFontsize.value; schedulePreviewUpdate() })
  wmRotation.addEventListener('input', () => { wmRotationVal.textContent = wmRotation.value + '°'; schedulePreviewUpdate() })
  wmOpacity.addEventListener('input', () => { wmOpacityVal.textContent = wmOpacity.value + '%'; schedulePreviewUpdate() })
  wmImageScale.addEventListener('input', () => { wmImageScaleVal.textContent = wmImageScale.value + '%'; schedulePreviewUpdate() })
  wmImageOpacity.addEventListener('input', () => { wmImageOpacityVal.textContent = wmImageOpacity.value + '%'; schedulePreviewUpdate() })

  // Text watermark: text content + color also trigger preview
  wmText.addEventListener('input', () => schedulePreviewUpdate())
  wmColor.addEventListener('input', () => schedulePreviewUpdate())

  // Position radio buttons trigger preview when changed
  positionRadios.forEach(radio => {
    radio.addEventListener('change', () => schedulePreviewUpdate())
  })

  // Image watermark upload
  wmImageUpload.addEventListener('click', () => wmImageFile.click())
  wmImageUpload.addEventListener('dragover', e => {
    e.preventDefault()
    wmImageUpload.classList.add('dragover')
  })
  wmImageUpload.addEventListener('dragleave', () => wmImageUpload.classList.remove('dragover'))
  wmImageUpload.addEventListener('drop', e => {
    e.preventDefault()
    wmImageUpload.classList.remove('dragover')
    const file = e.dataTransfer.files[0]
    if (file && file.type.startsWith('image/')) loadWatermarkImage(file)
  })
  wmImageFile.addEventListener('change', () => {
    if (wmImageFile.files[0]) loadWatermarkImage(wmImageFile.files[0])
  })

  async function loadWatermarkImage(file) {
    if (file.size > 5 * 1024 * 1024) {
      showStatus(status, '⚠️ 水印图片过大，建议不超过 5MB', 'warning')
      return
    }
    try {
      const bytes = await file.arrayBuffer()
      state.watermark.watermarkImage = new Uint8Array(bytes)
      state.watermark.watermarkImageName = file.name
      state.watermark.watermarkImageType = file.name.toLowerCase().endsWith('.png') ? 'png' : 'jpg'
      wmImageName.textContent = file.name
      wmImageInfo.style.display = ''
      wmImageUpload.style.display = 'none'
      clearStatus(status)
      schedulePreviewUpdate()
    } catch (err) {
      showStatus(status, '❌ 无法加载图片: ' + err.message, 'error')
    }
  }

  // Font upload handler
  wmFontUpload.addEventListener('change', async () => {
    const file = wmFontUpload.files[0]
    if (!file) return
    try {
      showProgress(status, '正在加载字体...', 50)
      const bytes = await file.arrayBuffer()
      state.watermark.customFont = new Uint8Array(bytes)
      clearStatus(status)
      showStatus(status, `✅ 字体已加载：${file.name}`, 'success')
      schedulePreviewUpdate()
    } catch (err) {
      showStatus(status, '❌ 字体加载失败: ' + err.message, 'error')
    }
  })

  async function loadWatermarkFile(file) {
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
          showStatus(status, '❌ 该 PDF 文件已加密，无法添加水印', 'error')
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

      state.watermark.pdfDoc = pdfDoc
      state.watermark.pdfBytes = data
      state.watermark.file = file
      state.watermark.totalPages = pdfDoc.numPages
      // 追踪：文件上传
      trackEvent('file_uploaded', { function: 'watermark', name: file.name, size: file.size, pages: pdfDoc.numPages })

      // Display info
      filenameEl.textContent = file.name
      filesizeEl.textContent = formatSize(file.size)
      pagesEl.textContent = `${pdfDoc.numPages} 页`

      // Show preview of first page
      await renderPreview()

      // Show file info in upload zone instead of hiding it
      showUploadFileInfo(uploadZone, file)
      card.style.display = 'block'
      applyBtn.disabled = false
      clearStatus(status)
    } catch (err) {
      showStatus(status, '❌ 无法加载 PDF: ' + err.message, 'error')
    }
  }

  async function renderPreview() {
    const s = state.watermark
    if (!s.pdfDoc) return

    try {
      showProgress(status, '正在渲染预览...', 50)

      const page = await s.pdfDoc.getPage(1)
      const viewport = page.getViewport({ scale: 0.6 })

      // Render base page to offscreen canvas
      const offscreen = document.createElement('canvas')
      offscreen.width = Math.round(viewport.width)
      offscreen.height = Math.round(viewport.height)
      const ctx = offscreen.getContext('2d')
      await page.render({ canvasContext: ctx, viewport }).promise

      // Draw watermark overlay on top
      await drawWatermarkOverlay(ctx, viewport.width, viewport.height, viewport)

      // Copy to visible canvas
      previewCanvas.width = offscreen.width
      previewCanvas.height = offscreen.height
      const visibleCtx = previewCanvas.getContext('2d')
      visibleCtx.drawImage(offscreen, 0, 0)

      clearStatus(status)
    } catch (err) {
      showStatus(status, '⚠️ 预览失败: ' + err.message, 'warning')
    }
  }

  /**
   * Draw watermark overlay on a 2D canvas context (for preview)
   * Uses canvas API to render text/image with the same parameters as pdf-lib will use
   */
  async function drawWatermarkOverlay(ctx, canvasWidth, canvasHeight, viewport) {
    const wmType = document.querySelector('input[name="wm-type"]:checked').value
    const position = document.querySelector('input[name="wm-position"]:checked').value

    if (wmType === 'text') {
      const text = wmText.value.trim() || 'DRAFT'
      const fontSize = Number(wmFontsize.value)
      const rotation = Number(wmRotation.value)
      const color = wmColor.value
      const opacity = Number(wmOpacity.value) / 100
      const hasCustomFont = !!state.watermark.customFont

      // Scale font size from PDF points to canvas pixels
      // pdf-lib uses 72 points per inch; viewport scale maps PDF coords to pixels
      const scale = viewport.scale
      const canvasFontSize = fontSize * scale * (72 / 96) // approximate conversion

      const rgb = hexToRgb01(color)

      ctx.save()
      ctx.globalAlpha = opacity

      // For preview, use canvas text rendering (browser handles CJK natively)
      if (hasCustomFont) {
        // When custom font is loaded, we can't render it on canvas easily
        // Just use a fallback font for preview - the actual PDF will use the custom font
        ctx.font = `${canvasFontSize}px sans-serif`
      } else {
        ctx.font = `${canvasFontSize}px Helvetica, Arial, sans-serif`
      }

      ctx.fillStyle = `rgb(${Math.round(rgb.r * 255)}, ${Math.round(rgb.g * 255)}, ${Math.round(rgb.b * 255)})`
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'

      if (position === 'center') {
        ctx.translate(canvasWidth / 2, canvasHeight / 2)
        ctx.rotate(rotation * Math.PI / 180)
        ctx.fillText(text, 0, 0)
      } else {
        // Tile mode
        const textWidth = ctx.measureText(text).width
        const spacingX = textWidth + canvasWidth * 0.15
        const spacingY = canvasFontSize * 2.5

        for (let y = -canvasHeight; y < canvasHeight * 2; y += spacingY) {
          for (let x = -canvasWidth; x < canvasWidth * 2; x += spacingX) {
            ctx.save()
            ctx.translate(x, y)
            ctx.rotate(rotation * Math.PI / 180)
            ctx.fillText(text, 0, 0)
            ctx.restore()
          }
        }
      }

      ctx.restore()
    } else {
      // Image watermark
      const imageData = state.watermark.watermarkImage
      if (!imageData) return

      const scalePct = Number(wmImageScale.value) / 100
      const opacity = Number(wmImageOpacity.value) / 100

      const imgBitmap = await createImageBitmap(new Blob([imageData]))
      const imgAspect = imgBitmap.width / imgBitmap.height

      // Size the watermark relative to page width
      const wmWidth = canvasWidth * scalePct
      const wmHeight = wmWidth / imgAspect

      ctx.save()
      ctx.globalAlpha = opacity

      if (position === 'center') {
        ctx.drawImage(imgBitmap, (canvasWidth - wmWidth) / 2, (canvasHeight - wmHeight) / 2, wmWidth, wmHeight)
      } else {
        // Tile mode
        const spacingX = wmWidth * 1.8
        const spacingY = wmHeight * 1.8
        for (let y = -wmHeight; y < canvasHeight + wmHeight; y += spacingY) {
          for (let x = -wmWidth; x < canvasWidth + wmWidth; x += spacingX) {
            ctx.drawImage(imgBitmap, x, y, wmWidth, wmHeight)
          }
        }
      }

      ctx.restore()
    }
  }

  // Preview button
  previewBtn.addEventListener('click', async () => {
    await renderPreview()
  })

  // Apply watermark and download
  applyBtn.addEventListener('click', async () => {
    if (!state.watermark.pdfBytes) return
    try {
      applyBtn.disabled = true
      showProcessing(status, '正在添加水印...', 20)
      const startTime = performance.now()

      const wmType = document.querySelector('input[name="wm-type"]:checked').value
      const position = document.querySelector('input[name="wm-position"]:checked').value

      const pdfDoc = await PDFLib.PDFDocument.load(state.watermark.pdfBytes)
      const pages = pdfDoc.getPages()

      let font = null
      let fontSize = Number(wmFontsize.value)
      let rotation = Number(wmRotation.value)
      let color = wmColor.value
      let opacity = Number(wmOpacity.value) / 100

      // Handle text watermark
      if (wmType === 'text') {
        const text = wmText.value.trim() || 'DRAFT'
        const rgb = hexToRgb01(color)

        // Try to load custom font for CJK support
        if (state.watermark.customFont) {
          try {
            font = await pdfDoc.embedFont(state.watermark.customFont, { subset: true })
          } catch (fontErr) {
            console.warn('Custom font embedding failed, falling back to Helvetica:', fontErr)
            font = pdfDoc.standardFonts.embed(PDFLib.StandardFonts.Helvetica)
          }
        } else {
          // Check for CJK characters
          const hasCJK = /[\u4e00-\u9fff\u3040-\u309f\u30a0-\u30ff\uac00-\ud7af]/.test(text)
          if (hasCJK) {
            showStatus(status, '⚠️ 检测到中文字符，建议上传中文字体文件（.ttf）以确保正常显示', 'warning')
          }
          font = pdfDoc.embedFont(PDFLib.StandardFonts.Helvetica)
        }

        for (const page of pages) {
          const { width, height } = page.getSize()

          if (position === 'center') {
            const textWidth = font.widthOfTextAtSize(text, fontSize)
            const x = (width - textWidth) / 2
            const y = (height - fontSize) / 2

            page.drawText(text, {
              x,
              y,
              size: fontSize,
              font,
              color: PDFLib.rgb(rgb.r, rgb.g, rgb.b),
              opacity,
              rotate: PDFLib.degrees(rotation),
            })
          } else {
            // Tile mode
            const textWidth = font.widthOfTextAtSize(text, fontSize)
            const spacingX = textWidth + width * 0.12
            const spacingY = fontSize * 3

            for (let y = -height; y < height * 2; y += spacingY) {
              for (let x = -width; x < width * 2; x += spacingX) {
                page.drawText(text, {
                  x,
                  y,
                  size: fontSize,
                  font,
                  color: PDFLib.rgb(rgb.r, rgb.g, rgb.b),
                  opacity,
                  rotate: PDFLib.degrees(rotation),
                })
              }
            }
          }
        }
      } else {
        // Image watermark
        if (!state.watermark.watermarkImage) {
          showStatus(status, '❌ 请先上传水印图片', 'error')
          applyBtn.disabled = false
          return
        }

        const imageBytes = state.watermark.watermarkImage
        const imageType = state.watermark.watermarkImageType || 'png'
        const scalePct = Number(wmImageScale.value) / 100
        const imageOpacity = Number(wmImageOpacity.value) / 100

        let embeddedImage
        if (imageType === 'png') {
          embeddedImage = await pdfDoc.embedPng(imageBytes)
        } else {
          embeddedImage = await pdfDoc.embedJpg(imageBytes)
        }

        const imgWidth = embeddedImage.width
        const imgHeight = embeddedImage.height
        const imgAspect = imgWidth / imgHeight

        for (const page of pages) {
          const { width, height } = page.getSize()
          const wmWidth = width * scalePct
          const wmHeight = wmWidth / imgAspect

          if (position === 'center') {
            page.drawImage(embeddedImage, {
              x: (width - wmWidth) / 2,
              y: (height - wmHeight) / 2,
              width: wmWidth,
              height: wmHeight,
              opacity: imageOpacity,
            })
          } else {
            // Tile mode
            const spacingX = wmWidth * 1.8
            const spacingY = wmHeight * 1.8
            for (let y = -wmHeight; y < height + wmHeight; y += spacingY) {
              for (let x = -wmWidth; x < width + wmWidth; x += spacingX) {
                page.drawImage(embeddedImage, {
                  x,
                  y,
                  width: wmWidth,
                  height: wmHeight,
                  opacity: imageOpacity,
                })
              }
            }
          }
        }
      }

      showProcessing(status, '正在生成文件...', 80)
      // Save and download
      const watermarkedBytes = await pdfDoc.save()
      const baseName = state.watermark.file.name.replace(/\.pdf$/i, '')
      const outputFilename = `${baseName}_watermarked.pdf`

      downloadBlob(new Blob([watermarkedBytes], { type: 'application/pdf' }), outputFilename, true)
      cleanupResources()
      // 追踪：文件下载
      trackEvent('file_downloaded', { function: 'watermark', pages: pages.length, size: watermarkedBytes.length, type: wmType, position })

      showProgress(status, '完成！', 100)
      const duration = performance.now() - startTime
      setTimeout(() => {
        showStatus(status, `✅ 水印已添加！共 ${pages.length} 页，${formatSize(watermarkedBytes.length)}，已下载`, 'success')
        showReport(status, {
          fileName: state.watermark.file.name,
          originalSize: state.watermark.file.size,
          processedSize: watermarkedBytes.length,
          pageCount: pages.length,
          duration,
        })
      }, 300)

      // Refresh preview
      state.watermark.pdfBytes = watermarkedBytes
      await renderPreview()
    } catch (err) {
      showStatus(status, '❌ 添加水印失败: ' + err.message, 'error')
    } finally {
      applyBtn.disabled = false
    }
  })

  // Close button
  closeBtn.addEventListener('click', () => {
    state.watermark.pdfDoc = null
    state.watermark.pdfBytes = null
    state.watermark.file = null
    state.watermark.totalPages = 0
    state.watermark.customFont = null
    state.watermark.watermarkImage = null
    state.watermark.watermarkImageName = null
    state.watermark.watermarkImageType = null
    card.style.display = 'none'
    resetUploadZone(uploadZone)
    previewCanvas.width = 0
    previewCanvas.height = 0
    fileInput.value = ''
    wmImageInfo.style.display = 'none'
    wmImageUpload.style.display = ''
    wmImageFile.value = ''
    wmFontUpload.value = ''
    clearStatus(status)
    cleanupResources()
  })
}
