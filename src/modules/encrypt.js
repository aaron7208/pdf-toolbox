/**
 * encrypt.js - PDF 加密/解密模块
 * 
 * 功能：
 * - 为 PDF 添加密码保护
 * - 移除现有密码（需提供原密码）
 * - 设置权限密码（禁止打印/复制/编辑）
 */

import { showStatus, downloadBlob, resetUploadZone } from '../utils.js'
import { PDFDocument } from 'pdf-lib'

let encryptPdfBytes = null
let encryptFileName = ''

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

export function initEncrypt() {
  setupUploadZone('encrypt-upload', 'encrypt-file', handleEncryptFileSelect)
  setupUploadZone('decrypt-upload', 'decrypt-file', handleDecryptFileSelect)
  
  const encryptBtn = document.getElementById('encrypt-btn')
  const decryptBtn = document.getElementById('decrypt-btn')
  const encryptClose = document.getElementById('encrypt-close')
  const decryptClose = document.getElementById('decrypt-close')
  
  if (encryptBtn) encryptBtn.addEventListener('click', encryptPdf)
  if (decryptBtn) decryptBtn.addEventListener('click', decryptPdf)
  if (encryptClose) encryptClose.addEventListener('click', () => {
    closeModal('encrypt')
    resetEncryptState()
  })
  if (decryptClose) decryptClose.addEventListener('click', () => {
    closeModal('encrypt')
    resetDecryptState()
  })
  
  document.querySelectorAll('.encrypt-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.encrypt-tab').forEach(t => t.classList.remove('active'))
      tab.classList.add('active')
      
      const tabId = tab.dataset.tab
      document.querySelectorAll('.encrypt-panel').forEach(panel => {
        panel.style.display = 'none'
      })
      const panel = document.getElementById(tabId)
      if (panel) panel.style.display = 'block'
    })
  })
}

async function handleEncryptFileSelect(file) {
  if (!file || file.type !== 'application/pdf') {
    showStatus('encrypt-status', '请选择有效的 PDF 文件', 'error')
    return
  }

  try {
    const arrayBuffer = await file.arrayBuffer()
    encryptPdfBytes = new Uint8Array(arrayBuffer)
    
    const pdfDoc = await PDFDocument.load(encryptPdfBytes)
    const totalPages = pdfDoc.getPageCount()
    
    encryptFileName = file.name.replace('.pdf', '')
    
    document.getElementById('encrypt-filename').textContent = file.name
    document.getElementById('encrypt-pages').textContent = `${totalPages} 页`
    document.getElementById('encrypt-card').style.display = 'block'
    document.getElementById('encrypt-btn').disabled = false
    
    showStatus('encrypt-status', '', 'success')
  } catch (error) {
    showStatus('encrypt-status', '加载失败：' + error.message, 'error')
    console.error(error)
  }
}

async function encryptPdf() {
  const userPassword = document.getElementById('encrypt-user-password').value
  const ownerPassword = document.getElementById('encrypt-owner-password').value
  
  if (!userPassword) {
    showStatus('encrypt-status', '请输入用户密码', 'error')
    return
  }

  showStatus('encrypt-status', '正在加密...', 'info')
  
  try {
    const pdfDoc = await PDFDocument.load(encryptPdfBytes)
    
    const allowPrinting = document.getElementById('encrypt-allow-printing').checked
    const allowCopying = document.getElementById('encrypt-allow-copying').checked
    const allowModifying = document.getElementById('encrypt-allow-modifying').checked
    
    const encryptedBytes = await pdfDoc.save({
      userPassword: userPassword,
      ownerPassword: ownerPassword || userPassword,
      permissions: {
        printing: allowPrinting ? 'highResolution' : 'none',
        copying: allowCopying,
        modifying: allowModifying,
      }
    })
    
    const blob = new Blob([encryptedBytes], { type: 'application/pdf' })
    downloadBlob(blob, `${encryptFileName}_已加密.pdf`)
    
    showStatus('encrypt-status', '加密成功！', 'success')
  } catch (error) {
    showStatus('encrypt-status', '加密失败：' + error.message, 'error')
    console.error(error)
  }
}

async function handleDecryptFileSelect(file) {
  if (!file || file.type !== 'application/pdf') {
    showStatus('decrypt-status', '请选择有效的 PDF 文件', 'error')
    return
  }

  try {
    const arrayBuffer = await file.arrayBuffer()
    const pdfBytes = new Uint8Array(arrayBuffer)
    
    document.getElementById('decrypt-filename').textContent = file.name
    document.getElementById('decrypt-card').style.display = 'block'
    document.getElementById('decrypt-btn').disabled = false
    
    window.__decryptPdfBytes = pdfBytes
    showStatus('decrypt-status', '', 'success')
  } catch (error) {
    showStatus('decrypt-status', '加载失败：' + error.message, 'error')
    console.error(error)
  }
}

async function decryptPdf() {
  const password = document.getElementById('decrypt-password').value
  
  if (!password) {
    showStatus('decrypt-status', '请输入密码', 'error')
    return
  }

  showStatus('decrypt-status', '正在解密...', 'info')
  
  try {
    const pdfDoc = await PDFDocument.load(window.__decryptPdfBytes, {
      password: password
    })
    
    const decryptedBytes = await pdfDoc.save()
    const blob = new Blob([decryptedBytes], { type: 'application/pdf' })
    
    const fileName = document.getElementById('decrypt-filename').textContent.replace('.pdf', '')
    downloadBlob(blob, `${fileName}_已解密.pdf`)
    
    showStatus('decrypt-status', '解密成功！', 'success')
  } catch (error) {
    if (error.message.includes('password') || error.message.includes('Password')) {
      showStatus('decrypt-status', '密码错误，请重试', 'error')
    } else {
      showStatus('decrypt-status', '解密失败：' + error.message, 'error')
    }
    console.error(error)
  }
}

function resetEncryptState() {
  encryptPdfBytes = null
  encryptFileName = ''
  document.getElementById('encrypt-card').style.display = 'none'
  document.getElementById('encrypt-status').innerHTML = ''
  document.getElementById('encrypt-user-password').value = ''
  document.getElementById('encrypt-owner-password').value = ''
}

function resetDecryptState() {
  window.__decryptPdfBytes = null
  document.getElementById('decrypt-card').style.display = 'none'
  document.getElementById('decrypt-status').innerHTML = ''
  document.getElementById('decrypt-password').value = ''
}
