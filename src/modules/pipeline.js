/**
 * pipeline.js - PDF 处理管道引擎（纯 JS，无 DOM 依赖）
 *
 * 将多个 PDF 处理步骤串联执行，上一步输出作为下一步输入。
 * 在内存中传递 ArrayBuffer/Uint8Array，不写入文件系统。
 *
 * 用法：
 *   const pipeline = new Pipeline()
 *   pipeline.onProgress = (step, total, name) => { ... }
 *   const result = await pipeline.run(pdfBytes, [
 *     { type: 'compress' },
 *     { type: 'watermark', text: '机密', position: 'tile' }
 *   ])
 */

import * as PDFLib from 'pdf-lib'

// ============================================================================
// 内部步骤处理函数（纯函数，无 DOM 依赖）
// ============================================================================

/**
 * compress — 压缩/优化 PDF
 * 复用 compress.js 的核心逻辑：useObjectStreams + 优化保存
 */
async function stepCompress(inputBytes, _options) {
  const pdfDoc = await PDFLib.PDFDocument.load(inputBytes)

  const outputBytes = await pdfDoc.save({
    useObjectStreams: true,
    addDefaultPage: false,
    objectsPerTick: 50,
  })

  return outputBytes
}

/**
 * stripJS — 剥离 PDF 内嵌 JavaScript，增强安全性
 *
 * 移除以下位置的 JavaScript：
 * - 文档级别的 /Names/JavaScript 条目
 * - 页面级别的 /AA（附加动作）中的 JavaScript 动作
 * - 注释中的 /A（动作）JavaScript
 * - 表单字段的 /AA 和 /A 中的 JavaScript
 */
async function stepStripJS(inputBytes, _options) {
  const pdfDoc = await PDFLib.PDFDocument.load(inputBytes, {
    ignoreEncryption: false,
  })

  // 获取底层 PDFDocument（pdf-lib 的私有 API）
  // 我们需要直接操作 PDF 对象来移除 JavaScript
  const pdfDocInternals = pdfDoc.context

  // ---- 1. 移除文档级别的 JavaScript（/Names/JavaScript） ----
  const catalog = pdfDocInternals.lookup(pdfDocInternals.trailer.get(pdfDocInternals.objByName('Root')))
  if (catalog) {
    // 移除 /Names 中的 /JavaScript
    const namesRef = catalog.get(pdfDocInternals.objByName('Names'))
    if (namesRef) {
      const namesDict = pdfDocInternals.lookupMaybe(namesRef)
      if (namesDict) {
        namesDict.delete(pdfDocInternals.objByName('JavaScript'))
      }
    }

    // 移除 /OpenAction 如果是 JavaScript
    const openAction = catalog.get(pdfDocInternals.objByName('OpenAction'))
    if (openAction) {
      const openActionObj = pdfDocInternals.lookupMaybe(openAction)
      if (openActionObj && openActionObj.get(pdfDocInternals.objByName('S'))?.as() === 'JavaScript') {
        catalog.delete(pdfDocInternals.objByName('OpenAction'))
      }
    }

    // 移除 /AA（附加动作）中的 JavaScript
    const aa = catalog.get(pdfDocInternals.objByName('AA'))
    if (aa) {
      const aaDict = pdfDocInternals.lookupMaybe(aa)
      if (aaDict) {
        stripJSActions(aaDict, pdfDocInternals)
      }
    }
  }

  // ---- 2. 移除所有页面的 /AA（附加动作）中的 JavaScript ----
  const pages = pdfDoc.getPages()
  for (const page of pages) {
    const pageRef = page.node.ref
    if (!pageRef) continue

    const pageDict = pdfDocInternals.lookupMaybe(pageRef)
    if (!pageDict) continue

    const pageAA = pageDict.get(pdfDocInternals.objByName('AA'))
    if (pageAA) {
      const aaDict = pdfDocInternals.lookupMaybe(pageAA)
      if (aaDict) {
        stripJSActions(aaDict, pdfDocInternals)
      }
    }

    // ---- 3. 移除页面注释中的 JavaScript ----
    const annotsRef = pageDict.get(pdfDocInternals.objByName('Annots'))
    if (annotsRef) {
      const annotsArray = pdfDocInternals.lookupMaybe(annotsRef)
      if (annotsArray && Array.from(annotsArray).length > 0) {
        for (const annotRef of annotsArray.values()) {
          const annotDict = pdfDocInternals.lookupMaybe(annotRef)
          if (!annotDict) continue

          // 移除注释的 /A 动作
          stripAnnotJS(annotDict, pdfDocInternals)
        }
      }
    }
  }

  // ---- 4. 移除表单字段中的 JavaScript ----
  const form = pdfDoc.getForm()
  if (form) {
    const fields = form.getFields()
    for (const field of fields) {
      const fieldRef = field.acroField?.dict?.ref
      if (!fieldRef) continue

      const fieldDict = pdfDocInternals.lookupMaybe(fieldRef)
      if (!fieldDict) continue

      // 移除 /A 和 /AA
      stripFormFieldJS(fieldDict, pdfDocInternals)
    }
  }

  const outputBytes = await pdfDoc.save({
    useObjectStreams: true,
    addDefaultPage: false,
    objectsPerTick: 50,
  })

  return outputBytes
}

