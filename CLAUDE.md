# CloudFrame — 專案記憶

> 這個檔案讓 Claude 每次開新對話時自動了解專案背景，不需要重新介紹。

---

## 🏢 專案概述

**CloudFrame** 是 AI 驅動的雲端遷移策略顧問 SaaS 平台。
- **定位**：幫助企業 IT 團隊與管理層快速評估雲端遷移策略
- **核心功能**：6R 策略分析、Landing Zone 建議、成本估算、風險評估
- **目標用戶**：企業 IT PM、雲端架構師、CIO/CTO、數位轉型負責人
- **上線網址**：https://unique-jelly-da79b4.netlify.app
- **GitHub**：https://github.com/eaea128-hash/smart-archie

---

## 🏗️ 技術架構

| 層級 | 技術 |
|------|------|
| 前端 | 純 HTML + CSS + Vanilla JS（無框架） |
| 後端 API | Netlify Functions（ES Modules，`export const handler`） |
| 資料庫 | Supabase PostgreSQL（含 RLS） |
| AI 引擎 | Anthropic Claude API（claude-opus-4-6） |
| 認證 | Supabase Auth |
| 付費 | Stripe（程式碼已寫，待設定金鑰） |
| 監控 | Sentry + Mixpanel（程式碼已寫，待設定金鑰） |
| 部署 | Netlify（自動從 main branch 部署） |

---

## 📁 關鍵檔案

```
/
├── index.html              首頁（行銷/CTA）
├── analyze.html            核心：分析表單 + 結果呈現
├── dashboard.html          用戶儀表板（歷史記錄、方案管理）
├── trends.html             國際趨勢雷達
├── login.html / register.html / reset-password.html
├── share.html              公開分享報告
├── privacy.html            隱私政策
├── terms.html              服務條款
├── admin-dashboard.html    後台管理（admin only）
│
├── css/main.css            Design System（所有頁面共用）
│
├── js/
│   ├── analyze-engine.js   6R 評分引擎（rule-based）
│   ├── auth.js             認證邏輯（Supabase + localStorage fallback）
│   ├── api-client.js       前端 API 呼叫封裝
│   ├── supabase-client.js  Supabase 初始化
│   ├── utils.js            共用工具（Toast、animateKPI、fmt）
│   ├── export.js           PDF/PNG/Markdown 匯出
│   └── analytics.js        Mixpanel 追蹤
│
├── netlify/functions/
│   ├── analyze.js          主分析 API（呼叫 Claude + RAG context 注入）
│   ├── config.js           前端設定下發
│   ├── save-analysis.js    儲存分析結果（含配額 80% Email 警告）
│   ├── get-analyses.js     取得歷史記錄
│   ├── share.js            產生分享連結
│   ├── admin-data.js       後台資料
│   ├── stripe-checkout.js  建立付款 Session
│   ├── stripe-webhook.js   處理付款事件
│   ├── trends.js           趨勢資料
│   ├── rag-search.js       向量搜尋（OpenAI embed + pgvector）
│   ├── rag-ingest.js       知識庫文件新增（管理員限定）
│   ├── send-email.js       交易型 Email 前端入口（Resend）
│   ├── delete-account.js   帳號完整刪除（雲端資料）
│   └── _email.js           Email 共用模組（歡迎信/配額警告模板）
│
├── supabase-schema.sql     資料庫 Schema（參考用）
├── netlify.toml            部署設定、Redirects、CSP Headers
├── package.json            依賴：@anthropic-ai/sdk、@supabase/supabase-js、stripe
│
└── .claude/
    ├── CLAUDE.md           本檔案（專案記憶）
    ├── settings.json       工具權限白名單/黑名單
    ├── bugs.md             Bug 資料庫（根本原因 + 修復記錄）
    └── commands/           Claude Skills（工作流程）
```

---

## 🔑 Netlify 環境變數

| 變數 | 用途 | 狀態 |
|------|------|------|
| `ANTHROPIC_API_KEY` | Claude AI 分析 | ✅ 已設定 |
| `SUPABASE_URL` | 資料庫連線 | ✅ 已設定 |
| `SUPABASE_SERVICE_ROLE_KEY` | 後端資料庫操作 | ✅ 已設定 |
| `SUPABASE_ANON_KEY` | 前端認證 | ✅ 已設定 |
| `NODE_ENV` | 環境識別 | ✅ production |
| `STRIPE_SECRET_KEY` | Stripe 後端 | ⚠️ 待設定 |
| `STRIPE_PRICE_PRO` | Pro 方案 Price ID | ⚠️ 待設定 |
| `STRIPE_WEBHOOK_SECRET` | Webhook 驗證 | ⚠️ 待設定 |
| `SENTRY_DSN` | 錯誤監控 | ⚠️ 待設定 |
| `OPENAI_API_KEY` | RAG Embedding（text-embedding-3-small）| ⚠️ 待設定 |
| `RESEND_API_KEY` | 交易型 Email（歡迎信、配額警告）| ⚠️ 待設定 |

---

## 🤖 RAG 架構（知識庫增強）

