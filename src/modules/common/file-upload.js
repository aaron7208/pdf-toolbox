/**
 * file-upload.js - 通用文件上传处理（拖拽+点击）
 *
 * 封装文件上传区域的通用交互逻辑，包括：
 * - 点击触发文件选择
 * - 拖拽上传（dragover/dragleave/drop）
 * - 文件验证（类型、大小）
 * - 状态反馈
 */

import { showStatus, checkFileSize } from '../utils.js'

/**
 * 创建文件上传处理器
 * @param {object} config - 配置对象
 * @param {HTMLElement} config.uploadZone - 上传区域 DOM 元素
 * @param {HTMLInputElement} config.fileInput - 文件输入框 DOM 元素
 * @param {HTMLElement} [config.statusEl] - 状态显示元素
 * @param {function} config.onFiles - 文件选择回调 (files: File[], isValid: boolean)
 * @param {function} [config.validateFile] - 文件验证函数 (file: File) => boolean
 * @param {boolean} [config.multiple] - 是否支持多文件（默认 false）
 * @param {string} [config.acceptType] - 接受的文件类型（默认 'application/pdf'）
 * @returns {object} 包含 remove() 方法的清理函数
 */
export function createFileUploader(config) {
  const {
    uploadZone,
    fileInput,
    statusEl,
    onFiles,
    validateFile,
    multiple = false,
    acceptType = 'application/pdf',
  } = config

  if (!uploadZone || !fileInput) {
    console.warn('[createFileUploader] uploadZone 或 fileInput 未提供')
    return { remove: () => {} }
  }

  // 点击触发文件选择
  function handleClick(e) {
    // 如果点击的是已经存在的子元素（如 .upload-file-info），不触发文件选择
    if (e.target.closest('.upload-file-info')) return
    fileInput.click()
  }

  // 拖拽进入
  function handleDragOver(e) {
    e.preventDefault()
    uploadZone.classList.add('dragover')
  }

  // 拖拽离开
  function handleDragLeave() {
    uploadZone.classList.remove('dragover')
  }

  // 文件拖放
  function handleDrop(e) {
    e.preventDefault()
    uploadZone.classList.remove('dragover')
    const files = e.dataTransfer.files
    if (files.length > 0) {
      handleFileSelection(files)
    }
  }

  // 文件选择框变化
  function handleChange() {
    if (fileInput.files.length > 0) {
      handleFileSelection(fileInput.files)
      // 重置 input value，允许选择相同文件
      fileInput.value = ''
    }
  }

  // 处理文件选择
  function handleFileSelection(fileList) {
    const files = Array.from(fileList)

    // 验证文件类型
    const validFiles = files.filter(file => {
      const isPdf = file.type === acceptType || file.name.toLowerCase().endsWith('.pdf')
      return isPdf
    })

    if (validFiles.length === 0) {
      if (statusEl) {
        showStatus(statusEl, '⚠️ 请选择 PDF 文件', 'warning')
      }
      onFiles(files, false)
      return
    }

    // 验证文件大小
    let hasOversized = false
    for (const file of validFiles) {
      if (statusEl && !checkFileSize(file, statusEl)) {
        hasOversized = true
      }
    }

    if (hasOversized) {
      onFiles(validFiles, false)
      return
    }

    // 自定义验证
    if (validateFile) {
      const customValid = validFiles.every(validateFile)
      if (!customValid) {
        onFiles(validFiles, false)
        return
      }
    }

    onFiles(validFiles, true)
  }

  // 绑定事件
  uploadZone.addEventListener('click', handleClick)
  uploadZone.addEventListener('dragover', handleDragOver)
  uploadZone.addEventListener('dragleave', handleDragLeave)
  uploadZone.addEventListener('drop', handleDrop)
  fileInput.addEventListener('change', handleChange)

  // 返回清理函数
  return {
    remove: () => {
      uploadZone.removeEventListener('click', handleClick)
      uploadZone.removeEventListener('dragover', handleDragOver)
      uploadZone.removeEventListener('dragleave', handleDragLeave)
      uploadZone.removeEventListener('drop', handleDrop)
      fileInput.removeEventListener('change', handleChange)
    }
  }
}

/**
 * 快速创建单文件上传处理器
 * @param {object} config - 配置对象（同 createFileUploader）
 * @returns {object} 包含 remove() 方法的清理函数
 */
export function createSingleFileUploader(config) {
  return createFileUploader({
    ...config,
    onFiles: (files, isValid) => {
      if (isValid && files.length > 0) {
        config.onFiles(files[0], isValid)
      }
    }
  })
}
