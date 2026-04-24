#!/usr/bin/env bash
# CloudFrame — Post Function Edit Hook
# 當 netlify/functions/*.js 被編輯後自動提醒核對清單

set -euo pipefail

FILE="${1:-unknown}"

echo ""
echo "═══════════════════════════════════════════"
echo "  ⚡ Netlify Function 已修改：${FILE}"
echo "═══════════════════════════════════════════"
echo ""
echo "  快速核對清單："
echo ""
echo "  □ CORS headers 函式存在？"
echo "    function cors(origin) { return { 'Access-Control-Allow-Origin': ... } }"
echo ""
echo "  □ OPTIONS preflight 處理？"
echo "    if (event.httpMethod === 'OPTIONS') return { statusCode: 204 ... }"
echo ""
echo "  □ JWT 驗證（需登入的 endpoint）？"
echo "    const token = event.headers?.authorization?.replace('Bearer ', '')"
echo ""
echo "  □ 用 .maybeSingle() 而非 .single()？"
echo "    .single() 在 0 筆時回傳 HTTP 406！"
echo ""
echo "  □ try-catch 包裹整個 handler？"
echo "    500 + text/plain = module 層崩潰，難以 debug"
echo ""
echo "  □ 環境變數名稱正確？"
echo "    後端：SUPABASE_SERVICE_ROLE_KEY（不是 ANON_KEY）"
echo "    AI：OPENAI_API_KEY（不是 PENAI_API_KEY）"
echo ""
echo "═══════════════════════════════════════════"
echo ""
