#!/usr/bin/env bash
# ============================================================
# PDF Toolbox — Linux/macOS 一键安装脚本
# 功能：自动安装 Node.js 依赖 → 构建 → 启动本地服务器
# 用法：chmod +x install.sh && ./install.sh
# ============================================================

set -e

echo "========================================"
echo "  PDF Toolbox — 一键安装"
echo "========================================"
echo ""

# --- 1. 检查 Node.js ---
echo -n "[1/4] 检查 Node.js... "
if command -v node &> /dev/null; then
    NODE_VER=$(node --version)
    echo "✅ 已安装: $NODE_VER"
else
    echo "❌ 未检测到 Node.js"
    echo "  请先安装 Node.js 18+: https://nodejs.org/"
    echo "  Ubuntu/Debian: curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash - && sudo apt install -y nodejs"
    echo "  macOS: brew install node"
    exit 1
fi

# --- 2. 安装依赖 ---
echo "[2/4] 安装依赖..."
npm ci --ignore-scripts 2>/dev/null || npm install
echo "  ✅ 依赖安装完成"

# --- 3. 构建 ---
echo "[3/4] 构建项目..."
npm run build
echo "  ✅ 构建完成 → dist/"

# --- 4. 启动服务器 ---
echo "[4/4] 启动本地服务器..."
echo ""
echo "========================================"
echo "  🎉 安装完成！"
echo "  访问地址: http://localhost:5173"
echo "  按 Ctrl+C 停止服务器"
echo "========================================"
echo ""

npm run dev
