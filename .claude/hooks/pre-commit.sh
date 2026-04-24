#!/usr/bin/env bash
# CloudFrame — Pre-commit Hook
# 提醒批次 push 策略，防止 Netlify Credits 超限

set -euo pipefail

echo ""
echo "═══════════════════════════════════════════"
echo "  CloudFrame Pre-Commit Check"
echo "═══════════════════════════════════════════"

# 統計本次 commit 的異動檔案數
CHANGED=$(git diff --cached --name-only | wc -l)
echo "  📁 本次異動檔案：${CHANGED} 個"

# 統計本月 Netlify deploy 次數（從 git log 估算）
COMMITS_TODAY=$(git log --oneline --since="midnight" 2>/dev/null | wc -l || echo "?")
echo "  🚀 今日 commit 次數：${COMMITS_TODAY}"

echo ""
echo "  ⚠️  批次 push 提醒："
echo "  → 同一 session 修改請合併後再 push"
echo "  → 每次 production deploy 消耗 15 Netlify Credits"
echo "  → 免費方案上限 500 Credits / 月"
echo ""

# 檢查是否有 schema 變更
SCHEMA_CHANGED=$(git diff --cached --name-only | grep -E "supabase.*\.sql|schema" || true)
if [ -n "$SCHEMA_CHANGED" ]; then
  echo "  🗄️  偵測到 Schema 變更："
  echo "  $SCHEMA_CHANGED"
  echo ""
  echo "  ✅ 確認清單："
  echo "  □ supabase/migrations/ 有對應的 migration 檔？"
  echo "  □ supabase-schema.sql 已同步更新？"
  echo "  □ 在 Supabase SQL Editor 執行過了？"
  echo ""
fi

# 檢查是否有 netlify function 變更
FUNC_CHANGED=$(git diff --cached --name-only | grep -E "netlify/functions" || true)
if [ -n "$FUNC_CHANGED" ]; then
  echo "  ⚡ 偵測到 Netlify Function 變更："
  echo "  $FUNC_CHANGED"
  echo ""
  echo "  ✅ 確認清單："
  echo "  □ 有 CORS headers？"
  echo "  □ 有 JWT 驗證？"
  echo "  □ 用 .maybeSingle() 而非 .single()？"
  echo "  □ 有 try-catch 包裹？"
  echo ""
fi

echo "═══════════════════════════════════════════"
echo ""
