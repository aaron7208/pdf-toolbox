/**
 * signature.js - PDF 视觉签名模块
 * 
 * 功能：
 * - 手绘签名（Canvas 绘制）
 * - 上传图片签名
 * - 签名库管理（IndexedDB）
 * - 拖拽放置签名到PDF指定位置
 */

import { showStatus, downloadBlob, resetUploadZone } from '../utils.js'
import { PDFDocument } from 'pdf-lib'

function setupUploadZone(uploadZoneId, fileInputId, handler) {
  const uploadZone = document.getElementById(uploadZoneId)
  const fileInput = document.getElementById(fileInputId)
  
  if (uploadZone && fileInput) {
    uploadZone.addEventListener('click', () => fileInput.click())
    fileInput.addEventListener('change', (e) => {
      if (e.target.files.length > 0) {
        handler(e.target.files[0])
      }
    })
    
    uploadZone.addEventListener('dragover', (e) => {
      e.preventDefault()
      uploadZone.classList.add('dragover')
    })
    
    uploadZone.addEventListener('dragleave', () => {
      uploadZone.classList.remove('dragover')
    })
    
    uploadZone.addEventListener('drop', (e) => {
      e.preventDefault()
      uploadZone.classList.remove('dragover')
      if (e.dataTransfer.files.length > 0) {
        handler(e.dataTransfer.files[0])
      }
    })
  }
}

let signatureImageData = null
let pdfBytes = null
let pdfFileName = ''
let pdfTotalPages = 0
let canvasHistory = []

export function initSignature() {
  initDrawCanvas()
  initUploadSignature()
  initSignatureLibrary()
  initPDFUpload()
  initTabs()
  initRangeInputs()
  
  document.getElementById('sig-close').addEventListener('click', () => {
    closeModal('signature')
    resetState()
  })
  
  document.getElementById('sig-apply-btn').addEventListener('click', applySignature)
}

function initTabs() {
  document.querySelectorAll('.signature-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.signature-tab').forEach(t => t.classList.remove('active'))
      tab.classList.add('active')
      
      const tabId = tab.dataset.tab
      document.querySelectorAll('.signature-panel').forEach(panel => {
        panel.style.display = 'none'
      })
      document.getElementById(tabId).style.display = 'block'
    })
  })
}

function initDrawCanvas() {
  const canvas = document.getElementById('signature-canvas')
  const ctx = canvas.getContext('2d')
  let isDrawing = false
  let lastX = 0
  let lastY = 0
  
  ctx.strokeStyle = '#000000'
  ctx.lineWidth = 3
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'
  
  canvas.addEventListener('mousedown', (e) => {
    isDrawing = true
    const rect = canvas.getBoundingClientRect()
    lastX = (e.clientX - rect.left) * (canvas.width / rect.width)
    lastY = (e.clientY - rect.top) * (canvas.height / rect.height)
  })
  
  canvas.addEventListener('mousemove', (e) => {
    if (!isDrawing) return
    const rect = canvas.getBoundingClientRect()
    const x = (e.clientX - rect.left) * (canvas.width / rect.width)
    const y = (e.clientY - rect.top) * (canvas.height / rect.height)
    
    ctx.beginPath()
    ctx.moveTo(lastX, lastY)
    ctx.lineTo(x, y)
    ctx.stroke()
    
    lastX = x
    lastY = y
  })
  
  canvas.addEventListener('mouseup', () => {
    if (isDrawing) {
      isDrawing = false
      saveCanvasState()
    }
  })
  
  canvas.addEventListener('mouseout', () => {
    isDrawing = false
  })
  
  document.getElementById('sig-clear-canvas').addEventListener('click', () => {
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    canvasHistory = []
  })
  
  document.getElementById('sig-undo').addEventListener('click', () => {
    if (canvasHistory.length > 0) {
      canvasHistory.pop()
      if (canvasHistory.length > 0) {
        const img = new Image()
        img.onload = () => {
          ctx.clearRect(0, 0, canvas.width, canvas.height)
          ctx.drawImage(img, 0, 0)
        }
        img.src = canvasHistory[canvasHistory.length - 1]
      } else {
        ctx.clearRect(0, 0, canvas.width, canvas.height)
      }
    }
  })
  
  document.getElementById('sig-save-to-library').addEventListener('click', () => {
    const dataURL = canvas.toDataURL('image/png')
    saveToLibrary(dataURL)
  })
}

