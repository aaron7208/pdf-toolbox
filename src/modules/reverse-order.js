/**
 * reverse-order.js - 倒序排列页面模块
 */

import { showStatus, showProgress, downloadBlob } from '../utils.js'
import { PDFDocument } from 'pdf-lib'

let pdfBytes = null
let fileName = ''
let totalPages = 0

export function initReverseOrder() {
  console.log('[ReverseOrder] Initializing...')
  
  const uploadZone = document.getElementById('reverse-order-upload')
  const fileInput = document.getElementById('reverse-order-file')
  
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
  
  const reverseBtn = document.getElementById('reverse-order-btn')
  const closeBtn = document.getElementById('reverse-order-close')
  
  if (reverseBtn) reverseBtn.addEventListener('click', reverseOrder)
  if (closeBtn) closeBtn.addEventListener('click', () => { closeModal('reverse-order'); resetState() })
}

async function handleFileSelect(file) {
  if (!file || file.type !== 'application/pdf') {
    showStatus('reverse-order-status', '请选择有效的 PDF 文件', 'error')
    return
  }

  showStatus('reverse-order-status', '正在加载 PDF...', 'info')
  
  try {
    const arrayBuffer = await file.arrayBuffer()
    pdfBytes = new Uint8Array(arrayBuffer)
    const pdfDoc = await PDFDocument.load(pdfBytes)
    totalPages = pdfDoc.getPageCount()
    fileName = file.name.replace('.pdf', '')
    
    document.getElementById('reverse-order-filename').textContent = file.name
    document.getElementById('reverse-order-pages').textContent = `${totalPages} 页`
    document.getElementById('reverse-order-card').style.display = 'block'
    
    showStatus('reverse-order-status', `✅ 已加载 ${totalPages} 页，点击"倒序并下载"开始处理`, 'success')
  } catch (error) {
    showStatus('reverse-order-status', '加载失败：' + error.message, 'error')
  }
}

async function reverseOrder() {
  if (!pdfBytes) {
    showStatus('reverse-order-status', '请先上传 PDF 文件', 'error')
    return
  }
  
  showStatus('reverse-order-status', '正在倒序排列...', 'info')
  
  try {
    const srcDoc = await PDFDocument.load(pdfBytes)
    const newDoc = await PDFDocument.create()
    
    const pageIndices = Array.from({ length: totalPages }, (_, i) => i).reverse()
    
    showProgress('reverse-order-status', '正在复制页面...', 40)
    const [copiedPages] = await newDoc.copyPages(srcDoc, pageIndices)
    
    showProgress('reverse-order-status', '正在重组文档...', 70)
    copiedPages.forEach(page => newDoc.addPage(page))
    
    showProgress('reverse-order-status', '正在保存...', 90)
    const bytes = await newDoc.save()
    const blob = new Blob([bytes], { type: 'application/pdf' })
    downloadBlob(blob, `${fileName}_已倒序.pdf`, true)
    
    showProgress('reverse-order-status', '完成！', 100)
    showStatus('reverse-order-status', `✅ 成功倒序 ${totalPages} 页！`, 'success')
  } catch (error) {
    showStatus('reverse-order-status', '倒序失败：' + error.message, 'error')
  }
}

function resetState() {
  pdfBytes = null
  fileName = ''
  totalPages = 0
  document.getElementById('reverse-order-card').style.display = 'none'
  document.getElementById('reverse-order-status').innerHTML = ''
}