/**
 * 从动作字典中移除所有 JavaScript 类型的动作值
 * 动作字典的键是触发事件（如 /O, /C, /PO, /PC 等），值是动作对象
 */
function stripJSActions(actionsDict, context) {
  const nameObj = context.objByName
  // 遍历动作字典的所有键
  const keys = Array.from(actionsDict.keys())
  for (const key of keys) {
    const actionRef = actionsDict.get(key)
    const actionObj = context.lookupMaybe(actionRef)
    if (actionObj && isJSAction(actionObj, context)) {
      actionsDict.delete(key)
    } else if (actionObj && actionObj.get(nameObj('S'))?.as() === 'JavaScript') {
      // 直接是 JavaScript 动作
      actionsDict.delete(key)
    }
  }
}

/**
 * 检查动作对象是否为 JavaScript 类型
 */
function isJSAction(actionObj, context) {
  const s = actionObj.get(context.objByName('S'))
  if (s && s.as() === 'JavaScript') return true

  // 递归检查 Next 数组中的动作
  const next = actionObj.get(context.objByName('Next'))
  if (next) {
    const nextArr = context.lookupMaybe(next)
    if (nextArr) {
      for (const item of nextArr.values()) {
        const nextObj = context.lookupMaybe(item)
        if (nextObj && isJSAction(nextObj, context)) return true
      }
    }
  }

  return false
}

/**
 * 从注释字典中移除 JavaScript 动作
 */
function stripAnnotJS(annotDict, context) {
  const nameObj = context.objByName

  // 检查并移除 /A
  const aRef = annotDict.get(nameObj('A'))
  if (aRef) {
    const aObj = context.lookupMaybe(aRef)
    if (aObj && isJSAction(aObj, context)) {
      annotDict.delete(nameObj('A'))
    }
  }

  // 检查并移除 /AA
  const aaRef = annotDict.get(nameObj('AA'))
  if (aaRef) {
    const aaDict = context.lookupMaybe(aaRef)
    if (aaDict) {
      stripJSActions(aaDict, context)
      // 如果所有动作都被移除了，删除整个 AA 字典
      if (Array.from(aaDict.keys()).length === 0) {
        annotDict.delete(nameObj('AA'))
      }
    }
  }
}

/**
 * 从表单字段字典中移除 JavaScript 动作
 */
function stripFormFieldJS(fieldDict, context) {
  const nameObj = context.objByName

  // 移除 /A
  const aRef = fieldDict.get(nameObj('A'))
  if (aRef) {
    const aObj = context.lookupMaybe(aRef)
    if (aObj && isJSAction(aObj, context)) {
      fieldDict.delete(nameObj('A'))
    }
  }

  // 移除 /AA
  const aaRef = fieldDict.get(nameObj('AA'))
  if (aaRef) {
    const aaDict = context.lookupMaybe(aaRef)
    if (aaDict) {
      stripJSActions(aaDict, context)
      if (Array.from(aaDict.keys()).length === 0) {
        fieldDict.delete(nameObj('AA'))
      }
    }
  }
}

/**
 * watermark — 添加文字或图片水印
 * 复用 watermark.js 的核心逻辑，支持 center/tile 位置模式
 */
