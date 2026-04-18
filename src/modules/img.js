/**
 * img.js - PDF 转图片模块
 * 使用 PDF.js 渲染页面到 Canvas，导出为 PNG/JPG
 */

import * as pdfjsLib from 'pdfjs-dist'
import { state } from '../state.js'
import { formatSize, showStatus, showProgress, showProcessing, showReport, clearStatus, downloadBlob, parsePageRange, MAX_FILE_SIZE, checkFileSize, PDFJS_CDN_FALLBACK, trackEvent, showUploadFileInfo, resetUploadZone, cleanupResources } from '../utils.js'
import JSZip from 'jszip'

export function initImg() {
  const uploadZone = document.getElementById('img-upload')
  const fileInput = document.getElementById('img-file')
  const card = document.getElementById('img-card')
  const status = document.getElementById('img-status')

  // Options
  const pageModeRadios = document.querySelectorAll('input[name="img-page-mode"]')
  const pageRangeInput = document.getElementById('img-page-range')
  const formatSelect = document.getElementById('img-format')
  const qualitySelect = document.getElementById('img-quality')

  // Info display
  const filenameEl = document.getElementById('img-filename')
  const fileSizeEl = document.getElementById('img-filesize')
  const pagesEl = document.getElementById('img-pages')
  const previewContainer = document.getElementById('img-preview')

  // Export button
  const exportBtn = document.getElementById('img-export-btn')
  const closeBtn = document.getElementById('img-close')

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
      loadImgFile(file)
    }
  })
  fileInput.addEventListener('change', () => {
    if (fileInput.files[0]) loadImgFile(fileInput.files[0])
  })

  // Page mode toggle
  pageModeRadios.forEach(radio => {
    radio.addEventListener('change', () => {
      pageRangeInput.disabled = radio.value !== 'range'
    })
  })

  async function loadImgFile(file) {
    if (!checkFileSize(file, status)) return

    try {
      showProgress(status, '正在加载 PDF...', 20)

      const bytes = await file.arrayBuffer()
      const data = new Uint8Array(bytes)

      // Try primary worker, fallback to CDN
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

      state.img.pdfDoc = pdfDoc
      state.img.totalPages = pdfDoc.numPages
      state.img.file = file
      // 追踪：文件上传
      trackEvent('file_uploaded', { function: 'img', name: file.name, size: file.size, pages: pdfDoc.numPages })

      // Display info
      filenameEl.textContent = file.name
      fileSizeEl.textContent = formatSize(file.size)
      pagesEl.textContent = `${pdfDoc.numPages} 页`

      // Show preview of first page
      await renderPreview(pdfDoc)

      // Update page range placeholder
      pageRangeInput.placeholder = `例如: 1,3,5-${pdfDoc.numPages}`

      // Show file info in upload zone instead of hiding it
      showUploadFileInfo(uploadZone, file)
      card.style.display = 'block'
      exportBtn.disabled = false
      clearStatus(status)
    } catch (err) {
      showStatus(status, '❌ 无法加载 PDF: ' + err.message, 'error')
    }
  }

  async function renderPreview(pdfDoc) {
    const page = await pdfDoc.getPage(1)
    const viewport = page.getViewport({ scale: 0.5 })

    const canvas = document.createElement('canvas')
    canvas.width = Math.round(viewport.width)
    canvas.height = Math.round(viewport.height)
    canvas.className = 'img-preview-canvas'
    const ctx = canvas.getContext('2d')
    await page.render({ canvasContext: ctx, viewport }).promise

    previewContainer.innerHTML = ''
    previewContainer.appendChild(canvas)
  }

  closeBtn.addEventListener('click', () => {
    state.img.pdfDoc = null
    state.img.file = null
    state.img.totalPages = 0
    card.style.display = 'none'
    resetUploadZone(uploadZone)
    previewContainer.innerHTML = ''
    fileInput.value = ''
    clearStatus(status)
  })

  exportBtn.addEventListener('click', async () => {
    if (!state.img.pdfDoc || exportBtn.disabled) return
    try {
      exportBtn.disabled = true
      showProcessing(status, '正在转换...', 10)
      const startTime = performance.now()

      // Determine page range
      const totalPages = state.img.totalPages
      if (totalPages === 0) {
        showStatus(status, '❌ 该 PDF 文件没有可转换的页面', 'error')
        exportBtn.disabled = false
        return
      }
      const pageMode = document.querySelector('input[name="img-page-mode"]:checked').value
      let pages

      if (pageMode === 'range') {
        const rangeStr = pageRangeInput.value.trim()
        if (!rangeStr) {
          showStatus(status, '❌ 请输入页码范围', 'error')
          exportBtn.disabled = false
          return
        }
        const result = parsePageRange(rangeStr, totalPages)
        pages = result.pages
        if (result.warnings.length > 0) {
          showStatus(status, '❌ ' + result.warnings.join('；'), 'error')
          exportBtn.disabled = false
          return
        }
        if (pages.length === 0) {
          showStatus(status, '❌ 页码范围无效，请输入有效页码（如 1,3,5）', 'error')
          exportBtn.disabled = false
          return
        }
      } else {
        pages = Array.from({ length: totalPages }, (_, i) => i + 1)
      }

      // Get format and quality
      const format = formatSelect.value // 'png' or 'jpg'
      const renderScale = parseFloat(qualitySelect.value) // 1, 2, or 3
      const mimeType = format === 'png' ? 'image/png' : 'image/jpeg'
      const quality = format === 'jpg' ? 0.92 : undefined

      // Render each page
      const pdfDoc = state.img.pdfDoc
      const images = []

      for (let i = 0; i < pages.length; i++) {
        const pageNum = pages[i]
        const convertProgress = Math.round(((i + 1) / pages.length) * 70) + 15
        showProcessing(status, `正在转换第 ${i + 1}/${pages.length} 页`, convertProgress)

        const page = await pdfDoc.getPage(pageNum)
        const viewport = page.getViewport({ scale: renderScale })

        const canvas = document.createElement('canvas')
        canvas.width = Math.round(viewport.width)
        canvas.height = Math.round(viewport.height)
        const ctx = canvas.getContext('2d')

        // For JPG, fill white background (transparency → black otherwise)
        if (format === 'jpg') {
          ctx.fillStyle = '#FFFFFF'
          ctx.fillRect(0, 0, canvas.width, canvas.height)
        }

        await page.render({ canvasContext: ctx, viewport }).promise

        const blob = await new Promise(resolve => {
          canvas.toBlob(resolve, mimeType, quality)
        })

        images.push({
          blob,
          filename: `page_${String(pageNum).padStart(3, '0')}.${format}`,
        })
      }

      // Download
      if (images.length === 1) {
        // Single page: download directly
        downloadBlob(images[0].blob, images[0].filename, true)
        cleanupResources()
        // 追踪：文件下载
        trackEvent('file_downloaded', { function: 'img', pages: 1, format, quality: renderScale, size: images[0].blob.size })
        const duration = performance.now() - startTime
        showStatus(status, `✅ 转换完成！已下载 ${images[0].filename}（${formatSize(images[0].blob.size)}）`, 'success')
        showReport(status, {
          fileName: state.img.file.name,
          originalSize: state.img.file.size,
          processedSize: images[0].blob.size,
          pageCount: 1,
          format,
          duration,
        })
      } else {
        // Multiple pages: zip
        showProcessing(status, '正在打包 ZIP...', 90)
        const zip = new JSZip()
        const folderName = state.img.file.name.replace(/\.pdf$/i, '')
        const folder = zip.folder(folderName)

        for (const img of images) {
          folder.file(img.filename, img.blob)
        }

        // JSZip auto-detects non-ASCII characters in filenames and sets the UTF-8 flag
        // in the ZIP general purpose bit, ensuring correct display in modern unzip tools
        const zipBlob = await zip.generateAsync({
          type: 'blob',
          compression: 'DEFLATE',
          compressionOptions: { level: 6 },
        })

        const zipName = `${folderName}_images.zip`
        downloadBlob(zipBlob, zipName, true)
        cleanupResources()
        // 追踪：文件下载
        trackEvent('file_downloaded', { function: 'img', pages: images.length, format, quality: renderScale, size: zipBlob.size })
        const duration = performance.now() - startTime
        showStatus(status, `✅ 转换完成！共 ${images.length} 张图片，${formatSize(zipBlob.size)}，已下载 ${zipName}`, 'success')
        showReport(status, {
          fileName: state.img.file.name,
          originalSize: state.img.file.size,
          processedSize: zipBlob.size,
          pageCount: images.length,
          format,
          duration,
        })
      }
    } catch (err) {
      showStatus(status, '❌ 转换失败: ' + err.message, 'error')
    } finally {
      exportBtn.disabled = false
    }
  })
}
