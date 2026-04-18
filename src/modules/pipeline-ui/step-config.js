/**
 * pipeline-ui/step-config.js - 步骤配置 UI 管理（水印、合并、拆分、元数据）
 */

export function initStepConfig() {
  const wmCheckbox = document.querySelector('.pipeline-step-check[data-step="watermark"]')
  const wmOptions = document.getElementById('pipeline-wm-options')
  const mergeCheckbox = document.querySelector('.pipeline-step-check[data-step="merge"]')
  const mergeOptions = document.getElementById('pipeline-merge-options')
  const splitCheckbox = document.querySelector('.pipeline-step-check[data-step="split"]')
  const splitOptions = document.getElementById('pipeline-split-options')
  const mdOptions = document.getElementById('pipeline-md-options')
  const mdCheckbox = document.querySelector('.pipeline-step-check[data-step="metadata"]')

  // 水印配置
  const wmFontSizeRange = document.getElementById('pipeline-wm-fontsize')
  const wmFontSizeVal = document.getElementById('pipeline-wm-fontsize-val')
  const wmOpacityRange = document.getElementById('pipeline-wm-opacity')
  const wmOpacityVal = document.getElementById('pipeline-wm-opacity-val')

  if (wmCheckbox) {
    wmCheckbox.addEventListener('change', () => {
      if (wmOptions) wmOptions.style.display = wmCheckbox.checked ? 'block' : 'none'
    })
  }

  // 合并配置
  if (mergeCheckbox) {
    mergeCheckbox.addEventListener('change', () => {
      if (mergeOptions) mergeOptions.style.display = mergeCheckbox.checked ? 'block' : 'none'
    })
  }

  // 拆分配置
  if (splitCheckbox) {
    splitCheckbox.addEventListener('change', () => {
      if (splitOptions) splitOptions.style.display = splitCheckbox.checked ? 'block' : 'none'
    })
  }

  // 元数据配置
  if (mdCheckbox) {
    mdCheckbox.addEventListener('change', () => {
      if (mdOptions) mdOptions.style.display = mdCheckbox.checked ? 'block' : 'none'
    })
  }

  // Range value display
  if (wmFontSizeRange && wmFontSizeVal) {
    wmFontSizeRange.addEventListener('input', () => {
      wmFontSizeVal.textContent = wmFontSizeRange.value
    })
  }
  if (wmOpacityRange && wmOpacityVal) {
    wmOpacityRange.addEventListener('input', () => {
      wmOpacityVal.textContent = wmOpacityRange.value + '%'
    })
  }

  // 更新所有选项可见性
  function updateAllOptionsVisibility() {
    if (wmOptions && wmCheckbox) wmOptions.style.display = wmCheckbox.checked ? 'block' : 'none'
    if (mergeOptions && mergeCheckbox) mergeOptions.style.display = mergeCheckbox.checked ? 'block' : 'none'
    if (splitOptions && splitCheckbox) splitOptions.style.display = splitCheckbox.checked ? 'block' : 'none'
    if (mdOptions && mdCheckbox) mdOptions.style.display = mdCheckbox.checked ? 'block' : 'none'
  }

  return { updateAllOptionsVisibility }
}