async function stepWatermark(inputBytes, options = {}) {
  const pdfDoc = await PDFLib.PDFDocument.load(inputBytes)
  const pages = pdfDoc.getPages()

  const {
    // 水印模式：'text'（默认）或 'image'
    mode = 'text',
    // 文字水印参数
    text = 'DRAFT',
    fontSize = 40,
    rotation = -45,
    color = '#d3d3d3',
    opacity = 0.3,
    customFont = null,
    // 图片水印参数
    imageBytes = null,
    imageType = 'png',
    imageScale = 0.3,
    imageOpacity = 0.4,
    // 位置模式：'center'（居中）或 'tile'（平铺）
    position = 'center',
  } = options

  // ---- 文字水印 ----
  if (mode === 'text') {
    if (!text || text.trim().length === 0) {
      throw new Error('watermark 步骤缺少必填参数: text')
    }

    let font
    const trimmedText = text.trim()

    if (customFont) {
      try {
        font = await pdfDoc.embedFont(customFont, { subset: true })
      } catch (err) {
        console.warn('[Pipeline] 自定义字体嵌入失败，回退到 Helvetica:', err.message)
        font = pdfDoc.embedFont(PDFLib.StandardFonts.Helvetica)
      }
    } else {
      const hasCJK = /[\u4e00-\u9fff\u3040-\u309f\u30a0-\u30ff\uac00-\ud7af]/.test(trimmedText)
      if (hasCJK) {
        console.warn(
          '[Pipeline] 检测到中文字符但未提供自定义字体，可能显示为方框。建议传入 customFont 参数。',
        )
      }
      font = pdfDoc.embedFont(PDFLib.StandardFonts.Helvetica)
    }

    // 延迟获取 font（embedFont 可能返回 Promise）
    font = await font

    const rgb = hexToRgb(color)

    for (const page of pages) {
      const { width, height } = page.getSize()

      if (position === 'center') {
        const textWidth = font.widthOfTextAtSize(trimmedText, fontSize)
        const x = (width - textWidth) / 2
        const y = (height - fontSize) / 2

        page.drawText(trimmedText, {
          x,
          y,
          size: fontSize,
          font,
          color: PDFLib.rgb(rgb.r, rgb.g, rgb.b),
          opacity,
          rotate: PDFLib.degrees(rotation),
        })
      } else {
        // 平铺模式
        const textWidth = font.widthOfTextAtSize(trimmedText, fontSize)
        const spacingX = textWidth + width * 0.12
        const spacingY = fontSize * 3

        for (let y = -height; y < height * 2; y += spacingY) {
          for (let x = -width; x < width * 2; x += spacingX) {
            page.drawText(trimmedText, {
              x,
              y,
              size: fontSize,
              font,
              color: PDFLib.rgb(rgb.r, rgb.g, rgb.b),
              opacity,
              rotate: PDFLib.degrees(rotation),
            })
          }
        }
      }
    }
  }
  // ---- 图片水印 ----
  else if (mode === 'image') {
    if (!imageBytes) {
      throw new Error('watermark 步骤 (mode=image) 缺少必填参数: imageBytes')
    }

    let embeddedImage
    if (imageType === 'png') {
      embeddedImage = await pdfDoc.embedPng(imageBytes)
    } else {
      embeddedImage = await pdfDoc.embedJpg(imageBytes)
    }

    const imgWidth = embeddedImage.width
    const imgHeight = embeddedImage.height
    const imgAspect = imgWidth / imgHeight

    for (const page of pages) {
      const { width, height } = page.getSize()
      const wmWidth = width * imageScale
      const wmHeight = wmWidth / imgAspect

      if (position === 'center') {
        page.drawImage(embeddedImage, {
          x: (width - wmWidth) / 2,
          y: (height - wmHeight) / 2,
          width: wmWidth,
          height: wmHeight,
          opacity: imageOpacity,
        })
      } else {
        const spacingX = wmWidth * 1.8
        const spacingY = wmHeight * 1.8
        for (let y = -wmHeight; y < height + wmHeight; y += spacingY) {
          for (let x = -wmWidth; x < width + wmWidth; x += spacingX) {
            page.drawImage(embeddedImage, {
              x,
              y,
              width: wmWidth,
              height: wmHeight,
              opacity: imageOpacity,
            })
          }
        }
      }
    }
  } else {
    throw new Error(`watermark 步骤不支持的 mode: "${mode}"`)
  }

  const outputBytes = await pdfDoc.save()
  return outputBytes
}

// ============================================================================
// 工具函数
// ============================================================================

/**
 * 将十六进制颜色字符串转为 0-1 RGB
 */
