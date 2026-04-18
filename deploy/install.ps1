# ============================================================
# PDF Toolbox — Windows 一键安装脚本
# 功能：自动安装 Node.js 依赖 → 构建 → 启动本地服务器
# 用法：powershell -ExecutionPolicy Bypass -File install.ps1
# ============================================================

$ErrorActionPreference = "Stop"

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  PDF Toolbox — 一键安装 (Windows)" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# --- 1. 检查 Node.js ---
Write-Host "[1/4] 检查 Node.js..." -ForegroundColor Yellow
try {
    $nodeVersion = node --version
    Write-Host "  ✅ 已安装: $nodeVersion" -ForegroundColor Green
} catch {
    Write-Host "  ❌ 未检测到 Node.js，请先安装 Node.js 18+" -ForegroundColor Red
    Write-Host "  下载地址: https://nodejs.org/" -ForegroundColor Yellow
    exit 1
}

# --- 2. 安装依赖 ---
Write-Host "[2/4] 安装依赖..." -ForegroundColor Yellow
npm ci --ignore-scripts
if ($LASTEXITCODE -ne 0) {
    Write-Host "  ⚠️ npm ci 失败，尝试 npm install..." -ForegroundColor Yellow
    npm install
}
Write-Host "  ✅ 依赖安装完成" -ForegroundColor Green

# --- 3. 构建 ---
Write-Host "[3/4] 构建项目..." -ForegroundColor Yellow
npm run build
if ($LASTEXITCODE -ne 0) {
    Write-Host "  ❌ 构建失败" -ForegroundColor Red
    exit 1
}
Write-Host "  ✅ 构建完成 → dist/" -ForegroundColor Green

# --- 4. 启动服务器 ---
Write-Host "[4/4] 启动本地服务器..." -ForegroundColor Yellow
Write-Host ""
Write-Host "========================================" -ForegroundColor Green
Write-Host "  🎉 安装完成！" -ForegroundColor Green
Write-Host "  访问地址: http://localhost:5173" -ForegroundColor Green
Write-Host "  按 Ctrl+C 停止服务器" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green
Write-Host ""

npm run dev
