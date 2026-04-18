/**
 * batch-pipeline.js - 批量 PDF 处理引擎
 *
 * 在单文件 Pipeline 基础上，支持一次处理多个 PDF 文件。
 * 处理完成后打包为 ZIP 下载，支持进度追踪、错误跳过、内存释放。
 *
 * 约束：
 *   - 单文件上限 50MB
 *   - 批量总数上限 50 个
 *   - 处理完一个文件立即释放其 ArrayBuffer，避免 OOM
 *   - 某个文件处理失败时跳过，继续处理下一个
 *
 * 依赖：JSZip（已有）、Pipeline（已有）
 *
 * 用法：
 *   const batch = new BatchPipeline()
 *   batch.onFileProgress = (fileIndex, totalFiles, fileName) => { ... }
 *   batch.onStepProgress = (fileIndex, stepCompleted, totalSteps, stepName) => { ... }
 *   const result = await batch.run(files, steps)
 *   // result: { zipBlob, successCount, failCount, successFiles, failFiles }
 */

import { Pipeline } from './pipeline.js'
import JSZip from 'jszip'

// ============================================================================
// 常量
// ============================================================================

export const BATCH_MAX_FILE_SIZE = 50 * 1024 * 1024 // 50MB
export const BATCH_MAX_COUNT = 50

// ============================================================================
// BatchPipeline 类
// ============================================================================

/**
 * 批量 PDF 处理引擎
 */
export class BatchPipeline {
  /**
   * @param {object} [opts]
   * @param {function|null} [opts.onFileProgress] 文件级进度回调 (fileIndex, totalFiles, fileName)
   * @param {function|null} [opts.onStepProgress] 步骤级进度回调 (fileIndex, stepCompleted, totalSteps, stepName)
   */
  constructor(opts = {}) {
    this.onFileProgress = opts.onFileProgress || null
    this.onStepProgress = opts.onStepProgress || null

    /** @private 内部 Pipeline 实例（复用） */
    this._pipeline = new Pipeline()
  }

  /**
   * 执行批量处理
   *
   * @param {File[]} files 文件数组
   * @param {Array<{type: string, [key]: any}>} steps Pipeline 步骤数组
   * @returns {Promise<{
   *   zipBlob: Blob,
   *   successCount: number,
   *   failCount: number,
   *   successFiles: Array<{name: string, originalSize: number, processedSize: number}>,
   *   failFiles: Array<{name: string, error: string}>
   * }>}
   */
  async run(files, steps) {
    const totalFiles = files.length
    const successFiles = []
    const failFiles = []
    const zip = new JSZip()

    // 用于生成不重复的文件名
    const usedNames = new Set()

    for (let i = 0; i < totalFiles; i++) {
      const file = files[i]

      // 触发文件级进度
      if (typeof this.onFileProgress === 'function') {
        this.onFileProgress(i, totalFiles, file.name)
      }

      // 跳过非 PDF 文件
      if (file.type !== 'application/pdf') {
        failFiles.push({ name: file.name, error: '不是 PDF 文件' })
        continue
      }

      // 跳过超大文件
      if (file.size > BATCH_MAX_FILE_SIZE) {
        failFiles.push({ name: file.name, error: '文件超过 50MB 限制' })
        continue
      }

      try {
        // 读取文件（注意：每次处理完立即释放）
        const arrayBuffer = await file.arrayBuffer()

        // 执行 Pipeline
        const resultBytes = await this._pipeline.run(arrayBuffer, steps, (completed, totalSteps, stepName) => {
          if (typeof this.onStepProgress === 'function') {
            this.onStepProgress(i, completed, totalSteps, stepName)
          }
        })

        // 立即释放 ArrayBuffer（GC 回收）
        arrayBuffer.slice(0).fill(0) // 主动清零，帮助 GC

        // 生成不重复的输出文件名
        const baseName = file.name.replace(/\.pdf$/i, '')
        let outputName = baseName + '_workflow.pdf'
        let suffix = 1
        while (usedNames.has(outputName)) {
          outputName = baseName + `_workflow_${suffix}.pdf`
          suffix++
        }
        usedNames.add(outputName)

        // 添加到 ZIP
        zip.file(outputName, resultBytes)

        successFiles.push({
          name: file.name,
          originalSize: file.size,
          processedSize: resultBytes.length,
        })
      } catch (err) {
        failFiles.push({ name: file.name, error: err.message })
      }
    }

    // 生成 ZIP Blob
    const zipBlob = await zip.generateAsync({
      type: 'blob',
      compression: 'DEFLATE',
      compressionOptions: { level: 6 },
    })

    return {
      zipBlob,
      successCount: successFiles.length,
      failCount: failFiles.length,
      successFiles,
      failFiles,
    }
  }
}

/**
 * 便捷函数：一步执行批量处理
 *
 * @param {File[]} files
 * @param {Array<{type: string, [key]: any}>} steps
 * @param {object} [callbacks]
 * @param {function|null} [callbacks.onFileProgress]
 * @param {function|null} [callbacks.onStepProgress]
 * @returns {Promise<{zipBlob, successCount, failCount, successFiles, failFiles}>}
 */
export async function runBatchPipeline(files, steps, callbacks = {}) {
  const batch = new BatchPipeline(callbacks)
  return batch.run(files, steps)
}
