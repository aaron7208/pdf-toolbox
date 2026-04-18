/**
 * merge.js - PDF 合并模块（增强版，带进度条）
 */

import * as PDFLib from 'pdf-lib'
import { state } from '../state.js'
import { formatSize, showStatus, showProgress, showProcessing, showReport, clearStatus, downloadBlob, MAX_FILE_SIZE, checkFileSize, trackEvent, highlightUploadZone, resetUploadZone, cleanupResources } from '../utils.js'

export function initMerge() {
  const uploadZone = document.getElementById('merge-upload')
  const fileInput = document.getElementById('merge-files')
  const list = document.getElementById('merge-list')
  const mergeBtn = document.getElementById('merge-btn')
  const clearBtn = document.getElementById('merge-clear')
  const status = document.getElementById('merge-status')

  uploadZone.addEventListener('click', () => fileInput.click())
  uploadZone.addEventListener('dragover', e => {
    e.preventDefault()
    uploadZone.classList.add('dragover')
  })
  uploadZone.addEventListener('dragleave', () => uploadZone.classList.remove('dragover'))
  uploadZone.addEventListener('drop', e => {
    e.preventDefault()
    uploadZone.classList.remove('dragover')
    addMergeFiles(e.dataTransfer.files)
  })
  fileInput.addEventListener('change', () => {
    addMergeFiles(fileInput.files)
    fileInput.value = ''
  })

  function addMergeFiles(files) {
    let skipped = false
    for (const f of files) {
      if (f.type === 'application/pdf' || f.name.endsWith('.pdf')) {
        if (f.size > MAX_FILE_SIZE) {
          showStatus(status, `⚠️ 文件 "${escapeHtml(f.name)}" 过大（${formatSize(f.size)}），建议不超过 50MB，已跳过`, 'warning')
          skipped = true
        } else {
          state.merge.files.push(f)
          trackEvent('file_uploaded', { function: 'merge', name: f.name, size: f.size })
        }
      }
    }
    if (!skipped) clearStatus(status)
    renderMergeList()
  }

  function renderMergeList() {
    list.innerHTML = ''
    state.merge.files.forEach((f, i) => {
      const div = document.createElement('div')
      div.className = 'file-item'
      div.innerHTML = `
        <span>📄</span>
        <span class="name" title="${escapeHtml(f.name)}">${escapeHtml(f.name)}</span>
        <span class="size">${formatSize(f.size)}</span>
        <button class="btn btn-outline btn-sm" onclick="window._mergeMove(${i},-1)" ${i === 0 ? 'disabled' : ''}>↑</button>
        <button class="btn btn-outline btn-sm" onclick="window._mergeMove(${i},1)" ${i === state.merge.files.length - 1 ? 'disabled' : ''}>↓</button>
        <button class="remove" onclick="window._mergeRemove(${i})">✕</button>
      `
      list.appendChild(div)
    })
    mergeBtn.disabled = state.merge.files.length < 2
    clearBtn.style.display = state.merge.files.length > 0 ? '' : 'none'

    // Highlight upload zone when files are added
    if (state.merge.files.length > 0) {
      highlightUploadZone(uploadZone)
    } else {
      resetUploadZone(uploadZone)
    }
  }

  function escapeHtml(str) {
    return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
  }

  window._mergeRemove = function (i) {
    state.merge.files.splice(i, 1)
    renderMergeList()
  }

  window._mergeMove = function (i, dir) {
    const j = i + dir
    if (j >= 0 && j < state.merge.files.length) {
      [state.merge.files[i], state.merge.files[j]] = [state.merge.files[j], state.merge.files[i]]
      renderMergeList()
    }
  }

  clearBtn.addEventListener('click', () => {
    state.merge.files = []
    renderMergeList()
    clearStatus(status)
  })

  mergeBtn.addEventListener('click', async () => {
    if (state.merge.files.length < 2) return
    try {
      const total = state.merge.files.length
      showProcessing(status, `正在合并 ${total} 个文件...`, 10)
      mergeBtn.disabled = true
      const startTime = performance.now()
      const totalInputSize = state.merge.files.reduce((sum, f) => sum + f.size, 0)

      const merged = await PDFLib.PDFDocument.create()
      let totalPages = 0
      const errors = []

      for (let i = 0; i < state.merge.files.length; i++) {
        const f = state.merge.files[i]
        const progress = Math.round(((i + 1) / total) * 80) + 10
        showProcessing(status, `正在处理 ${i + 1}/${total}: ${escapeHtml(f.name)}`, progress)

        try {
          const bytes = await f.arrayBuffer()
          const doc = await PDFLib.PDFDocument.load(new Uint8Array(bytes), { ignoreEncryption: false })
          const pages = await merged.copyPages(doc, doc.getPageIndices())
          pages.forEach(p => merged.addPage(p))
          totalPages += doc.getPageCount()
        } catch (fileErr) {
          if (fileErr.message.includes('encrypted') || fileErr.message.includes('password')) {
            errors.push(`"${f.name}" 已加密，跳过`)
          } else if (fileErr.message.includes('parse') || fileErr.message.includes('corrupt')) {
            errors.push(`"${f.name}" 文件损坏，跳过`)
          } else {
            errors.push(`"${f.name}" 无法读取：${fileErr.message}`)
          }
        }
      }

      if (totalPages === 0) {
        showStatus(status, '❌ 无法合并：没有可读取的 PDF 文件' + (errors.length > 0 ? '\n' + errors.join('\n') : ''), 'error')
        mergeBtn.disabled = false
        return
      }

      showProcessing(status, '正在生成文件...', 95)
      const pdfBytes = await merged.save()
      const outputBlob = new Blob([pdfBytes], { type: 'application/pdf' })
      downloadBlob(outputBlob, 'merged.pdf', true)
      cleanupResources()
      trackEvent('file_downloaded', { function: 'merge', pages: totalPages, size: pdfBytes.length })

      showProcessing(status, '即将完成...', 100)

      let msg = `合并完成！共 ${totalPages} 页，${formatSize(pdfBytes.length)}，已下载 merged.pdf`
      if (errors.length > 0) {
        msg += '\n⚠️ ' + errors.join('；')
      }
      const duration = performance.now() - startTime
      // 短暂延迟后显示成功状态
      setTimeout(() => {
        showStatus(status, '✅ ' + msg.replace(/\n/g, '<br>'), 'success')
        showReport(status, {
          fileName: 'merged.pdf',
          originalSize: totalInputSize,
          processedSize: pdfBytes.length,
          pageCount: totalPages,
          duration,
        })
      }, 300)
    } catch (err) {
      showStatus(status, '❌ 合并失败: ' + err.message, 'error')
    }
    mergeBtn.disabled = false
  })
}
