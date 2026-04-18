/**
 * worker-client.js - Main-thread helper to communicate with pdf-worker.js
 * Provides a unified API: processes PDFs via Web Worker when available,
 * otherwise falls back to main-thread execution.
 */

import * as PDFLib from 'pdf-lib'
import { MAX_FILE_SIZE } from './utils.js'

/** Worker URL — resolved by Vite via the `?worker` import suffix */
let WorkerConstructor = null
let workerUrl = null

/** Initialize worker URL (called from main.js) */
export function initWorker(url) {
  workerUrl = url
}

/**
 * Check if Worker is available and file is large enough to warrant offloading.
 */
function shouldUseWorker(fileSize) {
  if (!workerUrl) return false
  // Only offload for large files (>10MB) or if explicitly requested
  return fileSize > 10 * 1024 * 1024
}

/**
 * Process PDF via Worker with main-thread fallback.
 *
 * @param {string} action - 'merge' | 'nup' | 'redact'
 * @param {ArrayBuffer[]} fileBuffers - PDF file buffers
 * @param {object} options - action-specific options
 * @param {number} fileSize - approximate total file size
 * @returns {Promise<ArrayBuffer>} processed PDF
 */
export async function processWithWorker(action, fileBuffers, options, fileSize = 0) {
  if (shouldUseWorker(fileSize)) {
    try {
      return await runWorker(action, fileBuffers, options)
    } catch (err) {
      console.warn('Worker failed, falling back to main thread:', err.message)
    }
  }
  // Fallback to main thread
  return runMain(action, fileBuffers, options)
}

/**
 * Run pdf-lib operation inside a Web Worker.
 */
function runWorker(action, fileBuffers, options) {
  return new Promise((resolve, reject) => {
    if (!workerUrl) {
      reject(new Error('Worker URL not initialized'))
      return
    }

    const worker = new Worker(workerUrl, { type: 'module' })
    const timeout = setTimeout(() => {
      worker.terminate()
      reject(new Error('Worker timed out (60s)'))
    }, 60_000)

    const requestId = `${action}_${Date.now()}`

    worker.onmessage = (e) => {
      if (e.data.requestId !== requestId) return
      clearTimeout(timeout)
      worker.terminate()

      if (e.data.success) {
        resolve(e.data.result)
      } else {
        reject(new Error(e.data.error || 'Worker processing failed'))
      }
    }

    worker.onerror = (err) => {
      clearTimeout(timeout)
      worker.terminate()
      reject(new Error('Worker error: ' + (err.message || 'unknown')))
    }

    // Transfer buffers to worker
    const transfers = fileBuffers.map(buf => buf)
    worker.postMessage(
      { action, fileBuffers, options, requestId },
      transfers
    )
  })
}

/**
 * Run pdf-lib operation on main thread (fallback).
 */
async function runMain(action, fileBuffers, options) {
  switch (action) {
    case 'merge':
      return mainMerge(fileBuffers, options)
    case 'nup':
      return mainNup(fileBuffers, options)
    case 'redact':
      return mainRedact(fileBuffers, options)
    default:
      throw new Error(`Unknown action: ${action}`)
  }
}

async function mainMerge(buffers) {
  const merged = await PDFLib.PDFDocument.create()
  for (const buf of buffers) {
    const src = await PDFLib.PDFDocument.load(new Uint8Array(buf), { ignoreEncryption: false })
    const pages = await merged.copyPages(src, src.getPageIndices())
    pages.forEach(p => merged.addPage(p))
  }
  return merged.save()
}

async function mainNup(buffers, options) {
  const { cols, margin } = options
  const rows = cols
  const A4_W = 595.27
  const A4_H = 841.89
  const cellW = (A4_W - margin * 2) / cols
  const cellH = (A4_H - margin * 2) / rows

  const outputPdf = await PDFLib.PDFDocument.create()
  const allPages = []

  for (const buf of buffers) {
    const src = await PDFLib.PDFDocument.load(new Uint8Array(buf), { ignoreEncryption: false })
    for (let i = 0; i < src.getPageCount(); i++) {
      allPages.push({ src, pageIndex: i })
    }
  }

  const perPage = cols * rows
  for (let i = 0; i < allPages.length; i += perPage) {
    const batch = allPages.slice(i, i + perPage)
    const page = outputPdf.addPage([A4_W, A4_H])

    for (let j = 0; j < batch.length; j++) {
      const { src, pageIndex } = batch[j]
      const [embeddedPage] = await outputPdf.embedPage(src.getPage(pageIndex))

      const col = j % cols
      const row = Math.floor(j / cols)

      const srcW = embeddedPage.width
      const srcH = embeddedPage.height
      const scale = Math.min(cellW / srcW, cellH / srcH)
      const drawW = srcW * scale
      const drawH = srcH * scale

      const x = margin + col * cellW + (cellW - drawW) / 2
      const y = A4_H - margin - (row + 1) * cellH + (cellH - drawH) / 2

      page.drawPage(embeddedPage, { x, y, width: drawW, height: drawH })
    }
  }

  return outputPdf.save()
}

async function mainRedact(buffers, options) {
  const { redactions, color, borderRadius } = options

  if (!buffers || buffers.length === 0) {
    throw new Error('No PDF buffer provided for redaction')
  }

  const pdfDoc = await PDFLib.PDFDocument.load(new Uint8Array(buffers[0]))
  const pages = pdfDoc.getPages()

  const r = parseInt(color.slice(1, 3), 16) / 255
  const g = parseInt(color.slice(3, 5), 16) / 255
  const b = parseInt(color.slice(5, 7), 16) / 255

  for (const [pageNumStr, rects] of Object.entries(redactions)) {
    const pageNum = parseInt(pageNumStr, 10)
    if (pageNum < 1 || pageNum > pages.length) continue
    if (!rects || rects.length === 0) continue

    const page = pages[pageNum - 1]
    const { width, height } = page.getSize()

    for (const rect of rects) {
      const x = rect.xPct * width
      const pdfY = height - (rect.yPct + rect.hPct) * height
      const w = rect.wPct * width
      const h = rect.hPct * height

      page.drawRectangle({
        x,
        y: pdfY,
        width: w,
        height: h,
        color: PDFLib.rgb(r, g, b),
        opacity: 1,
        borderWidth: 0,
        borderRadius: borderRadius || 0,
      })
    }
  }

  return pdfDoc.save()
}
