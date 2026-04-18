# Week 1 MVP 任务：PDF 合并 + 压缩

## CTO 技术决策（2026-04-13）

### 决定：基于现有 pdf-editor 项目精简开发
- ✅ 保留：查看模块 + 合并模块
- ❌ 移除：文字模块（不稳定，非 MVP 必需）
- ❌ 移除：拆分模块（非 Week 1 范围）
- ❌ 移除：旋转模块（非 Week 1 范围）
- ➕ 新增：压缩模块

### 技术栈
- Vite 5 + 纯前端
- pdf-lib（PDF 操作核心库，已验证稳定）
- pdfjs-dist（仅用于查看/预览）
- ❌ 移除 @pdf-lib/fontkit（只在文字模块需要）

### 质量底线（QA 要求，必须遵守）
1. 内容不丢失 — 合并后所有页面完整
2. 文件不损坏 — 生成的 PDF 可以被标准阅读器打开
3. 中文不乱码 — 文件名、页面内容中的中文正确
4. 不崩溃 — 异常文件（加密 PDF、损坏文件）友好提示

## 具体开发任务

### Task 1: 精简项目结构
1. 删除 `src/modules/text.js`、`src/modules/split.js`、`src/modules/rotate.js`
2. 从 `index.html` 移除对应面板和 Tab
3. 从 `src/main.js` 移除对应 import
4. 从 `package.json` 移除 `@pdf-lib/fontkit` 依赖
5. 从 `src/state.js` 移除对应状态
6. 更新 HTML 标题和描述为 "PDF 工具箱"

### Task 2: 增强合并功能（基于现有 merge.js）
现有 merge.js 核心逻辑正确，需要增强：
1. 错误处理：加密 PDF 提示用户；损坏文件明确报错
2. 文件名：允许用户自定义输出文件名（默认 merged.pdf）
3. 文件大小提示：合并后显示文件大小
4. 拖拽排序：确保文件列表可以拖拽排序（已有上下按钮，保留即可）
5. 加载状态：大文件合并时显示进度提示

### Task 3: 新增压缩功能
创建 `src/modules/compress.js`：
1. 上传 PDF 文件
2. 使用 pdf-lib 优化保存（removeUnusedObjects 等选项）
3. 显示压缩前后文件大小对比
4. 下载压缩后文件

压缩实现方案（pdf-lib）：
```javascript
const pdfDoc = await PDFLib.PDFDocument.load(bytes);
const compressed = await pdfDoc.save({
  useObjectStreams: true,
  addDefaultPage: false,
  objectsPerTick: 50,
});
```

### Task 4: 品牌更新
- 标题改为 "PDF 工具箱" 
- 描述强调隐私安全（纯前端处理）
- 颜色风格可微调，保持专业感

## 文件结构（最终）
```
pdf-toolbox-mvp/
├── index.html          # 修改：移除不需要的面板
├── style.css           # 微调：移除不需要的样式
├── package.json        # 修改：移除 fontkit
├── vite.config.js      # 保持不变
└── src/
    ├── main.js         # 修改：只 import 需要的模块
    ├── state.js        # 修改：只保留需要的状态
    ├── utils.js        # 保持不变
    └── modules/
        ├── tabs.js     # 保持不变
        ├── view.js     # 保持不变
        ├── merge.js    # 增强：错误处理、文件名、进度
        └── compress.js # 新增：压缩功能
```

## 测试要求
1. 合并 2-5 个不同大小的 PDF
2. 合并包含中文内容的 PDF
3. 尝试合并加密 PDF（应友好提示）
4. 压缩大文件（>10MB）测试
5. 生成的 PDF 用系统默认阅读器验证可打开

## 交付
- `npm run build` 无错误
- `npm run preview` 可本地测试
- dist/ 目录可直接部署到 GitHub Pages
