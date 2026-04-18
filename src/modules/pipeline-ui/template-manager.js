/**
 * pipeline-ui/template-manager.js - 模板管理（加载、渲染、删除）
 */

import { saveTemplate, loadTemplates, deleteTemplate } from '../storage.js'
import { escapeHtml } from '../../utils/core.js'

export function createTemplateManager() {
  let customTemplates = []

  const templateSelect = document.getElementById('pipeline-template-select')
  const templateLoadBtn = document.getElementById('pipeline-template-load-btn')
  const templateManageBtn = document.getElementById('pipeline-template-manage-btn')
  const templatesGrid = document.getElementById('pipeline-templates-grid')
  const customSection = document.getElementById('pipeline-custom-templates-section')
  const saveTemplateBtn = document.getElementById('pipeline-save-template-btn')

  // 加载自定义模板
  async function loadCustomTemplates() {
    try {
      customTemplates = await loadTemplates()
      renderCustomTemplates()
      refreshTemplateSelector()
    } catch (err) {
      console.warn('[Pipeline] 加载自定义模板失败:', err)
    }
  }

  // 渲染自定义模板卡片
  function renderCustomTemplates() {
    if (!customSection || !templatesGrid) return

    const existing = templatesGrid.querySelectorAll('.custom-template-card')
    existing.forEach(el => el.remove())

    if (customTemplates.length === 0) {
      customSection.style.display = 'none'
      return
    }

    customSection.style.display = ''

    for (const tpl of customTemplates) {
      const card = createTemplateCard(tpl)
      templatesGrid.appendChild(card)
    }
  }

  // 创建模板卡片 DOM
  function createTemplateCard(tpl) {
    const card = document.createElement('button')
    card.className = 'pipeline-template-card custom-template-card'
    card.dataset.template = tpl.name
    card.dataset.custom = 'true'

    const stepCount = tpl.data.steps.length
    const wmLabel = tpl.data.watermark ? ` + 水印` : ''
    card.innerHTML = `
      <span class="pipeline-template-icon">⭐</span>
      <span class="pipeline-template-name" title="${escapeHtml(tpl.name)}">${escapeHtml(tpl.name)}</span>
      <span class="pipeline-template-desc">${stepCount} 个步骤${wmLabel}</span>
      <span class="custom-template-delete" data-name="${escapeHtml(tpl.name)}" title="删除">🗑️</span>
    `

    // 点击卡片应用模板
    card.addEventListener('click', (e) => {
      if (e.target.classList.contains('custom-template-delete')) return
      applyTemplate(tpl.name)
    })

    // 删除按钮
    const deleteBtn = card.querySelector('.custom-template-delete')
    deleteBtn.addEventListener('click', async (e) => {
      e.stopPropagation()
      const name = deleteBtn.dataset.name
      if (!confirm(`确定删除模板「${name}」？`)) return
      try {
        await deleteTemplate(name)
        customTemplates = customTemplates.filter(t => t.name !== name)
        renderCustomTemplates()
        refreshTemplateSelector()
      } catch (err) {
        console.error('[Pipeline] 删除模板失败:', err)
      }
    })

    return card
  }

  // 应用模板
  function applyTemplate(templateId, onApply) {
    // 查找自定义模板
    const customTpl = customTemplates.find(t => t.name === templateId)
    if (customTpl) {
      onApply(customTpl.data)
      highlightTemplate(templateId)
      return
    }
  }

  // 高亮模板卡片
  function highlightTemplate(templateId) {
    document.querySelectorAll('.pipeline-template-card').forEach(card => {
      card.classList.remove('template-active')
    })
    const clickedCard = document.querySelector(`[data-template="${templateId}"]`)
    if (clickedCard) clickedCard.classList.add('template-active')
  }

  // 刷新模板选择器
  function refreshTemplateSelector() {
    if (!templateSelect) return

    templateSelect.innerHTML = '<option value="">-- 选择模板 --</option>'

    if (customTemplates.length === 0) {
      const templateSelectorSection = document.getElementById('pipeline-template-selector')
      if (templateSelectorSection) templateSelectorSection.style.display = 'none'
      return
    }

    const templateSelectorSection = document.getElementById('pipeline-template-selector')
    if (templateSelectorSection) templateSelectorSection.style.display = ''

    for (const tpl of customTemplates) {
      const option = document.createElement('option')
      option.value = tpl.name
      const stepCount = tpl.data.steps ? tpl.data.steps.length : 0
      option.textContent = `${tpl.name} (${stepCount} 个步骤)`
      templateSelect.appendChild(option)
    }

    if (templateLoadBtn) templateLoadBtn.disabled = true
  }

  // 保存模板
  async function handleSaveTemplate(getCurrentSteps, statusEl, showStatus, clearStatus) {
    const steps = getCurrentSteps()
    if (!steps || steps.length === 0) {
      showStatus(statusEl, '⚠️ 请至少选择一个处理步骤后再保存', 'warning')
      return
    }

    const name = prompt('请输入模板名称：')
    if (!name || !name.trim()) return

    const trimmedName = name.trim()

    if (customTemplates.find(t => t.name === trimmedName)) {
      if (!confirm(`模板「${trimmedName}」已存在，是否覆盖？`)) return
    }

    const stepTypes = steps.map(s => s.type)
    const wmStep = steps.find(s => s.type === 'watermark')
    const watermarkData = wmStep
      ? {
          text: wmStep.text,
          position: wmStep.position,
          fontSize: wmStep.fontSize,
          opacity: wmStep.opacity * 100,
        }
      : null

    const mdStep = steps.find(s => s.type === 'metadata')
    const metadataData = mdStep
      ? { title: mdStep.title, author: mdStep.author, subject: mdStep.subject, keywords: mdStep.keywords }
      : null

    const splitStep = steps.find(s => s.type === 'split')
    const splitData = splitStep ? { range: splitStep.range } : null

    const data = { steps: stepTypes, watermark: watermarkData, metadata: metadataData, split: splitData }

    try {
      await saveTemplate(trimmedName, data)
      customTemplates = await loadTemplates()
      renderCustomTemplates()
      refreshTemplateSelector()
      showStatus(statusEl, `✅ 模板「${trimmedName}」已保存`, 'success')
    } catch (err) {
      console.error('[Pipeline] 保存模板失败:', err)
      showStatus(statusEl, '❌ 保存模板失败：' + err.message, 'error')
    }
  }

  // 模板管理弹窗
  function openTemplateManageModal() {
    if (typeof window.openModal === 'function') {
      window.openModal('template-manage')
    }
    renderTemplateManageList()
  }

  function renderTemplateManageList() {
    const listEl = document.getElementById('template-manage-list')
    if (!listEl) return

    if (customTemplates.length === 0) {
      listEl.innerHTML = '<p style="color:#999;text-align:center;padding:2rem;">暂无已保存的模板</p>'
      return
    }

    listEl.innerHTML = customTemplates.map(tpl => {
      const stepCount = tpl.data.steps ? tpl.data.steps.length : 0
      const stepsDesc = (tpl.data.steps || []).join(' → ')
      const wmText = tpl.data.watermark ? ` | 水印: ${escapeHtml(tpl.data.watermark.text || '')}` : ''
      const splitRange = tpl.data.split && tpl.data.split.range ? ` | 页码: ${escapeHtml(tpl.data.split.range)}` : ''
      const timeStr = tpl.createdAt ? new Date(tpl.createdAt).toLocaleString('zh-CN') : ''
      return `
        <div class="template-manage-item" style="display:flex;align-items:center;gap:12px;padding:12px;border:1px solid #eee;border-radius:8px;margin-bottom:8px;">
          <div style="flex:1;min-width:0;">
            <div style="font-weight:600;margin-bottom:4px;">${escapeHtml(tpl.name)}</div>
            <div style="font-size:0.8rem;color:#666;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;" title="${escapeHtml(stepsDesc + wmText + splitRange)}">
              ${stepCount} 个步骤: ${escapeHtml(stepsDesc)}${wmText}${splitRange}
            </div>
            ${timeStr ? `<div style="font-size:0.7rem;color:#999;margin-top:2px;">保存于 ${timeStr}</div>` : ''}
          </div>
          <div style="display:flex;gap:4px;flex-shrink:0;">
            <button class="btn btn-sm btn-outline template-manage-load-btn" data-name="${escapeHtml(tpl.name)}" title="加载此模板">加载</button>
            <button class="btn btn-sm btn-danger template-manage-delete-btn" data-name="${escapeHtml(tpl.name)}" title="删除此模板">🗑️</button>
          </div>
        </div>
      `
    }).join('')

    // 绑定加载按钮
    listEl.querySelectorAll('.template-manage-load-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        applyTemplate(btn.dataset.name, () => {})
        if (typeof window.closeModal === 'function') {
          window.closeModal('template-manage')
        }
      })
    })

    // 绑定删除按钮
    listEl.querySelectorAll('.template-manage-delete-btn').forEach(btn => {
      btn.addEventListener('click', async () => {
        const name = btn.dataset.name
        if (!confirm(`确定删除模板「${name}」？`)) return
        try {
          await deleteTemplate(name)
          customTemplates = await loadTemplates()
          renderCustomTemplates()
          refreshTemplateSelector()
          renderTemplateManageList()
        } catch (err) {
          console.error('[Pipeline] 删除模板失败:', err)
        }
      })
    })
  }

  // 初始化事件绑定
  function init(applyTemplateCallback) {
    // 内置模板卡片点击
    document.querySelectorAll('.pipeline-template-card[data-template]').forEach(card => {
      card.addEventListener('click', () => applyTemplateCallback(card.dataset.template))
    })

    // 模板选择器
    if (templateSelect) {
      templateSelect.addEventListener('change', () => {
        if (templateLoadBtn) {
          templateLoadBtn.disabled = !templateSelect.value
        }
      })
    }

    if (templateLoadBtn) {
      templateLoadBtn.addEventListener('click', () => {
        const selectedName = templateSelect.value
        if (!selectedName) return
        applyTemplateCallback(selectedName)
        templateSelect.value = selectedName
      })
    }

    if (templateManageBtn) {
      templateManageBtn.addEventListener('click', openTemplateManageModal)
    }

    // 加载自定义模板
    loadCustomTemplates()
  }

  return {
    init,
    applyTemplate,
    refreshTemplateSelector,
    handleSaveTemplate,
    get customTemplates() { return customTemplates }
  }
}
