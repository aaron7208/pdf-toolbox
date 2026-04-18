/**
 * img2pdf.js - 图片转 PDF 模块
 * 将多张图片合并为一个 PDF 文件，每张图片一页 A4 尺寸居中
 */

import * as PDFLib from 'pdf-lib'
import { state } from '../state.js'
import { formatSize, showStatus, showProgress, showProcessing, showReport, clearStatus, downloadBlob, MAX_FILE_SIZE, trackEvent, highlightUploadZone, resetUploadZone, cleanupResources } from '../utils.js'

// A4 dimensions in points (72 points per inch)
const A4_WIDTH = 595.28
const A4_HEIGHT = 841.89
const A4_PADDING = 40 // padding inside A4 page
const MAX_IMG_SIZE = 20 * 1024 * 1024 // 20MB per image

export function initImg2Pdf() {
  const uploadZone = document.getElementById('img2pdf-upload')
  const fileInput = document.getElementById('img2pdf-files')
  const list = document.getElementById('img2pdf-list')
  const generateBtn = document.getElementById('img2pdf-btn')
  const clearBtn = document.getElementById('img2pdf-clear')
  const status = document.getElementById('img2pdf-status')

  // Track object URLs to prevent memory leaks
  let thumbUrls = []
  function revokeAllUrls() {
    thumbUrls.forEach(url => URL.revokeObjectURL(url))
    thumbUrls = []
  }

  uploadZone.addEventListener('click', () => fileInput.click())
  uploadZone.addEventListener('dragover', e => {
    e.preventDefault()
    uploadZone.classList.add('dragover')
  })
  uploadZone.addEventListener('dragleave', () => uploadZone.classList.remove('dragover'))
  uploadZone.addEventListener('drop', e => {
    e.preventDefault()
    uploadZone.classList.remove('dragover')
    addImg2PdfFiles(e.dataTransfer.files)
  })
  fileInput.addEventListener('change', () => {
    addImg2PdfFiles(fileInput.files)
    fileInput.value = ''
  })

  function addImg2PdfFiles(files) {
    let skipped = false
    for (const f of files) {
      const isImage = f.type.startsWith('image/') || /\.(jpe?g|png)$/i.test(f.name)
      if (isImage) {
        if (f.size > MAX_IMG_SIZE) {
          showStatus(status, `⚠️ 图片 "${escapeHtml(f.name)}" 过大（${formatSize(f.size)}），已跳过`, 'warning')
          skipped = true
        } else {
          state.img2pdf.files.push(f)
          // 追踪：文件上传
          trackEvent('file_uploaded', { function: 'img2pdf', name: f.name, size: f.size })
        }
      } else {
        showStatus(status, `⚠️ "${escapeHtml(f.name)}" 不是支持的图片格式（仅 JPG/PNG）`, 'warning')
        skipped = true
      }
    }
    if (!skipped) clearStatus(status)
    renderImg2PdfList()
  }

  function renderImg2PdfList() {
    // Revoke old object URLs before re-rendering to prevent memory leaks
    revokeAllUrls()
    list.innerHTML = ''
    state.img2pdf.files.forEach((f, i) => {
      const div = document.createElement('div')
      div.className = 'file-item img2pdf-item'
      div.draggable = true
      div.dataset.index = i

      // Thumbnail preview
      const thumbUrl = URL.createObjectURL(f)
      thumbUrls.push(thumbUrl)
      div.innerHTML = `
        <img src="${thumbUrl}" class="img2pdf-thumb" alt="${escapeHtml(f.name)}">
        <span class="name" title="${escapeHtml(f.name)}">${escapeHtml(f.name)}</span>
        <span class="size">${formatSize(f.size)}</span>
        <button class="btn btn-outline btn-sm" onclick="window._img2pdfMove(${i},-1)" ${i === 0 ? 'disabled' : ''}>↑</button>
        <button class="btn btn-outline btn-sm" onclick="window._img2pdfMove(${i},1)" ${i === state.img2pdf.files.length - 1 ? 'disabled' : ''}>↓</button>
        <button class="remove" onclick="window._img2pdfRemove(${i})">✕</button>
      `
      list.appendChild(div)

      // Drag reorder
      div.addEventListener('dragstart', e => {
        e.dataTransfer.setData('text/plain', i)
        div.classList.add('dragging')
      })
      div.addEventListener('dragend', () => div.classList.remove('dragging'))
      div.addEventListener('dragover', e => {
        e.preventDefault()
        div.classList.add('drag-over')
      })
      div.addEventListener('dragleave', () => div.classList.remove('drag-over'))
      div.addEventListener('drop', e => {
        e.preventDefault()
        e.stopPropagation()
        div.classList.remove('drag-over')
        const fromIndex = parseInt(e.dataTransfer.getData('text/plain'))
        const toIndex = i
        if (fromIndex !== toIndex) {
          const [moved] = state.img2pdf.files.splice(fromIndex, 1)
          state.img2pdf.files.splice(toIndex, 0, moved)
          renderImg2PdfList()
        }
      })
    })

    generateBtn.disabled = state.img2pdf.files.length < 1
    clearBtn.style.display = state.img2pdf.files.length > 0 ? '' : 'none'

    // Highlight upload zone when files are added
    if (state.img2pdf.files.length > 0) {
      highlightUploadZone(uploadZone)
    } else {
      resetUploadZone(uploadZone)
    }
  }

  function escapeHtml(str) {
    return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
  }

  window._img2pdfRemove = function (i) {
    state.img2pdf.files.splice(i, 1)
    renderImg2PdfList()
  }

  window._img2pdfMove = function (i, dir) {
    const j = i + dir
    if (j >= 0 && j < state.img2pdf.files.length) {
      [state.img2pdf.files[i], state.img2pdf.files[j]] = [state.img2pdf.files[j], state.img2pdf.files[i]]
      renderImg2PdfList()
    }
  }

  clearBtn.addEventListener('click', () => {
    state.img2pdf.files = []
    revokeAllUrls()
    renderImg2PdfList()
    clearStatus(status)
  })

  generateBtn.addEventListener('click', async () => {
    if (state.img2pdf.files.length < 1 || generateBtn.disabled) return
    try {
      showProcessing(status, '正在生成 PDF...', 10)
      generateBtn.disabled = true
      const startTime = performance.now()
      const totalInputSize = state.img2pdf.files.reduce((sum, f) => sum + f.size, 0)

      const pdfDoc = await PDFLib.PDFDocument.create()
      const now = new Date()
      const ts = `${now.getFullYear()}${String(now.getMonth()+1).padStart(2,'0')}${String(now.getDate()).padStart(2,'0')}_${String(now.getHours()).padStart(2,'0')}${String(now.getMinutes()).padStart(2,'0')}`
      const baseName = `图片转PDF_${ts}`

      for (let i = 0; i < state.img2pdf.files.length; i++) {
        const f = state.img2pdf.files[i]
        const total = state.img2pdf.files.length
        const imgProgress = Math.round(((i + 1) / total) * 75) + 15
        showProcessing(status, `正在处理 ${i + 1}/${total}: ${escapeHtml(f.name)}`, imgProgress)

        const bytes = await f.arrayBuffer()
        let image
        const nameLower = f.name.toLowerCase()

        if (nameLower.endsWith('.png') || f.type === 'image/png') {
          image = await pdfDoc.embedPng(new Uint8Array(bytes))
        } else if (nameLower.endsWith('.jpg') || nameLower.endsWith('.jpeg') || f.type === 'image/jpeg') {
          image = await pdfDoc.embedJpg(new Uint8Array(bytes))
        } else {
          // Skip unsupported
          continue
        }

        // Calculate image position to center it on A4 page with padding
        const availableWidth = A4_WIDTH - A4_PADDING * 2
        const availableHeight = A4_HEIGHT - A4_PADDING * 2

        // Scale to fit while maintaining aspect ratio
        const scale = Math.min(availableWidth / image.width, availableHeight / image.height)
        const drawWidth = image.width * scale
        const drawHeight = image.height * scale

        // Center position
        const x = (A4_WIDTH - drawWidth) / 2
        const y = (A4_HEIGHT - drawHeight) / 2

        const page = pdfDoc.addPage([A4_WIDTH, A4_HEIGHT])
        page.drawImage(image, {
          x,
          y,
          width: drawWidth,
          height: drawHeight,
        })
      }

      if (pdfDoc.getPageCount() === 0) {
        showStatus(status, '❌ 没有可处理的图片', 'error')
        generateBtn.disabled = false
        return
      }

      const pdfBytes = await pdfDoc.save()
      const outputBlob = new Blob([pdfBytes], { type: 'application/pdf' })

      const outputFilename = `${baseName}.pdf`
      downloadBlob(outputBlob, outputFilename, true)
      cleanupResources()
      // 追踪：文件下载
      trackEvent('file_downloaded', { function: 'img2pdf', pages: pdfDoc.getPageCount(), size: pdfBytes.length })

      const duration = performance.now() - startTime
      showStatus(status, `✅ 转换完成！共 ${pdfDoc.getPageCount()} 页，${formatSize(pdfBytes.length)}，已下载 ${outputFilename}`, 'success')
      showReport(status, {
        fileName: outputFilename,
        originalSize: totalInputSize,
        processedSize: pdfBytes.length,
        pageCount: pdfDoc.getPageCount(),
        duration,
      })
    } catch (err) {
      showStatus(status, '❌ 生成失败: ' + err.message, 'error')
    }
    generateBtn.disabled = false
  })
}