function hexToRgb(hex) {
  const cleaned = hex.replace('#', '')
  return {
    r: parseInt(cleaned.substring(0, 2), 16) / 255,
    g: parseInt(cleaned.substring(2, 4), 16) / 255,
    b: parseInt(cleaned.substring(4, 6), 16) / 255,
  }
}

// ============================================================================
// Pipeline 类
// ============================================================================

/**
 * metadata — 编辑 PDF 元数据（标题、作者、主题、关键词）
 * 使用 pdf-lib 原生 API：setTitle() / setAuthor() / setSubject() / setKeywords()
 */
async function stepMetadata(inputBytes, options = {}) {
  const pdfDoc = await PDFLib.PDFDocument.load(inputBytes)

  const { title, author, subject, keywords } = options

  if (title && title.trim()) {
    pdfDoc.setTitle(title.trim())
  }
  if (author && author.trim()) {
    pdfDoc.setAuthor(author.trim())
  }
  if (subject && subject.trim()) {
    pdfDoc.setSubject(subject.trim())
  }
  if (keywords && keywords.trim()) {
    // keywords 是逗号分隔的字符串，转为数组
    const kwArray = keywords.split(',').map(k => k.trim()).filter(k => k.length > 0)
    if (kwArray.length > 0) {
      pdfDoc.setKeywords(kwArray)
    }
  }

  const outputBytes = await pdfDoc.save({
    useObjectStreams: true,
    addDefaultPage: false,
    objectsPerTick: 50,
  })

  return outputBytes
}

/**
 * merge — 合并额外的 PDF 文件到主文件
 *
 * 将主文件作为第一页，随后依次追加额外文件的所有页面。
 *
 * 参数：
 *   extraFiles: File[] — 需要合并的额外 PDF 文件（由 UI 上传提供）
 */
async function stepMerge(inputBytes, options = {}) {
  const { extraFiles } = options

  if (!extraFiles || extraFiles.length === 0) {
    throw new Error('merge 步骤缺少必填参数: extraFiles（需要上传至少一个额外文件）')
  }

  const mergedDoc = await PDFLib.PDFDocument.create()

  // 先复制主文件的所有页面
  const mainDoc = await PDFLib.PDFDocument.load(inputBytes)
  const mainPages = await mergedDoc.copyPages(mainDoc, mainDoc.getPageIndices())
  mainPages.forEach(p => mergedDoc.addPage(p))

  // 依次合并额外文件
  const errors = []
  for (const file of extraFiles) {
    try {
      const bytes = await file.arrayBuffer()
      const doc = await PDFLib.PDFDocument.load(new Uint8Array(bytes), { ignoreEncryption: false })
      const pages = await mergedDoc.copyPages(doc, doc.getPageIndices())
      pages.forEach(p => mergedDoc.addPage(p))
    } catch (err) {
      if (err.message.includes('encrypted') || err.message.includes('password')) {
        errors.push(`"${file.name}" 已加密，跳过`)
      } else {
        errors.push(`"${file.name}" 无法读取：${err.message}`)
      }
    }
  }

  if (mergedDoc.getPageCount() === 0) {
    throw new Error('merge 步骤失败：没有可合并的有效页面' + (errors.length > 0 ? '\n' + errors.join('; ') : ''))
  }

  const outputBytes = await mergedDoc.save({
    useObjectStreams: true,
    addDefaultPage: false,
    objectsPerTick: 50,
  })

  return outputBytes
}

/**
 * split — 按页码范围拆分 PDF，输出第一个拆分结果
 *
 * 参数：
 *   range: string — 页码范围，如 "1-3,5,8-10"
 *   totalPages: number — 主文件总页数（由 UI 提供）
 *
 * 只输出第一个有效范围的页面，例如 "1-3,5,8-10" 只输出第 1-3 页。
 */
async function stepSplit(inputBytes, options = {}) {
  const { range, totalPages } = options

  if (!range || !range.trim()) {
    throw new Error('split 步骤缺少必填参数: range（页码范围，如 "1-3,5,8-10"）')
  }

  const pages = parsePageRangeForSplit(range.trim(), totalPages || 9999)

  if (pages.length === 0) {
    throw new Error('split 步骤失败：页码范围无效，请检查输入（如 1-3,5,8-10）')
  }

  const srcDoc = await PDFLib.PDFDocument.load(inputBytes)
  const newDoc = await PDFLib.PDFDocument.create()

  const indices = pages.map(p => p - 1) // 转为 0-based
  const copiedPages = await newDoc.copyPages(srcDoc, indices)
  copiedPages.forEach(page => newDoc.addPage(page))

  const outputBytes = await newDoc.save({
    useObjectStreams: true,
    addDefaultPage: false,
    objectsPerTick: 50,
  })

  return outputBytes
}

