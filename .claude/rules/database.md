---
paths:
  - "supabase-schema.sql"
  - "supabase/**/*.sql"
  - "supabase/migrations/**"
---

# 資料庫開發規則

> 每次編輯 SQL schema 或 migration 檔案時自動載入。

---

## Migration 強制規範

**每次 schema 變更都必須：**

1. 在 `supabase/migrations/` 建立 migration 檔
   ```
   命名：YYYYMMDDHHMMSS_{description}.sql
   範例：20260424120000_add_sustainability_to_analyses.sql
   ```

2. 使用安全語法（可重複執行）
   ```sql
   -- ✅ 安全
   ALTER TABLE public.analyses ADD COLUMN IF NOT EXISTS sustainability JSONB;
   CREATE TABLE IF NOT EXISTS public.new_table (...);
   CREATE INDEX IF NOT EXISTS idx_name ON table(col);

   -- ❌ 危險（重複執行會報錯）
   ALTER TABLE public.analyses ADD COLUMN sustainability JSONB;
   CREATE TABLE public.new_table (...);
   ```

3. 同步更新 `supabase-schema.sql`（參考用完整 schema）

---

## RLS 政策（每張新表都要設定）

```sql
-- 啟用 RLS
ALTER TABLE public.new_table ENABLE ROW LEVEL SECURITY;

-- 用戶只能看自己的資料
CREATE POLICY "Users can view own data"
  ON public.new_table FOR SELECT
  USING (auth.uid() = user_id);

-- 用戶只能新增自己的資料
CREATE POLICY "Users can insert own data"
  ON public.new_table FOR INSERT
  WITH CHECK (auth.uid() = user_id);
```

---

## Profiles Trigger（新建專案必須確認）

```sql
-- 確認 trigger 存在
SELECT trigger_name FROM information_schema.triggers
WHERE event_object_table = 'users' AND trigger_schema = 'auth';

-- 若不存在，建立自動建立 profile 的 trigger
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, name, company, plan, role)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1)),
    COALESCE(NEW.raw_user_meta_data->>'company', ''),
    'free',
    'user'
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
```

---

## Schema 變更後必做驗證

```sql
-- 確認欄位存在
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'your_table'
ORDER BY ordinal_position;

-- 確認 RLS 啟用
SELECT tablename, rowsecurity
FROM pg_tables
WHERE schemaname = 'public';

-- 確認 trigger 存在
SELECT trigger_name, event_object_table
FROM information_schema.triggers
WHERE trigger_schema IN ('public', 'auth');
```

---

## 禁止事項

```
❌ 直接在 SQL Editor 修改 production，不建 migration 記錄
❌ DROP COLUMN / TRUNCATE 在未備份情況下執行
❌ 新表不加 RLS（所有 production 表必須啟用）
❌ 忘記更新 supabase-schema.sql 參考文件
❌ Migration 裡放測試資料（只放 schema 定義）
```

---

## 緊急 hotfix 流程

若 production 出現 `column does not exist`：
```sql
-- 1. 立即修復
ALTER TABLE public.{table} ADD COLUMN IF NOT EXISTS {col} {type};

-- 2. 事後補建 migration 檔（標記 hotfix）
-- supabase/migrations/YYYYMMDDHHMMSS_hotfix_add_{col}_to_{table}.sql

-- 3. 更新 bugs.md，根因分類：Config Drift
```
