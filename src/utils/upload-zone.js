/**
 * utils/upload-zone.js - 上传区管理相关函数
 */

import { formatSize } from './core.js'

/**
 * 在上传区显示文件信息（文件名、大小、页数）
 */
export async function showUploadFileInfo(uploadZone, file, pdfId) {
  const id = pdfId || file.name
  const isPdf = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')
  const isImage = file.type.startsWith('image/') || /\.(jpe?g|png)$/i.test(file.name)

  let pageCount = 0
  if (isPdf) {
    try {
      const lib = await getPdfjs()
      if (lib) {
        const bytes = await file.arrayBuffer()
        const pdfDoc = await lib.getDocument({ data: new Uint8Array(bytes) }).promise
        pageCount = pdfDoc.numPages
      }
    } catch (e) {
      console.warn('[showUploadFileInfo] 获取页数失败:', e)
    }
  }

  renderFileInfo(uploadZone, file, pageCount, isPdf, isImage, id)

  return pageCount
}

/**
 * 渲染文件信息到上传区
 */
function renderFileInfo(uploadZone, file, pageCount, isPdf, isImage, id) {
  const existing = uploadZone.querySelector('.upload-file-info')
  if (existing) existing.remove()

  const iconEl = uploadZone.querySelector('.icon')
  const paragraphs = uploadZone.querySelectorAll('p')
  if (iconEl) iconEl.style.display = 'none'
  paragraphs.forEach(p => p.style.display = 'none')

  uploadZone.classList.add('has-file')

  let fileIcon = '📄'
  if (isImage) fileIcon = '🖼️'

  const infoDiv = document.createElement('div')
  infoDiv.className = 'upload-file-info'
  infoDiv.dataset.fileId = id

  let infoHtml = `
    <div class="upload-file-header">
      <span class="upload-file-icon">${fileIcon}</span>
      <span class="upload-file-name" title="${escapeHtml(file.name)}">${escapeHtml(file.name)}</span>
    </div>
    <div class="upload-file-details">
      <span class="upload-file-size">📊 ${formatSize(file.size)}</span>
  `

  if (isPdf && pageCount > 0) {
    infoHtml += `<span class="upload-file-pages">📑 ${pageCount} 页</span>`
  }

  infoHtml += `
    </div>
    <div class="upload-file-hint">点击或拖入替换文件</div>
  `

  infoDiv.innerHTML = infoHtml
  uploadZone.appendChild(infoDiv)
}

/**
 * 高亮上传区边框（多文件场景）
 */
export function highlightUploadZone(uploadZone) {
  uploadZone.classList.add('has-file')
}

/**
 * 重置上传区到初始状态
 */
export function resetUploadZone(uploadZone) {
  uploadZone.classList.remove('has-file')
  const info = uploadZone.querySelector('.upload-file-info')
  if (info) info.remove()

  const iconEl = uploadZone.querySelector('.icon')
  const paragraphs = uploadZone.querySelectorAll('p')
  if (iconEl) iconEl.style.display = ''
  paragraphs.forEach(p => p.style.display = '')
}

function escapeHtml(str) {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

async function getPdfjs() {
  if (window.pdfjsLib) return window.pdfjsLib
  try {
    const lib = await import('pdfjs-dist')
    window.pdfjsLib = lib
    return lib
  } catch {
    return null
  }
}
