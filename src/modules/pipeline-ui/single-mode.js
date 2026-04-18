/**
 * pipeline-ui/single-mode.js - 单文件模式逻辑
 */

import { runPipeline } from '../pipeline.js'
import { buildStepsFromUI } from './steps-builder.js'
import {
  formatSize,
  showStatus,
  showProcessing,
  showSuccess,
  showError,
  clearStatus,
  downloadBlob,
  checkFileSize,
  trackEvent,
  showUploadFileInfo,
  resetUploadZone,
  cleanupResources,
} from '../../utils.js'

export function initSingleMode(
  uploadZone,
  fileInput,
  pipelineCard,
  runBtn,
  statusEl,
  downloadSection,
  downloadBtn,
  singleInfo,
  templateManager,
  stepConfig,
  onBuildSteps
) {
  let uploadedFile = null
  let resultBytes = null
  let pdfPageCount = 0

  // Lazy import PDF.js
  let pdfjsLib = null
  async function getPdfjs() {
    if (!pdfjsLib) {
      pdfjsLib = await import('pdfjs-dist')
    }
    return pdfjsLib
  }

  // 文件上传处理
  if (uploadZone && fileInput) {
    uploadZone.addEventListener('click', () => fileInput.click())
    fileInput.addEventListener('change', () => {
      if (fileInput.files.length > 0) handleFile(fileInput.files[0])
    })

    uploadZone.addEventListener('dragover', e => {
      e.preventDefault()
      uploadZone.classList.add('dragover')
    })
    uploadZone.addEventListener('dragleave', () => uploadZone.classList.remove('dragover'))
    uploadZone.addEventListener('drop', e => {
      e.preventDefault()
      uploadZone.classList.remove('dragover')
      if (e.dataTransfer.files.length > 0) {
        fileInput.files = e.dataTransfer.files
        handleFile(e.dataTransfer.files[0])
      }
    })
  }

  async function handleFile(file) {
    if (file.type !== 'application/pdf') {
      clearStatus(statusEl)
      showError(statusEl, '⚠️ 请选择 PDF 文件')
      return
    }
    if (!checkFileSize(file, statusEl)) return

    uploadedFile = file
    resultBytes = null
    downloadSection.style.display = 'none'
    clearStatus(statusEl)

    showUploadFileInfo(uploadZone, file)

    document.getElementById('pipeline-filename').textContent = file.name
    document.getElementById('pipeline-filesize').textContent = formatSize(file.size)
    singleInfo.style.display = 'block'
    pipelineCard.style.display = 'block'
    runBtn.disabled = false

    try {
      const lib = await getPdfjs()
      const arrayBuffer = await file.arrayBuffer()
      const pdfDoc = await lib.getDocument({ data: new Uint8Array(arrayBuffer) }).promise
      pdfPageCount = pdfDoc.numPages
      document.getElementById('pipeline-pages').textContent = pdfPageCount + ' 页'

      const splitRangeInput = document.getElementById('pipeline-split-range')
      if (splitRangeInput && pdfPageCount > 0) {
        splitRangeInput.placeholder = `例如: 1-${Math.min(3, pdfPageCount)},${pdfPageCount}`
      }
      trackEvent('file_uploaded', { feature: 'pipeline', size: file.size, pages: pdfPageCount })
    } catch (err) {
      console.warn('[Pipeline] 获取页数失败:', err)
      document.getElementById('pipeline-pages').textContent = '-'
    }
  }

  // 运行按钮
  if (runBtn) {
    runBtn.addEventListener('click', async () => {
      const steps = onBuildSteps()
      if (!steps) return
      if (steps.length === 0) {
        showError(statusEl, '⚠️ 请至少选择一个处理步骤')
        return
      }
      await runSingle(steps)
    })
  }

  // 单文件处理
  async function runSingle(steps) {
    if (!uploadedFile) return

    runBtn.disabled = true
    downloadSection.style.display = 'none'
    resultBytes = null

    const startTime = performance.now()
    const originalSize = uploadedFile.size

    try {
      showProcessing(statusEl, `正在处理 ${steps.length} 个步骤...`)

      resultBytes = await runPipeline(
        await uploadedFile.arrayBuffer(),
        steps,
        (completed, total, name) => {
          const progressText = statusEl.querySelector('.progress-text')
          if (progressText) {
            const stepNames = {
              compress: '压缩', watermark: '水印', stripJS: '剥离 JS',
              metadata: '元数据', merge: '合并', split: '拆分',
            }
            const label = stepNames[name] || name
            progressText.textContent = `✅ ${label} 完成 (${completed}/${total})`
          }
        },
      )

      const duration = performance.now() - startTime

      showSuccess(statusEl, `✅ ${steps.length} 个步骤处理完成，耗时 ${(duration / 1000).toFixed(1)} 秒`)

      downloadSection.style.display = 'block'

      trackEvent('pipeline_completed', {
        steps: steps.length,
        originalSize,
        processedSize: resultBytes.length,
        duration,
      })
    } catch (err) {
      console.error('[Pipeline] 执行失败:', err)
      showError(statusEl, '❌ 处理失败：' + err.message)
    } finally {
      runBtn.disabled = false
    }
  }

  // 下载
  if (downloadBtn) {
    downloadBtn.addEventListener('click', () => {
      if (!resultBytes || !uploadedFile) return
      const baseName = uploadedFile.name.replace(/\.pdf$/i, '')
      const filename = baseName + '_workflow.pdf'
      downloadBlob(new Blob([resultBytes], { type: 'application/pdf' }), filename, true)
      cleanupResources()
    })
  }

  // 关闭按钮
  const closeBtn = document.getElementById('pipeline-close')
  if (closeBtn) {
    closeBtn.addEventListener('click', () => {
      resetUploadZone(uploadZone)
      if (typeof window.closeModal === 'function') {
        window.closeModal('pipeline')
      }
    })
  }

  // 暴露重置方法供批量模式切换时调用
  return {
    reset: () => {
      uploadedFile = null
      resultBytes = null
      pipelineCard.style.display = 'none'
      downloadSection.style.display = 'none'
      singleInfo.style.display = 'none'
      clearStatus(statusEl)
    },
    getPageCount: () => pdfPageCount
  }
}
