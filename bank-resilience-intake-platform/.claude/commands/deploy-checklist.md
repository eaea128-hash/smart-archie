# Skill: Deploy Checklist（新站上線核對清單）

## 觸發關鍵字
`deploy`, `上線`, `部署`, `launch`, `新站`, `production`, `deploy-checklist`

## 角色定位
每次部署新站或重大更新前，逐項核對。**不允許跳過任何項目**。

---

## Phase 1｜Supabase 設定核對

```
□ Auth > URL Configuration > Site URL
  確認 = 目前 Netlify production URL
  範例：https://unique-jelly-da79b4.netlify.app

□ Auth > URL Configuration > Redirect URLs
  確認包含：https://{your-domain}/**

□ Auth > Providers > Email
  確認 Enable Email Confirmations 設定符合預期

□ Database > profiles 表有無 trigger
  執行：SELECT * FROM auth.users LIMIT 1;
  確認 profiles 表有對應資料列
  若無 → 手動 INSERT 或修復 trigger

□ Database schema 與程式碼一致
  執行：SELECT column_name FROM information_schema.columns
        WHERE table_name = 'analyses' ORDER BY ordinal_position;
  確認欄位數量與 supabase-schema.sql 一致
```

---

## Phase 2｜Netlify 環境變數核對

```
□ ANTHROPIC_API_KEY     → 有值，非空
□ SUPABASE_URL          → https://xxx.supabase.co 格式
□ SUPABASE_SERVICE_ROLE_KEY → 有值（非 anon key）
□ SUPABASE_ANON_KEY     → 有值
□ OPENAI_API_KEY        → 拼字正確（不是 PENAI_API_KEY）
□ RESEND_API_KEY        → re_ 開頭
□ NODE_ENV              → production
```

---

## Phase 3｜部署後煙霧測試

在瀏覽器 F12 Console 執行：

```javascript
// 1. 確認 config 正常
fetch('/api/config').then(r=>r.json()).then(d => {
  console.log('Supabase URL:', d.supabaseUrl ? '✅' : '❌ 缺失');
  console.log('Anon Key:', d.supabaseAnonKey ? '✅' : '❌ 缺失');
});

// 2. 確認 Supabase client 初始化
setTimeout(() => {
  console.log('Supabase configured:', SupabaseClient.isConfigured() ? '✅' : '❌');
}, 2000);
```

---

## Phase 4｜新用戶流程測試

```
□ 用測試帳號走完完整流程：
  1. register.html → 填寫表單 → 送出
  2. 確認 profiles 表有新資料列
  3. 確認 email 有收到驗證信（連結指向正確網域）
  4. 點驗證連結 → 跳回 login.html?verified=1
  5. 登入 → dashboard 無 406/500 錯誤
  6. 跑一次分析 → 確認儲存成功
  7. 重開 dashboard → 歷史記錄顯示正常

□ 確認 Console 無紅色錯誤（favicon 404 除外）
```

---

## Phase 5｜Netlify 部署次數確認

```
□ 檢查本月 deploy 次數
  Netlify > Logs & metrics > Credit usage breakdown
  Production deploys credits < 400（安全線）

□ 若接近上限 → 暫停 push，改用 local 測試
```

---

## 完成標準

所有 □ 打勾後，才算上線完成。  
**任何一項 ❌ 必須修復後重新核對，不得帶著已知問題上線。**
