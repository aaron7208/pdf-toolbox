/**
 * pipeline-ui/index.js - Pipeline UI 入口，组合各子模块
 *
 * 支持单文件模式和批量模式：
 * - 单文件模式：上传 1 个 PDF，处理完直接下载
 * - 批量模式：上传多个 PDF，处理完打包 ZIP 下载
 *
 * 复用 pipeline.js 核心中间层和 batch-pipeline.js 批量引擎。
 */

import { createTemplateManager } from './template-manager.js'
import { initStepConfig } from './step-config.js'
import { initSingleMode } from './single-mode.js'
import { initBatchMode } from './batch-mode.js'
import { initMergeHandler } from './merge-handler.js'
import { buildStepsFromUI } from './steps-builder.js'
import {
  showStatus,
  showError,
  clearStatus,
  resetUploadZone,
} from '../../utils.js'

export function initPipeline() {
  const uploadZone = document.getElementById('pipeline-upload')
  const fileInput = document.getElementById('pipeline-file')
  const pipelineCard = document.getElementById('pipeline-card')
  const runBtn = document.getElementById('pipeline-run-btn')
  const statusEl = document.getElementById('pipeline-status')
  const downloadSection = document.getElementById('pipeline-download')
  const downloadBtn = document.getElementById('pipeline-download-btn')
  const singleInfo = document.getElementById('pipeline-single-info')

  // Batch mode elements
  const batchSwitch = document.getElementById('pipeline-batch-switch')
  const batchHint = document.getElementById('pipeline-batch-hint')
  const batchUploadZone = document.getElementById('pipeline-batch-upload')
  const batchFileInput = document.getElementById('pipeline-batch-file')
  const batchFileList = document.getElementById('pipeline-batch-filelist')
  const batchCount = document.getElementById('pipeline-batch-count')
  const batchClearBtn = document.getElementById('pipeline-batch-clear')
  const batchList = document.getElementById('pipeline-batch-list')
  const batchResult = document.getElementById('pipeline-batch-result')
  const batchSummary = document.getElementById('pipeline-batch-summary')
  const batchDownloadBtn = document.getElementById('pipeline-batch-download-btn')
  const closeBtn = document.getElementById('pipeline-close')

  // 初始化模板管理器
  const templateManager = createTemplateManager()

  // 初始化步骤配置 UI
  const stepConfig = initStepConfig()

  // 初始化合并步骤处理
  const mergeHandler = initMergeHandler()

  // 初始化单文件模式
  const singleMode = initSingleMode(
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
    () => {
      const checkedSteps = document.querySelectorAll('.pipeline-step-check:checked')
      return buildStepsFromUI(
        checkedSteps,
        statusEl,
        showError,
        singleMode.getPageCount()
      )
    }
  )

  // 初始化批量模式
  const batchMode = initBatchMode(
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
    () => {
      const checkedSteps = document.querySelectorAll('.pipeline-step-check:checked')
      return buildStepsFromUI(
        checkedSteps,
        statusEl,
        showError,
        singleMode.getPageCount()
      )
    }
  )

  // 模板应用回调
  templateManager.init((templateId) => {
    applyTemplate(templateId)
  })

  // 应用模板
  const TEMPLATES = {
    invoice: {
      steps: ['merge', 'compress', 'watermark'],
      watermark: { text: '已审核', position: 'tile', fontSize: 50, opacity: 20 },
    },
    report: {
      steps: ['compress', 'metadata'],
      watermark: null,
      metadata: { author: '公司名称' },
    },
    contract: {
      steps: ['compress', 'watermark'],
      watermark: { text: '机密', position: 'center', fontSize: 50, opacity: 20 },
    },
  }

  function applyTemplate(templateId) {
    // 尝试内置模板
    const tpl = TEMPLATES[templateId]
    if (!tpl) {
      templateManager.applyTemplate(templateId, (data) => {
        applyTemplateData(data)
      })
      return
    }
    applyTemplateData(tpl)
    highlightTemplate(templateId)
  }

  function applyTemplateData(tpl) {
    document.querySelectorAll('.pipeline-step-check').forEach(cb => {
      cb.checked = tpl.steps.includes(cb.dataset.step)
    })

    // 水印参数
    if (tpl.watermark) {
      const wmText = document.getElementById('pipeline-wm-text')
      const wmFontSize = document.getElementById('pipeline-wm-fontsize')
      const wmOpacity = document.getElementById('pipeline-wm-opacity')
      const wmPositionRadio = document.querySelector(
        `input[name="pipeline-wm-position"][value="${tpl.watermark.position}"]`
      )

      if (wmText) wmText.value = tpl.watermark.text
      if (wmFontSize) {
        wmFontSize.value = tpl.watermark.fontSize
        document.getElementById('pipeline-wm-fontsize-val').textContent = tpl.watermark.fontSize
      }
      if (wmOpacity) {
        wmOpacity.value = tpl.watermark.opacity
        document.getElementById('pipeline-wm-opacity-val').textContent = tpl.watermark.opacity + '%'
      }
      if (wmPositionRadio) wmPositionRadio.checked = true
    }

    // 拆分参数
    if (tpl.split && tpl.split.range) {
      const splitRangeInput = document.getElementById('pipeline-split-range')
      if (splitRangeInput) splitRangeInput.value = tpl.split.range
    }

    // 元数据参数
    if (tpl.metadata) {
      const mdTitle = document.getElementById('pipeline-md-title')
      const mdAuthor = document.getElementById('pipeline-md-author')
      const mdSubject = document.getElementById('pipeline-md-subject')
      const mdKeywords = document.getElementById('pipeline-md-keywords')
      if (mdTitle) mdTitle.value = tpl.metadata.title || ''
      if (mdAuthor) mdAuthor.value = tpl.metadata.author || ''
      if (mdSubject) mdSubject.value = tpl.metadata.subject || ''
      if (mdKeywords) mdKeywords.value = tpl.metadata.keywords || ''
    }

    stepConfig.updateAllOptionsVisibility()
  }

  function highlightTemplate(templateId) {
    document.querySelectorAll('.pipeline-template-card').forEach(card => {
      card.classList.remove('template-active')
    })
    const clickedCard = document.querySelector(`[data-template="${templateId}"]`)
    if (clickedCard) clickedCard.classList.add('template-active')
  }

  // 步骤复选框变化
  document.querySelectorAll('.pipeline-step-check').forEach(cb => {
    cb.addEventListener('change', () => {
      stepConfig.updateAllOptionsVisibility()
      batchMode.updateBatchRunState()
    })
  })

  // Safe Mode auto-check stripJS
  const stripJSCheck = document.querySelector('.pipeline-step-check[data-step="stripJS"]')
  function applySafeModeAutoCheck() {
    if (window.__safeMode && stripJSCheck) {
      stripJSCheck.checked = true
      stepConfig.updateAllOptionsVisibility()
    }
  }
  applySafeModeAutoCheck()
  const safeModeSwitch = document.getElementById('safe-mode-switch')
  if (safeModeSwitch) {
    safeModeSwitch.addEventListener('change', applySafeModeAutoCheck)
  }

  // 关闭按钮
  if (closeBtn) {
    closeBtn.addEventListener('click', () => {
      resetUploadZone(uploadZone)
      if (typeof window.closeModal === 'function') {
        window.closeModal('pipeline')
      }
    })
  }

  // Prompt save template after run
  function promptSaveTemplate(steps) {
    if (!steps || steps.length === 0) return

    const saveAfterRun = document.createElement('div')
    saveAfterRun.style.cssText = 'margin-top:12px;padding:12px;background:#f0f9ff;border:1px solid #90caf9;border-radius:8px;display:flex;align-items:center;gap:8px;font-size:0.875rem;'
    saveAfterRun.innerHTML = `
      <span style="flex:1;">💾 是否将当前步骤配置保存为模板，方便下次使用？</span>
      <button class="btn btn-sm btn-primary" id="save-after-run-yes">保存</button>
      <button class="btn btn-sm btn-outline" id="save-after-run-no">跳过</button>
    `

    if (statusEl && statusEl.parentNode) {
      statusEl.parentNode.insertBefore(saveAfterRun, statusEl.nextSibling)
    }

    const yesBtn = document.getElementById('save-after-run-yes')
    const noBtn = document.getElementById('save-after-run-no')

    if (yesBtn) {
      yesBtn.addEventListener('click', () => {
        saveAfterRun.remove()
        templateManager.handleSaveTemplate(
          () => {
            const checkedSteps = document.querySelectorAll('.pipeline-step-check:checked')
            return buildStepsFromUI(checkedSteps, statusEl, showError, 0)
          },
          statusEl,
          showStatus,
          clearStatus
        )
      })
    }
    if (noBtn) {
      noBtn.addEventListener('click', () => {
        saveAfterRun.remove()
      })
    }

    setTimeout(() => {
      if (saveAfterRun.parentNode) saveAfterRun.remove()
    }, 15000)
  }
}
