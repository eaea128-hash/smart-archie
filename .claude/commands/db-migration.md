# Skill: DB Migration（資料庫變更管理）

## 觸發關鍵字
`migration`, `schema`, `新增欄位`, `ALTER TABLE`, `db-migration`, `資料庫變更`, `新增資料表`

## 角色定位
所有資料庫結構變更必須走這個流程。**禁止直接在 Supabase SQL Editor 手動修改 production schema 而不留記錄。**

---

## 為什麼需要這個流程？

本專案 2026-04-24 踩過的坑：
- 程式碼新增了 `project_name`、`strategy`、`result` 等欄位
- 但 Supabase 資料庫從未執行 ALTER TABLE
- 結果：`/api/get-analyses` 回傳 500，`column analyses.project_name does not exist`
- 修復：緊急在 SQL Editor 補執行，但沒有留下 migration 記錄

---

## Migration 流程

### Step 1｜建立 Migration 檔案

命名規則：`supabase/migrations/YYYYMMDDHHMMSS_{description}.sql`

```bash
# 範例
supabase/migrations/20260424120000_add_sustainability_to_analyses.sql
```

### Step 2｜撰寫 Migration SQL

**必須使用安全寫法**（`IF NOT EXISTS`、`IF EXISTS`），可重複執行不報錯：

```sql
-- 新增欄位
ALTER TABLE public.analyses
  ADD COLUMN IF NOT EXISTS sustainability JSONB,
  ADD COLUMN IF NOT EXISTS carbon_score   INTEGER;

-- 新增資料表
CREATE TABLE IF NOT EXISTS public.new_table (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ...
);

-- 修改欄位（無法用 IF NOT EXISTS，需先檢查）
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name='analyses' AND column_name='new_col'
  ) THEN
    ALTER TABLE public.analyses ADD COLUMN new_col TEXT;
  END IF;
END $$;
```

### Step 3｜本地驗證（若有 Supabase CLI）

```bash
supabase db diff
supabase migration up
```

### Step 4｜更新 supabase-schema.sql

同步更新專案根目錄的 `supabase-schema.sql`（參考用完整 schema）。

### Step 5｜執行到 Production

```
Supabase Dashboard > SQL Editor > 貼入 migration SQL > Run
```

### Step 6｜驗證

```sql
-- 確認欄位存在
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'your_table'
ORDER BY ordinal_position;
```

### Step 7｜更新程式碼

確認 Netlify function 的 SELECT 語法與新 schema 一致。

### Step 8｜Commit

```
git add supabase/migrations/YYYYMMDDHHMMSS_xxx.sql supabase-schema.sql
git commit -m "db: add {columns} to {table}"
```

---

## 禁止事項

```
❌ 直接在 SQL Editor 修改 production，不建 migration 檔
❌ 在程式碼新增欄位，但不同步更新 supabase-schema.sql
❌ 使用破壞性語法（DROP COLUMN、TRUNCATE）而不先備份
❌ 在 migration 中寫死測試資料（migration 只放 schema，不放資料）
```

---

## 緊急情況（Production 已壞，需立即修復）

若已出現 `column does not exist` 錯誤：

```sql
-- 1. 先修復（安全語法）
ALTER TABLE public.{table} ADD COLUMN IF NOT EXISTS {column} {type};

-- 2. 事後補建 migration 檔記錄（標記為 hotfix）
-- supabase/migrations/YYYYMMDDHHMMSS_hotfix_{description}.sql
```

**修復後必須在 bugs.md 記錄，根因分類為 Config Drift。**

---

## 常用 Schema 查詢

```sql
-- 查所有表的欄位
SELECT table_name, column_name, data_type
FROM information_schema.columns
WHERE table_schema = 'public'
ORDER BY table_name, ordinal_position;

-- 查 RLS 政策
SELECT tablename, policyname, cmd, qual
FROM pg_policies
WHERE schemaname = 'public';

-- 查 trigger
SELECT trigger_name, event_object_table, action_timing, event_manipulation
FROM information_schema.triggers
WHERE trigger_schema = 'public';
```
