/**
 * pdf-worker.js - Web Worker for PDF processing
 * Runs heavy pdf-lib operations off the main thread.
 *
 * Messages in: { action, fileBuffers: ArrayBuffer[], options }
 * Messages out: { success, result: ArrayBuffer, error, fileName }
 *
 * Supported actions:
 *   - 'merge': merge multiple PDFs
 *   - 'nup': invoice N-up layout onto A4 pages
 *   - 'redact': apply redaction rectangles to PDF pages
 */

// pdf-lib must be loaded via import map or inline.
// We use an IIFE approach: the main thread creates a Blob URL from the pdf-lib UMD bundle.
// Alternatively, we import from CDN inside the worker.

// ---- Action router ----
self.onmessage = async function (e) {
  const { action, fileBuffers, options, requestId } = e.data

  try {
    let result
    switch (action) {
      case 'merge':
        result = await handleMerge(fileBuffers, options)
        break
      case 'nup':
        result = await handleNup(fileBuffers, options)
        break
      case 'redact':
        result = await handleRedact(fileBuffers, options)
        break
      default:
        throw new Error(`Unknown action: ${action}`)
    }

    self.postMessage({
      success: true,
      result,
      requestId,
    }, [result]) // transfer ArrayBuffer
  } catch (err) {
    self.postMessage({
      success: false,
      error: err.message,
      requestId,
    })
  }
}

// ---- Merge handler ----
async function handleMerge(buffers, options) {
  const PDFLib = await loadPdfLib()
  const merged = await PDFLib.PDFDocument.create()

  for (const buf of buffers) {
    const src = await PDFLib.PDFDocument.load(new Uint8Array(buf), { ignoreEncryption: false })
    const pages = await merged.copyPages(src, src.getPageIndices())
    pages.forEach(p => merged.addPage(p))
  }

  return merged.save()
}

// ---- N-up handler ----
async function handleNup(buffers, options) {
  const PDFLib = await loadPdfLib()
  const { cols, margin } = options
  const rows = cols

  // A4 dimensions in points
  const A4_W = 595.27
  const A4_H = 841.89

  const cellW = (A4_W - margin * 2) / cols
  const cellH = (A4_H - margin * 2) / rows

  const outputPdf = await PDFLib.PDFDocument.create()
  const allPages = []

  // Collect all pages from all input files
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

      page.drawPage(embeddedPage, {
        x, y, width: drawW, height: drawH,
      })
    }
  }

  return outputPdf.save()
}

// ---- Redact handler ----
async function handleRedact(buffers, options) {
  const PDFLib = await loadPdfLib()
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

// ---- pdf-lib loader ----
// Dynamically import pdf-lib from the same CDN the main thread uses.
let pdfLibCache = null

async function loadPdfLib() {
  if (pdfLibCache) return pdfLibCache

  // Try native dynamic import first (ES module)
  try {
    // Vite inlines worker code; we need to use a URL import.
    // Use import() with the pdf-lib package specifier.
    // In the built output, Vite handles this via its worker bundling.
    const mod = await import('pdf-lib')
    pdfLibCache = mod
    return mod
  } catch (e) {
    // Fallback: load from CDN
    console.warn('Worker: pdf-lib dynamic import failed, loading from CDN:', e.message)
  }

  // Load pdf-lib from CDN as a script
  await importScripts('https://unpkg.com/pdf-lib@1.17.1/dist/pdf-lib.min.js')
  pdfLibCache = self.PDFLib
  return self.PDFLib
}
