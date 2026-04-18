/**
 * pipeline-ui/steps-builder.js - 从 UI 构建 Pipeline 步骤
 */

export function buildStepsFromUI(
  checkedSteps,
  statusEl,
  showError,
  pdfPageCount
) {
  const steps = []

  for (const cb of checkedSteps) {
    const stepType = cb.dataset.step

    if (stepType === 'compress') {
      steps.push({ type: 'compress' })
    } else if (stepType === 'watermark') {
      const text = document.getElementById('pipeline-wm-text').value.trim()
      if (!text) {
        showError(statusEl, '⚠️ 请输入水印文字')
        return null
      }
      const wmFontSizeRange = document.getElementById('pipeline-wm-fontsize')
      const wmOpacityRange = document.getElementById('pipeline-wm-opacity')
      const fontSize = parseInt(wmFontSizeRange.value, 10)
      const opacity = parseInt(wmOpacityRange.value, 10) / 100
      const position = document.querySelector('input[name="pipeline-wm-position"]:checked').value

      steps.push({
        type: 'watermark',
        mode: 'text',
        text,
        fontSize,
        opacity,
        position,
      })
    } else if (stepType === 'stripJS') {
      steps.push({ type: 'stripJS' })
    } else if (stepType === 'metadata') {
      const title = document.getElementById('pipeline-md-title').value.trim()
      const author = document.getElementById('pipeline-md-author').value.trim()
      const subject = document.getElementById('pipeline-md-subject').value.trim()
      const keywords = document.getElementById('pipeline-md-keywords').value.trim()

      if (!title && !author && !subject && !keywords) {
        showError(statusEl, '⚠️ 请至少填写一个元数据字段')
        return null
      }

      steps.push({
        type: 'metadata',
        title,
        author,
        subject,
        keywords,
      })
    } else if (stepType === 'merge') {
      // mergeExtraFiles should be passed in from UI state
      const mergeExtraFiles = window._pipelineMergeExtraFiles || []
      if (mergeExtraFiles.length === 0) {
        showError(statusEl, '⚠️ 合并步骤需要上传至少一个额外的 PDF 文件')
        return null
      }
      steps.push({
        type: 'merge',
        extraFiles: mergeExtraFiles,
      })
    } else if (stepType === 'split') {
      const range = document.getElementById('pipeline-split-range').value.trim()
      if (!range) {
        showError(statusEl, '⚠️ 请输入页码范围（如 1-3,5,8-10）')
        return null
      }
      steps.push({
        type: 'split',
        range,
        totalPages: pdfPageCount,
      })
    }
  }

  return steps
}