/**
 * 解析页码范围字符串为页码数组
 * 支持格式："1-3,5,8-10" → [1,2,3,5,8,9,10]
 */
function parsePageRangeForSplit(str, max) {
  const pages = []
  const parts = str.split(',')
  for (const part of parts) {
    const trimmed = part.trim()
    if (!trimmed) continue

    if (trimmed.includes('-')) {
      const [a, b] = trimmed.split('-').map(Number)
      if (!isNaN(a) && !isNaN(b) && a >= 1 && b >= a && b <= max) {
        for (let i = a; i <= b; i++) pages.push(i)
      }
    } else {
      const n = Number(trimmed)
      if (!isNaN(n) && n >= 1 && n <= max) {
        pages.push(n)
      }
    }
  }
  return pages
}

/**
 * 已知步骤类型的处理函数注册表
 */
const STEP_HANDLERS = {
  compress: stepCompress,
  watermark: stepWatermark,
  stripJS: stepStripJS,
  metadata: stepMetadata,
  merge: stepMerge,
  split: stepSplit,
}

/**
 * PDF 处理管道引擎
 *
 * @example
 *   const pipeline = new Pipeline()
 *   pipeline.onProgress = (i, total, name) => console.log(`${name} (${i}/${total})`)
 *   const result = await pipeline.run(pdfArrayBuffer, [
 *     { type: 'compress' },
 *     { type: 'watermark', text: '机密', position: 'tile' }
 *   ])
 */
export class Pipeline {
  /**
   * @param {object} [opts]
   * @param {function|null} [opts.onProgress] 进度回调 (completedIndex, totalSteps, stepName)
   */
  constructor(opts = {}) {
    this.onProgress = opts.onProgress || null

    /** @private 自定义步骤注册表 */
    this._customSteps = {}
  }

  /**
   * 注册自定义步骤类型
   * @param {string} name 步骤类型名称
   * @param {function(Uint8Array, object): Promise<Uint8Array>} handler
   */
  registerStep(name, handler) {
    if (typeof handler !== 'function') {
      throw new TypeError(`步骤 "${name}" 的 handler 必须是 async 函数`)
    }
    this._customSteps[name] = handler
  }

  /**
   * 执行管道处理
   *
   * @param {ArrayBuffer|Uint8Array} inputBytes 输入 PDF 数据
   * @param {Array<{type: string, [key]: any}>} steps 步骤数组
   * @returns {Promise<Uint8Array>} 处理后的 PDF 数据
   * @throws {Error} 某一步失败时抛出，停止后续步骤
   */
  async run(inputBytes, steps) {
    if (!steps || steps.length === 0) {
      return new Uint8Array(inputBytes)
    }

    let current = new Uint8Array(inputBytes)

    for (let i = 0; i < steps.length; i++) {
      const step = steps[i]

      if (!step || !step.type) {
        throw new Error(`步骤 [${i}] 缺少 type 字段`)
      }

      const handler = this._customSteps[step.type] || STEP_HANDLERS[step.type]

      if (!handler) {
        const knownTypes = [
          ...Object.keys(STEP_HANDLERS),
          ...Object.keys(this._customSteps),
        ].join(', ')
        throw new Error(
          `未知的步骤类型 "${step.type}"。支持的类型: ${knownTypes}`,
        )
      }

      try {
        current = await handler(current, step)
      } catch (err) {
        throw new Error(
          `步骤 [${i}] "${step.type}" 执行失败: ${err.message}`,
          { cause: err },
        )
      }

      // 触发进度回调
      if (typeof this.onProgress === 'function') {
        this.onProgress(i + 1, steps.length, step.type)
      }
    }

    return current
  }
}

/**
 * 便捷函数：一步执行管道（无需实例化）
 *
 * @param {ArrayBuffer|Uint8Array} inputBytes
 * @param {Array<{type: string, [key]: any}>} steps
 * @param {function|null} [onProgress]
 * @returns {Promise<Uint8Array>}
 */
export async function runPipeline(inputBytes, steps, onProgress = null) {
  const pipeline = new Pipeline()
  if (onProgress) pipeline.onProgress = onProgress
  return pipeline.run(inputBytes, steps)
}
