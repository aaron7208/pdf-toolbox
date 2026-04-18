/**
 * utils/pdf-render.js - PDF 渲染相关函数
 */

import { computeResponsiveScale } from './core.js'

/**
 * 渲染 PDF 页面到 Canvas(固定缩放比例)
 */
export async function renderPage(pdfDoc, pageNum, canvas, scale = 1.5) {
  const page = await pdfDoc.getPage(pageNum)
  const viewport = page.getViewport({ scale })
  canvas.width = viewport.width
  canvas.height = viewport.height
  canvas.style.width = ''
  canvas.style.height = ''
  const ctx = canvas.getContext('2d')
  await page.render({ canvasContext: ctx, viewport }).promise
}

/**
 * 渲染 PDF 页面到 Canvas(响应式,自动适配容器)
 */
export async function renderPageResponsive(pdfDoc, pageNum, canvas, container, baseScale = 1) {
  const page = await pdfDoc.getPage(pageNum)
  const containerWidth = container ? container.clientWidth : 800
  const containerHeight = container ? container.clientHeight : 600
  const scale = computeResponsiveScale(page, containerWidth, containerHeight) * baseScale
  const viewport = page.getViewport({ scale })
  canvas.width = Math.round(viewport.width)
  canvas.height = Math.round(viewport.height)
  canvas.style.width = viewport.width + 'px'
  canvas.style.height = viewport.height + 'px'
  const ctx = canvas.getContext('2d')
  await page.render({ canvasContext: ctx, viewport }).promise
  return scale
}
