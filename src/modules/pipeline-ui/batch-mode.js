/**
 * pipeline-ui/batch-mode.js - 批量模式逻辑
 */

import { runBatchPipeline, BATCH_MAX_FILE_SIZE, BATCH_MAX_COUNT } from '../batch-pipeline.js'
import {
  formatSize,
  showStatus,
  showProcessing,
  showSuccess,
  showError,
  clearStatus,
  downloadBlob,
  highlightUploadZone,
  resetUploadZone,
  trackEvent,
  cleanupResources,
} from '../../utils.js'
import { escapeHtml } from '../../utils/core.js'

export function initBatchMode(
  batchSwitch,
  batchHint,
  batchUploadZone,
  batchFileInput,
  batchFileList,
  batchCount,
  batchClearBtn,
  batchList,
  batchResult,
  batchSummary,
  batchDownloadBtn,
  singleInfo,
  pipelineCard,
  runBtn,
  statusEl,
  downloadSection,
  onBuildSteps
) {
  let batchFiles = []
  let batchZipBlob = null

  // 批量上传
  if (batchUploadZone && batchFileInput) {
    batchUploadZone.addEventListener('click', () => batchFileInput.click())
    batchFileInput.addEventListener('change', () => {
      if (batchFileInput.files.length > 0) handleBatchFiles(Array.from(batchFileInput.files))
    })

    batchUploadZone.addEventListener('dragover', e => {
      e.preventDefault()
      batchUploadZone.classList.add('dragover')
    })
    batchUploadZone.addEventListener('dragleave', () => batchUploadZone.classList.remove('dragover'))
    batchUploadZone.addEventListener('drop', e => {
      e.preventDefault()
      batchUploadZone.classList.remove('dragover')
      if (e.dataTransfer.files.length > 0) {
        handleBatchFiles(Array.from(e.dataTransfer.files))
      }
    })
  }

  // 模式切换
  if (batchSwitch) {
    batchSwitch.addEventListener('change', () => {
      const isBatchMode = batchSwitch.checked
      batchHint.style.display = isBatchMode ? 'inline' : 'none'
      const singleUploadZone = document.getElementById('pipeline-upload')
      const singleFileInput = document.getElementById('pipeline-file')
      if (singleUploadZone) singleUploadZone.style.display = isBatchMode ? 'none' : ''
      if (singleFileInput) singleFileInput.style.display = isBatchMode ? 'none' : ''
      batchUploadZone.style.display = isBatchMode ? '' : 'none'
      batchFileInput.style.display = isBatchMode ? '' : 'none'

      batchFiles = []
      batchZipBlob = null
      pipelineCard.style.display = 'none'
      downloadSection.style.display = 'none'
      batchResult.style.display = 'none'
      batchFileList.style.display = 'none'
      singleInfo.style.display = 'none'
      clearStatus(statusEl)
    })
  }

  function handleBatchFiles(files) {
    if (files.length > BATCH_MAX_COUNT) {
      showError(statusEl, `⚠️ 文件数量过多（${files.length} 个），最多支持 ${BATCH_MAX_COUNT} 个`)
      return
    }

    clearStatus(statusEl)
    downloadSection.style.display = 'none'
    batchResult.style.display = 'none'
    batchZipBlob = null

    const existingNames = new Set(batchFiles.map(f => f.name))
    let added = 0
    let skipped = 0

    for (const file of files) {
      if (file.type !== 'application/pdf') {
        skipped++
        continue
      }
      if (file.size > BATCH_MAX_FILE_SIZE) {
        skipped++
        continue
      }
      if (existingNames.has(file.name)) {
        skipped++
        continue
      }

      if (batchFiles.length >= BATCH_MAX_COUNT) {
        break
      }

      batchFiles.push(file)
      existingNames.add(file.name)
      added++
    }

    renderBatchFileList()

    if (batchFiles.length > 0) {
      highlightUploadZone(batchUploadZone)
    } else {
      resetUploadZone(batchUploadZone)
    }

    if (added > 0) {
      clearStatus(statusEl)
    }
    if (skipped > 0) {
      showStatus(statusEl, `ℹ️ 已添加 ${added} 个文件，跳过 ${skipped} 个（非 PDF 或超限或重复）`, 'info')
    }

    updateBatchRunState()
  }

  function renderBatchFileList() {
    if (batchFiles.length === 0) {
      batchFileList.style.display = 'none'
      pipelineCard.style.display = 'none'
      return
    }

    batchFileList.style.display = 'block'
    pipelineCard.style.display = 'block'
    batchCount.textContent = `${batchFiles.length} 个文件（总 ${formatSize(batchFiles.reduce((s, f) => s + f.size, 0))}）`

    batchList.innerHTML = batchFiles.map(f => `
      <div class="batch-file-item" data-name="${escapeHtml(f.name)}">
        <span class="batch-file-name" title="${escapeHtml(f.name)}">${escapeHtml(f.name)}</span>
        <span class="batch-file-size">${formatSize(f.size)}</span>
        <span class="batch-file-status"></span>
      </div>
    `).join('')
  }

  function updateBatchRunState() {
    const checks = document.querySelectorAll('.pipeline-step-check:checked')
    runBtn.disabled = batchFiles.length === 0 || checks.length === 0
  }

  if (batchClearBtn) {
    batchClearBtn.addEventListener('click', () => {
      batchFiles = []
      batchZipBlob = null
      batchFileInput.value = ''
      renderBatchFileList()
      resetUploadZone(batchUploadZone)
      clearStatus(statusEl)
      downloadSection.style.display = 'none'
      batchResult.style.display = 'none'
      runBtn.disabled = true
    })
  }

  // 运行批处理
  if (runBtn) {
    runBtn.addEventListener('click', async () => {
      if (!batchSwitch || !batchSwitch.checked) return

      const steps = onBuildSteps()
      if (!steps) return
      if (steps.length === 0) {
        showError(statusEl, '⚠️ 请至少选择一个处理步骤')
        return
      }

      await runBatch(steps)
    })
  }

  async function runBatch(steps) {
    if (batchFiles.length === 0) return

    runBtn.disabled = true
    downloadSection.style.display = 'none'
    batchResult.style.display = 'none'
    batchZipBlob = null

    const startTime = performance.now()
    const totalFiles = batchFiles.length
    const totalOriginalSize = batchFiles.reduce((s, f) => s + f.size, 0)

    try {
      showProcessing(statusEl, `正在批量处理 ${totalFiles} 个文件...`)

      const result = await runBatchPipeline(batchFiles, steps, {
        onFileProgress: (fileIndex, total, fileName) => {
          const progressText = statusEl.querySelector('.progress-text')
          if (progressText) {
            progressText.textContent = `📄 处理文件 (${fileIndex + 1}/${total}): ${fileName}`
          }
          updateFileStatus(fileIndex, 'processing')
        },
        onStepProgress: (fileIndex, stepCompleted, totalSteps, stepName) => {
          const stepNames = {
            compress: '压缩', watermark: '水印', stripJS: '剥离 JS',
            metadata: '元数据', merge: '合并', split: '拆分',
          }
          const label = stepNames[stepName] || stepName
          const progressText = statusEl.querySelector('.progress-text')
          if (progressText) {
            progressText.textContent = `📄 ${fileIndex + 1}/${totalFiles} - ${label} (${stepCompleted}/${totalSteps})`
          }
        },
      })

      const duration = performance.now() - startTime
      batchZipBlob = result.zipBlob

      result.successFiles.forEach(sf => {
        const idx = batchFiles.findIndex(f => f.name === sf.name)
        if (idx >= 0) updateFileStatus(idx, 'success')
      })
      result.failFiles.forEach(ff => {
        const idx = batchFiles.findIndex(f => f.name === ff.name)
        if (idx >= 0) updateFileStatus(idx, 'fail', ff.error)
      })

      if (result.successCount > 0) {
        showSuccess(statusEl, `✅ 批量处理完成，${result.successCount} 成功 / ${result.failCount} 失败，耗时 ${(duration / 1000).toFixed(1)} 秒`)

        let summaryHtml = `
          <div class="batch-result-row">
            <span class="label">📁 总文件数</span>
            <span class="value">${totalFiles}</span>
          </div>
          <div class="batch-result-row">
            <span class="label">✅ 成功</span>
            <span class="value success">${result.successCount}</span>
          </div>
          <div class="batch-result-row">
            <span class="label">❌ 失败</span>
            <span class="value fail">${result.failCount}</span>
          </div>
          <div class="batch-result-row">
            <span class="label">📏 总输入大小</span>
            <span class="value">${formatSize(totalOriginalSize)}</span>
          </div>
          <div class="batch-result-row">
            <span class="label">📦 ZIP 大小</span>
            <span class="value">${formatSize(result.zipBlob.size)}</span>
          </div>
        `

        if (result.failFiles.length > 0) {
          summaryHtml += '<div class="batch-result-divider"></div>'
          summaryHtml += '<div class="batch-fail-details"><strong>失败详情：</strong>'
          result.failFiles.forEach(ff => {
            summaryHtml += `<div class="batch-fail-item">❌ ${escapeHtml(ff.name)}: ${escapeHtml(ff.error)}</div>`
          })
          summaryHtml += '</div>'
        }

        batchSummary.innerHTML = summaryHtml
        batchResult.style.display = 'block'

        trackEvent('batch_pipeline_completed', {
          totalFiles,
          successCount: result.successCount,
          failCount: result.failCount,
          totalOriginalSize,
          zipSize: result.zipBlob.size,
          duration,
        })
      } else {
        showError(statusEl, '❌ 所有文件处理失败，请检查文件格式')
      }
    } catch (err) {
      console.error('[BatchPipeline] 执行失败:', err)
      showError(statusEl, '❌ 批量处理失败：' + err.message)
    } finally {
      runBtn.disabled = false
    }
  }

  function updateFileStatus(index, status, errorMsg) {
    const items = batchList.querySelectorAll('.batch-file-item')
    if (items[index]) {
      const statusEl2 = items[index].querySelector('.batch-file-status')
      if (status === 'processing') {
        statusEl2.textContent = '⏳'
        statusEl2.className = 'batch-file-status'
      } else if (status === 'success') {
        statusEl2.textContent = '✅'
        statusEl2.className = 'batch-file-status success'
      } else if (status === 'fail') {
        statusEl2.textContent = '❌'
        statusEl2.className = 'batch-file-status fail'
        statusEl2.title = errorMsg || ''
      }
    }
  }

  // 批量下载
  if (batchDownloadBtn) {
    batchDownloadBtn.addEventListener('click', () => {
      if (!batchZipBlob) return
      downloadBlob(batchZipBlob, 'pdf_toolbox_batch.zip', true)
      cleanupResources()
    })
  }

  return {
    updateBatchRunState,
    get isBatchMode() { return batchSwitch?.checked || false },
    get batchFiles() { return batchFiles }
  }
}
