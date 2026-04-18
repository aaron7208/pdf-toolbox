/**
 * pipeline-ui/merge-handler.js - 合并步骤文件上传管理
 */

import { formatSize } from '../../utils/core.js'
import { escapeHtml } from '../../modules/common/string-utils.js'

export function initMergeHandler() {
  const mergeUploadZone = document.getElementById('pipeline-merge-upload-zone')
  const mergeFileInput = document.getElementById('pipeline-merge-files')
  const mergeFileList = document.getElementById('pipeline-merge-file-list')

  let mergeExtraFiles = []

  if (mergeUploadZone && mergeFileInput) {
    mergeUploadZone.addEventListener('click', () => mergeFileInput.click())

    mergeUploadZone.addEventListener('dragover', e => {
      e.preventDefault()
      mergeUploadZone.style.borderColor = '#4a90d9'
    })
    mergeUploadZone.addEventListener('dragleave', () => {
      mergeUploadZone.style.borderColor = '#ccc'
    })
    mergeUploadZone.addEventListener('drop', e => {
      e.preventDefault()
      mergeUploadZone.style.borderColor = '#ccc'
      if (e.dataTransfer.files.length > 0) {
        addMergeExtraFiles(e.dataTransfer.files)
      }
    })

    mergeFileInput.addEventListener('change', () => {
      if (mergeFileInput.files.length > 0) {
        addMergeExtraFiles(mergeFileInput.files)
        mergeFileInput.value = ''
      }
    })
  }

  function addMergeExtraFiles(files) {
    for (const f of files) {
      if (f.type === 'application/pdf' || f.name.endsWith('.pdf')) {
        mergeExtraFiles.push(f)
      }
    }
    renderMergeFileList()
  }

  function renderMergeFileList() {
    if (!mergeFileList) return
    if (mergeExtraFiles.length === 0) {
      mergeFileList.innerHTML = ''
      return
    }
    mergeFileList.innerHTML = mergeExtraFiles.map((f, i) => `
      <div style="display:flex;align-items:center;gap:8px;padding:4px 0;font-size:0.875rem;">
        <span>📄</span>
        <span style="flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;" title="${escapeHtml(f.name)}">${escapeHtml(f.name)}</span>
        <span style="color:#999;font-size:0.75rem;">${formatSize(f.size)}</span>
        <button class="merge-remove-btn" data-index="${i}" style="background:none;border:none;cursor:pointer;color:#e74c3c;font-size:1rem;line-height:1;">✕</button>
      </div>
    `).join('')

    mergeFileList.querySelectorAll('.merge-remove-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const idx = parseInt(btn.dataset.index, 10)
        mergeExtraFiles.splice(idx, 1)
        renderMergeFileList()
      })
    })
  }

  // 暴露给全局供 steps-builder 访问
  window._pipelineMergeExtraFiles = mergeExtraFiles

  return {
    getExtraFiles: () => mergeExtraFiles,
    reset: () => {
      mergeExtraFiles = []
      window._pipelineMergeExtraFiles = []
      renderMergeFileList()
    }
  }
}
