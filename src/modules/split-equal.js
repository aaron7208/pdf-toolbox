/**
 * split-equal.js - 等份分割 PDF 模块
 */

import { showStatus, showProgress, downloadBlob } from '../utils.js'
import { PDFDocument } from 'pdf-lib'
import JSZip from 'jszip'

let pdfDoc = null
let pdfBytes = null
let fileName = ''
let totalPages = 0

export function initSplitEqual() {
  console.log('[SplitEqual] Initializing...')
  
  const uploadZone = document.getElementById('split-equal-upload')
  const fileInput = document.getElementById('split-equal-file')
  
  if (uploadZone && fileInput) {
    uploadZone.addEventListener('click', () => fileInput.click())
    fileInput.addEventListener('change', (e) => {
      if (e.target.files.length > 0) handleFileSelect(e.target.files[0])
    })
    
    uploadZone.addEventListener('dragover', (e) => { e.preventDefault(); uploadZone.classList.add('dragover') })
    uploadZone.addEventListener('dragleave', () => uploadZone.classList.remove('dragover'))
    uploadZone.addEventListener('drop', (e) => {
      e.preventDefault()
      uploadZone.classList.remove('dragover')
      if (e.dataTransfer.files.length > 0) handleFileSelect(e.dataTransfer.files[0])
    })
  }
  
  const splitBtn = document.getElementById('split-equal-btn')
  const closeBtn = document.getElementById('split-equal-close')
  const valueInput = document.getElementById('split-equal-value')
  const modeRadios = document.querySelectorAll('input[name="split-mode"]')
  
  if (splitBtn) splitBtn.addEventListener('click', splitEqual)
  if (closeBtn) closeBtn.addEventListener('click', () => { closeModal('split-equal'); resetState() })
  if (valueInput) valueInput.addEventListener('input', updatePreview)
  modeRadios.forEach(radio => radio.addEventListener('change', updatePreview))
}

async function handleFileSelect(file) {
  if (!file || file.type !== 'application/pdf') {
    showStatus('split-equal-status', '请选择有效的 PDF 文件', 'error')
    return
  }

  showStatus('split-equal-status', '正在加载 PDF...', 'info')
  
  try {
    const arrayBuffer = await file.arrayBuffer()
    pdfBytes = new Uint8Array(arrayBuffer)
    pdfDoc = await PDFDocument.load(pdfBytes)
    totalPages = pdfDoc.getPageCount()
    fileName = file.name.replace('.pdf', '')
    
    document.getElementById('split-equal-filename').textContent = file.name
    document.getElementById('split-equal-pages').textContent = `${totalPages} 页`
    document.getElementById('split-equal-card').style.display = 'block'
    
    updatePreview()
    showStatus('split-equal-status', '', 'success')
  } catch (error) {
    showStatus('split-equal-status', '加载失败：' + error.message, 'error')
  }
}

function updatePreview() {
  const mode = document.querySelector('input[name="split-mode"]:checked').value
  const value = parseInt(document.getElementById('split-equal-value').value)
  const label = document.getElementById('split-equal-label')
  const preview = document.getElementById('split-equal-preview')
  
  if (mode === 'by-count') {
    label.textContent = '文件数量：'
    const pagesPerFile = Math.floor(totalPages / value)
    const remainder = totalPages % value
    let text = `将生成 ${value} 个文件`
    if (remainder === 0) {
      text += `，每个 ${pagesPerFile} 页`
    } else {
      text += `，前 ${value - 1} 个各 ${pagesPerFile} 页，最后 1 个 ${pagesPerFile + remainder} 页`
    }
    preview.textContent = text
  } else {
    label.textContent = '每份页数：'
    const fileCount = Math.ceil(totalPages / value)
    preview.textContent = `将生成 ${fileCount} 个文件，每个 ${value} 页（最后一个可能不足）`
  }
}

async function splitEqual() {
  const mode = document.querySelector('input[name="split-mode"]:checked').value
  const value = parseInt(document.getElementById('split-equal-value').value)
  
  if (value < 2) {
    showStatus('split-equal-status', '数值必须大于等于 2', 'error')
    return
  }
  
  showStatus('split-equal-status', '正在分割...', 'info')
  
  try {
    const zip = new JSZip()
    let chunks = []
    
    if (mode === 'by-count') {
      const pagesPerFile = Math.floor(totalPages / value)
      const remainder = totalPages % value
      let startIndex = 0
      
      for (let i = 0; i < value; i++) {
        const pagesInThisChunk = pagesPerFile + (i === value - 1 ? remainder : 0)
        chunks.push({ start: startIndex, count: pagesInThisChunk })
        startIndex += pagesInThisChunk
      }
    } else {
      for (let i = 0; i < totalPages; i += value) {
        chunks.push({ start: i, count: Math.min(value, totalPages - i) })
      }
    }
    
    for (let i = 0; i < chunks.length; i++) {
      showProgress('split-equal-status', `正在处理第 ${i + 1} 个文件...`, (i / chunks.length) * 80)
      
      const { start, count } = chunks[i]
      const pageIndices = Array.from({ length: count }, (_, j) => start + j)
      
      const newPdf = await PDFDocument.create()
      const [copiedPages] = await newPdf.copyPages(pdfDoc, pageIndices)
      copiedPages.forEach(page => newPdf.addPage(page))
      
      const bytes = await newPdf.save()
      zip.file(`${fileName}_第${i + 1}部分.pdf`, bytes)
    }
    
    showProgress('split-equal-status', '正在打包 ZIP...', 90)
    const zipBlob = await zip.generateAsync({ type: 'blob' })
    downloadBlob(zipBlob, `${fileName}_等份分割.zip`, true)
    
    showProgress('split-equal-status', '完成！', 100)
    showStatus('split-equal-status', `✅ 成功分割为 ${chunks.length} 个文件！`, 'success')
  } catch (error) {
    showStatus('split-equal-status', '分割失败：' + error.message, 'error')
  }
}

function resetState() {
  pdfDoc = null
  pdfBytes = null
  fileName = ''
  totalPages = 0
  document.getElementById('split-equal-card').style.display = 'none'
  document.getElementById('split-equal-status').innerHTML = ''
}
