/**
 * invoice-nup.js - A4 发票智能拼版打印模块
 * 用户选择多个 PDF 发票文件，自动按网格布局（2×2 / 3×3 / 4×4）拼到标准 A4 页面上
 */

import * as PDFLib from 'pdf-lib'
import { state } from '../state.js'
import {
  formatSize, showStatus, showProgress, showProcessing, showReport,
  clearStatus, downloadBlob, MAX_FILE_SIZE, checkFileSize, trackEvent,
  highlightUploadZone, resetUploadZone, cleanupResources,
} from '../utils.js'

// A4 尺寸 (pt)
const A4_WIDTH = 595.27
const A4_HEIGHT = 841.89

export function initInvoiceNup() {
  const uploadZone = document.getElementById('invoice-upload')
  const fileInput = document.getElementById('invoice-files')
  const list = document.getElementById('invoice-list')
  const processBtn = document.getElementById('invoice-process-btn')
  const clearBtn = document.getElementById('invoice-clear')
  const status = document.getElementById('invoice-status')

  // Layout options
  const layoutRadios = document.querySelectorAll('input[name="invoice-layout"]')
  const marginInput = document.getElementById('invoice-margin')
  const marginVal = document.getElementById('invoice-margin-val')

  // Margin value display
  marginInput.addEventListener('input', () => {
    marginVal.textContent = marginInput.value + ' pt'
  })

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
    addInvoiceFiles(e.dataTransfer.files)
  })
  fileInput.addEventListener('change', () => {
    addInvoiceFiles(fileInput.files)
    fileInput.value = ''
  })

  function addInvoiceFiles(files) {
    let skipped = false
    for (const f of files) {
      if (f.type === 'application/pdf' || f.name.endsWith('.pdf')) {
        if (f.size > MAX_FILE_SIZE) {
          showStatus(status, `⚠️ 文件 "${escapeHtml(f.name)}" 过大（${formatSize(f.size)}），已跳过`, 'warning')
          skipped = true
        } else {
          state.invoiceNup.files.push(f)
          trackEvent('file_uploaded', { function: 'invoice-nup', name: f.name, size: f.size })
        }
      }
    }
    if (!skipped) clearStatus(status)
    renderInvoiceList()
  }

  function renderInvoiceList() {
    list.innerHTML = ''
    state.invoiceNup.files.forEach((f, i) => {
      const div = document.createElement('div')
      div.className = 'file-item'
      div.innerHTML = `
        <span>📄</span>
        <span class="name" title="${escapeHtml(f.name)}">${escapeHtml(f.name)}</span>
        <span class="size">${formatSize(f.size)}</span>
        <button class="remove" onclick="window._invoiceRemove(${i})">✕</button>
      `
      list.appendChild(div)
    })
    processBtn.disabled = state.invoiceNup.files.length === 0
    clearBtn.style.display = state.invoiceNup.files.length > 0 ? '' : 'none'

    if (state.invoiceNup.files.length > 0) {
      highlightUploadZone(uploadZone)
    } else {
      resetUploadZone(uploadZone)
    }
  }

  function escapeHtml(str) {
    return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
  }

  window._invoiceRemove = function (i) {
    state.invoiceNup.files.splice(i, 1)
    renderInvoiceList()
  }

  clearBtn.addEventListener('click', () => {
    state.invoiceNup.files = []
    renderInvoiceList()
    clearStatus(status)
  })

  // Process button
  processBtn.addEventListener('click', async () => {
    if (state.invoiceNup.files.length === 0) return
    try {
      processBtn.disabled = true
      const total = state.invoiceNup.files.length
      const cols = Number(document.querySelector('input[name="invoice-layout"]:checked').value)
      const rows = cols // square grid
      const margin = Number(marginInput.value)

      showProcessing(status, `正在拼版 ${total} 个发票文件...`, 10)
      const startTime = performance.now()
      const totalInputSize = state.invoiceNup.files.reduce((sum, f) => sum + f.size, 0)

      // Create output PDF
      const outputPdf = await PDFLib.PDFDocument.create()
      let totalPagesOutput = 0
      let totalInputPages = 0
      const errors = []

      // Calculate cell dimensions
      const cellWidth = (A4_WIDTH - margin * 2) / cols
      const cellHeight = (A4_HEIGHT - margin * 2) / rows

      // Collect all pages from all files
      const allPages = []
      for (let i = 0; i < state.invoiceNup.files.length; i++) {
        const f = state.invoiceNup.files[i]
        const progress = Math.round(((i + 1) / total) * 50) + 10
        showProcessing(status, `正在加载 ${i + 1}/${total}: ${escapeHtml(f.name)}`, progress)

        try {
          const bytes = await f.arrayBuffer()
          const doc = await PDFLib.PDFDocument.load(new Uint8Array(bytes), { ignoreEncryption: false })
          for (let p = 0; p < doc.getPageCount(); p++) {
            allPages.push({
              doc,
              pageIndex: p,
              fileName: f.name,
            })
          }
          totalInputPages += doc.getPageCount()
        } catch (fileErr) {
          if (fileErr.message.includes('encrypted') || fileErr.message.includes('password')) {
            errors.push(`"${f.name}" 已加密，跳过`)
          } else {
            errors.push(`"${f.name}" 无法读取：${fileErr.message}`)
          }
        }
      }

      if (allPages.length === 0) {
        showStatus(status, '❌ 无法拼版：没有可读取的 PDF 文件' + (errors.length > 0 ? '\n' + errors.join('\n') : ''), 'error')
        processBtn.disabled = false
        return
      }

      // Process pages in grid batches
      const perPage = cols * rows
      let batchIndex = 0

      for (let i = 0; i < allPages.length; i += perPage) {
        const batch = allPages.slice(i, i + perPage)
        const pageProgress = Math.round(((i + batch.length) / allPages.length) * 40) + 60
        showProcessing(status, `正在拼版第 ${batchIndex + 1} 页...`, pageProgress)

        const a4Page = outputPdf.addPage([A4_WIDTH, A4_HEIGHT])

        for (let j = 0; j < batch.length; j++) {
          const { doc, pageIndex } = batch[j]
          const [embeddedPage] = await outputPdf.embedPage(doc.getPage(pageIndex))

          // Calculate position in grid
          const col = j % cols
          const row = Math.floor(j / cols)

          // Scale to fit cell while maintaining aspect ratio
          const srcWidth = embeddedPage.width
          const srcHeight = embeddedPage.height
          const scale = Math.min(cellWidth / srcWidth, cellHeight / srcHeight)
          const drawWidth = srcWidth * scale
          const drawHeight = srcHeight * scale

          // Center in cell
          const x = margin + col * cellWidth + (cellWidth - drawWidth) / 2
          const y = A4_HEIGHT - margin - (row + 1) * cellHeight + (cellHeight - drawHeight) / 2

          a4Page.drawPage(embeddedPage, {
            x,
            y,
            width: drawWidth,
            height: drawHeight,
          })
        }

        totalPagesOutput++
        batchIndex++
      }

      showProcessing(status, '正在生成文件...', 95)
      const pdfBytes = await outputPdf.save()
      const outputBlob = new Blob([pdfBytes], { type: 'application/pdf' })
      const outputFilename = `invoice_nup_${cols}x${rows}.pdf`
      downloadBlob(outputBlob, outputFilename, true)
      trackEvent('file_downloaded', { function: 'invoice-nup', pages: totalPagesOutput, size: pdfBytes.length, layout: `${cols}x${rows}` })

      showProcessing(status, '即将完成...', 100)

      let msg = `拼版完成！共 ${totalPagesOutput} 页（A4 ${cols}×${rows}），${formatSize(pdfBytes.length)}，已下载`
      if (errors.length > 0) {
        msg += '\n⚠️ ' + errors.join('；')
      }
      const duration = performance.now() - startTime
      setTimeout(() => {
        showStatus(status, '✅ ' + msg.replace(/\n/g, '<br>'), 'success')
        showReport(status, {
          fileName: outputFilename,
          originalSize: totalInputSize,
          processedSize: pdfBytes.length,
          pageCount: totalPagesOutput,
          duration,
        })
      }, 300)

      // Memory cleanup
      cleanupResources()
    } catch (err) {
      showStatus(status, '❌ 拼版失败: ' + err.message, 'error')
    }
    processBtn.disabled = false
  })
}
