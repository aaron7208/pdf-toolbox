/**
 * split.js - PDF 拆分模块
 * 按页码范围将 PDF 拆分为多个独立文件，多文件自动打包 ZIP
 */

import * as PDFLib from 'pdf-lib'
import * as pdfjsLib from 'pdfjs-dist'
import { state } from '../state.js'
import { formatSize, showStatus, showProgress, showProcessing, showReport, clearStatus, downloadBlob, parsePageRange, MAX_FILE_SIZE, checkFileSize, PDFJS_CDN_FALLBACK, trackEvent, showUploadFileInfo, resetUploadZone, cleanupResources } from '../utils.js'
import JSZip from 'jszip'

export function initSplit() {
  const uploadZone = document.getElementById('split-upload')
  const fileInput = document.getElementById('split-file')
  const card = document.getElementById('split-card')
  const status = document.getElementById('split-status')

  // Info display
  const filenameEl = document.getElementById('split-filename')
  const pagesEl = document.getElementById('split-pages')

  // Options
  const modeRadios = document.querySelectorAll('input[name="split-mode"]')
  const rangeGroup = document.getElementById('split-range-group')
  const rangesInput = document.getElementById('split-ranges')
  const previewContainer = document.getElementById('split-preview')

  // Buttons
  const splitBtn = document.getElementById('split-btn')
  const closeBtn = document.getElementById('split-close')

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
      loadSplitFile(file)
    }
  })
  fileInput.addEventListener('change', () => {
    if (fileInput.files[0]) loadSplitFile(fileInput.files[0])
  })

  // Mode toggle
  modeRadios.forEach(radio => {
    radio.addEventListener('change', () => {
      rangeGroup.style.display = radio.value === 'range' ? '' : 'none'
    })
  })

  async function loadSplitFile(file) {
    if (!checkFileSize(file, status)) return

    try {
      showProgress(status, '正在加载 PDF...', 20)

      const bytes = await file.arrayBuffer()
      const data = new Uint8Array(bytes)

      // Check if PDF is encrypted (using pdf-lib, consistent with compress/merge)
      try {
        await PDFLib.PDFDocument.load(data, { ignoreEncryption: false })
      } catch (encErr) {
        if (encErr.message.includes('encrypted') || encErr.message.includes('password')) {
          showStatus(status, '❌ 该 PDF 文件已加密，无法拆分', 'error')
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

      state.split.pdfDoc = pdfDoc
      state.split.pdfBytes = data
      state.split.file = file
      state.split.totalPages = pdfDoc.numPages
      // 追踪：文件上传
      trackEvent('file_uploaded', { function: 'split', name: file.name, size: file.size, pages: pdfDoc.numPages })

      // Display info
      filenameEl.textContent = file.name
      pagesEl.textContent = `${pdfDoc.numPages} 页`

      // Show first page preview
      await renderPreview(pdfDoc)

      // Update range placeholder
      rangesInput.placeholder = `例如: 1-3,4-${pdfDoc.numPages}`

      // Show file info in upload zone instead of hiding it
      showUploadFileInfo(uploadZone, file)
      card.style.display = 'block'
      splitBtn.disabled = false
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
    canvas.className = 'split-preview-canvas'
    const ctx = canvas.getContext('2d')
    await page.render({ canvasContext: ctx, viewport }).promise

    previewContainer.innerHTML = ''
    previewContainer.appendChild(canvas)
  }

  closeBtn.addEventListener('click', () => {
    state.split.pdfDoc = null
    state.split.pdfBytes = null
    state.split.file = null
    state.split.totalPages = 0
    card.style.display = 'none'
    resetUploadZone(uploadZone)
    previewContainer.innerHTML = ''
    fileInput.value = ''
    clearStatus(status)
  })

  splitBtn.addEventListener('click', async () => {
    if (!state.split.pdfBytes || splitBtn.disabled) return
    try {
      splitBtn.disabled = true
      showProcessing(status, '正在拆分...', 10)
      const startTime = performance.now()

      const totalPages = state.split.totalPages
      const baseName = state.split.file.name.replace(/\.pdf$/i, '')
      const srcDoc = await PDFLib.PDFDocument.load(state.split.pdfBytes)

      const mode = document.querySelector('input[name="split-mode"]:checked').value
      let ranges // array of { label, pages }

      if (mode === 'every') {
        // Each page as a separate file
        ranges = Array.from({ length: totalPages }, (_, i) => ({
          label: `page_${String(i + 1).padStart(3, '0')}`,
          pages: [i + 1],
        }))
      } else {
        // Parse user-defined ranges
        const rangeStr = rangesInput.value.trim()
        if (!rangeStr) {
          showStatus(status, '❌ 请输入页码范围', 'error')
          splitBtn.disabled = false
          return
        }

        ranges = parseSplitRanges(rangeStr, totalPages)
        if (ranges.length === 0) {
          showStatus(status, '❌ 页码范围无效，请检查输入（如 10-5 是反向范围，应为 5-10）', 'error')
          splitBtn.disabled = false
          return
        }
      }

      // Generate PDF for each range
      const results = []
      for (let i = 0; i < ranges.length; i++) {
        const { label, pages } = ranges[i]
        const splitProgress = Math.round(((i + 1) / ranges.length) * 70) + 15
        showProcessing(status, `正在处理第 ${i + 1}/${ranges.length} 组`, splitProgress)

        const newDoc = await PDFLib.PDFDocument.create()
        const indices = pages.map(p => p - 1) // 0-based indices
        const copiedPages = await newDoc.copyPages(srcDoc, indices)
        copiedPages.forEach(page => newDoc.addPage(page))

        const pdfBytes = await newDoc.save()
        results.push({
          filename: `${baseName}_${label}.pdf`,
          bytes: pdfBytes,
        })
      }

      // Download
      if (results.length === 1) {
        downloadBlob(new Blob([results[0].bytes], { type: 'application/pdf' }), results[0].filename, true)
        cleanupResources()
        // 追踪：文件下载
        trackEvent('file_downloaded', { function: 'split', files: 1, size: results[0].bytes.length })
        const duration = performance.now() - startTime
        showStatus(status, `✅ 拆分完成！共 ${results[0].pages ? results[0].pages.length : ranges[0].pages.length} 页，${formatSize(results[0].bytes.length)}，已下载`, 'success')
        showReport(status, {
          fileName: state.split.file.name,
          originalSize: state.split.file.size,
          processedSize: results[0].bytes.length,
          pageCount: results[0].pages ? results[0].pages.length : ranges[0].pages.length,
          duration,
        })
      } else {
        // Multiple files: zip
        showProcessing(status, '正在打包 ZIP...', 90)
        const zip = new JSZip()
        const folder = zip.folder(baseName)

        for (const r of results) {
          // Convert to Uint8Array to ensure clean binary data handling
          const bytes = r.bytes instanceof Uint8Array ? r.bytes : new Uint8Array(r.bytes)
          folder.file(r.filename, bytes)
        }

        // JSZip auto-detects non-ASCII characters in filenames and sets the UTF-8 flag
        // in the ZIP general purpose bit, ensuring correct display in modern unzip tools
        const zipBlob = await zip.generateAsync({
          type: 'blob',
          compression: 'DEFLATE',
          compressionOptions: { level: 6 },
        })

        const zipName = `${baseName}_split.zip`
        downloadBlob(zipBlob, zipName, true)
        cleanupResources()
        // 追踪：文件下载
        trackEvent('file_downloaded', { function: 'split', files: results.length, size: zipBlob.size })
        const duration = performance.now() - startTime
        showStatus(status, `✅ 拆分完成！共 ${results.length} 个文件，${formatSize(zipBlob.size)}，已下载 ${zipName}`, 'success')
        showReport(status, {
          fileName: state.split.file.name,
          originalSize: state.split.file.size,
          processedSize: zipBlob.size,
          pageCount: totalPages,
          fileCount: results.length,
          duration,
        })
      }
    } catch (err) {
      showStatus(status, '❌ 拆分失败: ' + err.message, 'error')
    } finally {
      splitBtn.disabled = false
    }
  })

  /**
   * Parse split ranges like "1-3,5,8-10" into labeled groups
   * Returns: [{ label: "1-3", pages: [1,2,3] }, { label: "5", pages: [5] }, ...]
   */
  function parseSplitRanges(str, max) {
    const results = []
    const parts = str.split(',')
    for (const part of parts) {
      const trimmed = part.trim()
      if (!trimmed) continue

      if (trimmed.includes('-')) {
        const [a, b] = trimmed.split('-').map(Number)
        if (!isNaN(a) && !isNaN(b) && a >= 1 && b <= max && a <= b) {
          const pages = []
          for (let i = a; i <= b; i++) pages.push(i)
          results.push({ label: `${a}-${b}`, pages })
        }
      } else {
        const n = Number(trimmed)
        if (!isNaN(n) && n >= 1 && n <= max) {
          results.push({ label: String(n), pages: [n] })
        }
      }
    }
    return results
  }
}
