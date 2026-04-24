#!/usr/bin/env bash
# CloudFrame — Post Schema Edit Hook
# 當 supabase-schema.sql 被編輯後自動提醒建立 migration 檔

set -euo pipefail

TIMESTAMP=$(date +"%Y%m%d%H%M%S")

echo ""
echo "═══════════════════════════════════════════"
echo "  🗄️  Schema 檔案已修改"
echo "═══════════════════════════════════════════"
echo ""
echo "  根據 db-migration 規則，你需要："
echo ""
echo "  1. 建立 migration 檔案："
echo "     supabase/migrations/${TIMESTAMP}_{描述}.sql"
echo ""
echo "  2. 使用安全語法（可重複執行）："
echo "     ALTER TABLE public.xxx ADD COLUMN IF NOT EXISTS col TYPE;"
echo "     CREATE TABLE IF NOT EXISTS public.xxx (...);"
echo ""
echo "  3. 在 Supabase SQL Editor 執行 migration"
echo ""
echo "  4. 執行驗證查詢確認欄位存在"
echo ""
echo "  ⚠️  本次根因 BUG-013：schema 改了但沒執行 → production 500 錯誤"
echo "═══════════════════════════════════════════"
echo ""