```
用戶輸入（industry, regulatory, provider）
    ↓
OpenAI text-embedding-3-small（1536 維向量）
    ↓
Supabase pgvector cosine search（search_knowledge RPC）
    ↓
找到相關文件（case_study / compliance / vendor / governance）
    ↓
注入 Claude analyze.js prompt → 更精準的分析
```

**知識庫類別**：
- `case_study` — 真實遷移案例（銀行/醫療/零售）
- `compliance` — ISO 27001、MAS TRM、GDPR、個資法
- `vendor` — AWS/Azure/GCP 功能與定價比較
- `governance` — TOGAF、COBIT、Kotter 變革管理
- `architecture` — Landing Zone、Well-Architected 最佳實踐
- `pricing` — 成本參考數據

**管理文件**：`POST /api/rag-ingest`（管理員 Token）
**前端搜尋**：`POST /api/rag-search`（無需登入）

---

## 📧 交易型 Email（Resend）

| 類型 | 觸發時機 | 實作位置 |
|------|---------|---------|
| 歡迎信 | 註冊成功後 | register.html → /api/send-email |
| 配額警告 | 達 80% 使用量 | save-analysis.js 內部 |

---

## 📐 設計系統規範

- **品牌名**：CloudFrame（絕對不是 Smart Archie）
- **CSS 變數**：全部用 `var(--c-xxx)` 在 `css/main.css` 定義
- **間距**：`var(--sp-1)` 到 `var(--sp-12)`
- **圓角**：`var(--r-sm/md/lg/xl/full)`
- **字體大小**：`var(--fs-xs/sm/md/lg/xl/2xl/3xl)`
- **主色**：`--c-primary`（深藍）、`--c-accent-teal`（青）、`--c-gold`
- **語言**：UI 文字繁體中文，程式碼英文，commit message 英文+中文說明

---

## 🗄️ Supabase 資料庫 Schema

```sql
profiles      -- 用戶資料（id, email, name, company, plan, role, stripe_customer_id）
analyses      -- 分析記錄（id, user_id, project_name, strategy, risk_score, inputs, result, share_token）
quota_usage   -- 額度使用（user_id, month, used_count）
```

**方案額度**：free=3次/月、pro=30次/月、enterprise=無限

---

## ⚠️ 已知問題與注意事項

- `package-lock.json` 的 name 欄位還是 `smart-archie`（npm 自動生成，不影響運行）
- Stripe 付款流程程式碼完整，但需填入 3 個環境變數才能真正運作
- 歷史記錄 replay：新分析後的記錄可重開；修復前（無 result 欄位）的舊記錄無法
- **完整 bug 清單見 `.claude/bugs.md`**，每次修完 bug 務必更新

---

## 🚦 開發守則

1. **改功能前**：先說明修改計畫（用 `before-change` skill）
2. **修 bug 前**：先確認根本原因再動手（用 `debug` skill）；查 `.claude/bugs.md` 確認是否已記錄
3. **Netlify function**：一定要有 CORS headers 和 JWT 驗證
4. **CSS**：優先使用 `css/main.css` 現有 class，不要內聯重複樣式
5. **中文編碼**：不用 PowerShell 批次取代（會破壞 UTF-8），改用 Read + Edit 工具
6. **commit 策略（2026-04-24 強化）**：同一 session 所有修改**統一一次 push**，不頻繁小量 push（避免 Netlify Credits 超限）
7. **修完 bug**：更新 `.claude/bugs.md` 的狀態與修復說明
8. **Supabase 查詢**：單筆查詢一律用 `.maybeSingle()`，禁用 `.single()`（0 筆時回傳 406）
9. **新站部署後必做**：Supabase Site URL、Redirect URLs、profiles trigger、schema 欄位完整性
10. **Schema 變更**：新增欄位必須同步更新 `supabase-schema.sql` 並執行 ALTER TABLE
11. **Session 結束**：重大問題執行 `retro` skill，記錄轉折點與觸發-行動清單

---

## 📋 SaaS 完成度（2026-04-22）

### ✅ 已完成
- 核心分析引擎（6R + Landing Zone + 成本 + 風險）
- 決策說明（為什麼是這個策略 + 風險因子說明）
- 用戶認證（Supabase Auth + localStorage fallback）
- 歷史記錄（儲存 + replay 重開報告）
- 匯出（PDF / PNG / Markdown）
- 公開分享（share token）
- 隱私政策 + 服務條款
- 前端輸入驗證（XSS 防護）
- Onboarding 引導（4步驟）
- SEO（meta/OG/canonical/sitemap/robots.txt）
- Stripe 付費程式碼

- 行動版 sidebar（滑動抽屜 mobile drawer）
- 帳號完整刪除（`/api/delete-account` 刪除雲端資料）

- RAG 知識庫（rag-search + rag-ingest + pgvector schema）
- 交易型 Email（Resend：歡迎信 + 配額 80% 警告）

### ⚠️ 待設定（用戶操作）
- Stripe 金鑰（3個 Netlify 環境變數）
- Sentry DSN + Mixpanel Token（Netlify 環境變數）
- OpenAI API Key（Netlify 環境變數）
- Resend API Key（Netlify 環境變數）
- Supabase 執行 `supabase-rag-schema.sql`（啟用 pgvector）