function saveCanvasState() {
  const canvas = document.getElementById('signature-canvas')
  canvasHistory.push(canvas.toDataURL())
}

function initUploadSignature() {
  setupUploadZone('sig-upload-zone', 'sig-upload-file', handleSignatureUpload)
  
  document.getElementById('sig-save-upload-to-library').addEventListener('click', () => {
    if (signatureImageData) {
      saveToLibrary(signatureImageData)
    }
  })
}

function handleSignatureUpload(file) {
  if (!file || !file.type.startsWith('image/')) {
    showStatus('sig-status', '请上传图片文件', 'error')
    return
  }
  
  const reader = new FileReader()
  reader.onload = (e) => {
    signatureImageData = e.target.result
    document.getElementById('sig-preview-img').src = signatureImageData
    document.getElementById('sig-upload-preview').style.display = 'block'
    showStatus('sig-status', '签名图片已上传', 'success')
  }
  reader.readAsDataURL(file)
}

function initSignatureLibrary() {
  loadSignatureLibrary()
}

async function saveToLibrary(dataURL) {
  try {
    const db = await openSignatureDB()
    const tx = db.transaction('signatures', 'readwrite')
    const store = tx.objectStore('signatures')
    
    await store.add({
      id: Date.now(),
      image: dataURL,
      createdAt: new Date().toISOString()
    })
    
    showStatus('sig-status', '已保存到签名库', 'success')
    loadSignatureLibrary()
  } catch (error) {
    showStatus('sig-status', '保存失败：' + error.message, 'error')
  }
}

async function loadSignatureLibrary() {
  try {
    const db = await openSignatureDB()
    const tx = db.transaction('signatures', 'readonly')
    const store = tx.objectStore('signatures')
    const signatures = await store.getAll()
    
    const list = document.getElementById('sig-library-list')
    
    if (signatures.length === 0) {
      list.innerHTML = '<p style="color:var(--text-secondary);grid-column:1/-1;text-align:center;">暂无保存的签名</p>'
      return
    }
    
    list.innerHTML = signatures.map(sig => `
      <div class="sig-library-item" style="border:1px solid var(--border);border-radius:8px;padding:8px;cursor:pointer;position:relative;">
        <img src="${sig.image}" style="width:100%;border-radius:4px;">
        <button class="sig-delete-btn" data-id="${sig.id}" style="position:absolute;top:4px;right:4px;background:red;color:white;border:none;border-radius:50%;width:20px;height:20px;cursor:pointer;font-size:12px;">×</button>
      </div>
    `).join('')
    
    list.querySelectorAll('.sig-library-item').forEach(item => {
      item.addEventListener('click', (e) => {
        if (!e.target.classList.contains('sig-delete-btn')) {
          const img = item.querySelector('img')
          signatureImageData = img.src
          showStatus('sig-status', '已选择签名', 'success')
        }
      })
    })
    
    list.querySelectorAll('.sig-delete-btn').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        e.stopPropagation()
        const id = parseInt(btn.dataset.id)
        await deleteSignature(id)
      })
    })
  } catch (error) {
    console.error('加载签名库失败:', error)
  }
}

async function deleteSignature(id) {
  try {
    const db = await openSignatureDB()
    const tx = db.transaction('signatures', 'readwrite')
    const store = tx.objectStore('signatures')
    await store.delete(id)
    showStatus('sig-status', '已删除签名', 'success')
    loadSignatureLibrary()
  } catch (error) {
    showStatus('sig-status', '删除失败：' + error.message, 'error')
  }
}

function openSignatureDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('pdf-signatures', 1)
    
    request.onerror = () => reject(request.error)
    request.onsuccess = () => resolve(request.result)
    
    request.onupgradeneeded = (event) => {
      const db = event.target.result
      if (!db.objectStoreNames.contains('signatures')) {
        db.createObjectStore('signatures', { keyPath: 'id' })
      }
    }
  })
}

function initPDFUpload() {
  setupUploadZone('sig-pdf-upload', 'sig-pdf-file', handlePDFUpload)
}

async function handlePDFUpload(file) {
  if (!file || file.type !== 'application/pdf') {
    showStatus('sig-status', '请选择有效的 PDF 文件', 'error')
    return
  }
  
  try {
    const arrayBuffer = await file.arrayBuffer()
    pdfBytes = new Uint8Array(arrayBuffer)
    
    const pdfDoc = await PDFDocument.load(pdfBytes)
    pdfTotalPages = pdfDoc.getPageCount()
    pdfFileName = file.name.replace('.pdf', '')
    
    document.getElementById('sig-pdf-filename').textContent = file.name
    document.getElementById('sig-pdf-pages').textContent = `${pdfTotalPages} 页`
    document.getElementById('sig-pdf-card').style.display = 'block'
    document.getElementById('sig-apply-btn').disabled = false
    
    showStatus('sig-status', '', 'success')
  } catch (error) {
    showStatus('sig-status', '加载失败：' + error.message, 'error')
  }
}

function initRangeInputs() {
  const ranges = ['sig-x', 'sig-y', 'sig-scale']
  ranges.forEach(id => {
    const input = document.getElementById(id)
    const display = document.getElementById(id + '-val')
    input.addEventListener('input', (e) => {
      display.textContent = id === 'sig-scale' ? e.target.value + '%' : e.target.value
    })
  })
}

async function applySignature() {
  if (!signatureImageData) {
    showStatus('sig-status', '请先创建或选择签名', 'error')
    return
  }
  
  if (!pdfBytes) {
    showStatus('sig-status', '请先上传 PDF 文件', 'error')
    return
  }
  
  showStatus('sig-status', '正在添加签名...', 'info')
  
  try {
    const pdfDoc = await PDFDocument.load(pdfBytes)
    const pageNumber = parseInt(document.getElementById('sig-page').value) - 1
    const x = parseInt(document.getElementById('sig-x').value)
    const y = parseInt(document.getElementById('sig-y').value)
    const scale = parseInt(document.getElementById('sig-scale').value) / 100
    
    const page = pdfDoc.getPage(pageNumber)
    const { width, height } = page.getSize()
    
    const imageBytes = Uint8Array.from(atob(signatureImageData.split(',')[1]), c => c.charCodeAt(0))
    
    let embeddedImage
    if (signatureImageData.includes('image/png')) {
      embeddedImage = await pdfDoc.embedPng(imageBytes)
    } else {
      embeddedImage = await pdfDoc.embedJpg(imageBytes)
    }
    
    const imgDims = embeddedImage.scale(scale)
    
    page.drawImage(embeddedImage, {
      x: x,
      y: height - y - imgDims.height,
      width: imgDims.width,
      height: imgDims.height,
    })
    
    const bytes = await pdfDoc.save()
    const blob = new Blob([bytes], { type: 'application/pdf' })
    downloadBlob(blob, `${pdfFileName}_已签名.pdf`)
    
    showStatus('sig-status', '签名添加成功！', 'success')
  } catch (error) {
    showStatus('sig-status', '添加失败：' + error.message, 'error')
    console.error(error)
  }
}

function resetState() {
  signatureImageData = null
  pdfBytes = null
  pdfFileName = ''
  pdfTotalPages = 0
  canvasHistory = []
  
  const canvas = document.getElementById('signature-canvas')
  const ctx = canvas.getContext('2d')
  ctx.clearRect(0, 0, canvas.width, canvas.height)
  
  document.getElementById('sig-pdf-card').style.display = 'none'
  document.getElementById('sig-upload-preview').style.display = 'none'
  document.getElementById('sig-status').innerHTML = ''
}
