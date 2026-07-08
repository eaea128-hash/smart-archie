# Skill: Compliance Check（法遵核對清單）

## 觸發關鍵字
`compliance`, `法遵`, `合規`, `金管會`, `MAS TRM`, `個資`, `GDPR`, `DPIA`, `audit`, `compliance-check`

## 角色定位
針對金融業（國泰金控情境）的 SaaS 平台，在每次**重大功能上線前**執行法遵核對。  
輸出可直接用於 IT 主管 review 或合規單位存查。

---

## 使用時機

- 新功能涉及個人資料收集或處理
- 跨境資料傳輸（台灣 → 海外雲端）
- 新增 AI 分析功能（Claude、OpenAI 等）
- 上線前合規審查

---

## Layer 1｜個人資料保護（個資法 / GDPR）

```
□ 資料最小化原則
  → 只收集分析必要的欄位
  → 確認 analyses.inputs 沒有儲存非必要個資

□ 儲存目的限制
  → analyses 資料有明確保存期限嗎？
  → 是否有自動刪除機制（超過 N 個月）？

□ 用戶同意
  → 服務條款 terms.html 有說明 AI 分析資料使用方式
  → 隱私政策 privacy.html 有說明第三方服務（Anthropic、Supabase、OpenAI）

□ 用戶資料刪除權
  → /api/delete-account 可完整刪除：analyses、profiles、auth user
  → 確認 delete-account.js 有刪除 knowledge_base 中用戶相關資料（若有）

□ 資料外洩通報
  → 若發生資料外洩，有無 72 小時內通報機制？
  → 緊急聯絡人清單是否更新？
```

---

## Layer 2｜雲端服務資料主權

```
□ 資料存放地點
  → Supabase 專案區域：________（確認是否符合法規要求）
  → Anthropic API：資料是否過美國伺服器？
  → OpenAI Embedding：資料是否過美國伺服器？

□ 跨境傳輸評估
  → 分析輸入的企業資料（行業、系統規模）有無敏感性？
  → 是否需要在 terms.html 揭露跨境傳輸事實？

□ 資料不用於訓練
  → Anthropic API 是否設定不用於模型訓練？
  → （檢查：Anthropic 商業 API 預設不用於訓練，確認帳號類型）
```

---

## Layer 3｜MAS TRM（新加坡金融管理局科技風險管理指引）

```
□ 第三方服務風險評估
  → Anthropic（AI）：服務可用性 SLA？資料處理合約（DPA）？
  → Supabase（資料庫）：SLA、備份頻率、DR 方案？
  → Netlify（運算）：SLA、部署回滾機制？

□ 存取控制
  → admin role 有哪些人？（應限制最小範圍）
  → Supabase service_role key 只在後端使用，未暴露前端？
  → Netlify 環境變數是否設為 Secret？

□ 變更管理
  → 重大功能變更有無 before-change skill 記錄？
  → 程式碼審查（/review）是否執行？

□ 稽核日誌（Audit Log）
  → analyses 表有 created_at timestamp ✅
  → 是否記錄 user_id + action type（分析/刪除/分享）？
  → 管理員操作（rag-ingest、admin-data）有無 log？
```

---

## Layer 4｜TCFD（氣候相關財務揭露）— 碳排功能專用

```
□ 碳排數據來源可追溯
  → RAG 知識庫的碳強度數據有標注資料來源與年份？
  → 分析報告有說明數據基準（gCO2eq/kWh）的定義？

□ 數據更新機制
  → 碳強度數據多久更新一次？（電網數據每年變動）
  → 有無標注「數據截至 YYYY 年」的免責說明？

□ Scope 定義正確
  → 雲端遷移影響的是 Scope 2（購買電力）
  → 報告中有無混淆 Scope 1/2/3？

□ 符合台灣金管會要求
  → 上市公司 2024 年起需依 TCFD 揭露
  → CloudFrame 分析報告輸出是否可作為 TCFD 附件使用？
```

---

## Layer 5｜ISO 27001 基礎控制

```
□ A.9 存取控制
  → 所有 API 有 JWT 驗證（Bearer token）
  → 管理員功能有 role='admin' 二次驗證

□ A.12 操作安全
  → 環境變數未出現在程式碼或 git history
  → .gitignore 包含 .env 等敏感檔案

□ A.14 系統取得、開發及維護
  → XSS 防護（前端輸入驗證已實作）
  → SQL Injection 防護（使用 Supabase SDK 參數化查詢）
  → CSP Headers 設定（netlify.toml 已設定）

□ A.17 業務連續性
  → Netlify 有 rollback 機制（Deploys > 選舊版本 > Publish）
  → Supabase 有每日備份（免費方案 7 天）
```

---

## 輸出格式

執行完後產生：

```markdown
## 法遵核對報告 — YYYY-MM-DD

### 通過項目
- [列出 ✅ 的項目]

### 待改善項目
- [列出 ❌ 或 □ 未確認的項目]

### 風險等級
🔴 高風險（需立即處理）
🟡 中風險（下個 sprint 處理）
🟢 低風險（納入 roadmap）

### 建議行動
1. ...
2. ...
```

---

## 金融業加碼建議（給國泰情境）

若要提升到金融級合規水準，建議加入：

| 功能 | 說明 | 優先度 |
|------|------|--------|
| Audit Log 資料表 | 記錄所有用戶操作（分析/刪除/分享）| 🔴 高 |
| 資料保存期限自動清除 | 超過 2 年的 analyses 自動封存 | 🟡 中 |
| DPA 合約連結 | 在 terms.html 列出各第三方的 DPA 連結 | 🟡 中 |
| 碳數據更新通知 | RAG 知識庫每季更新提醒 | 🟢 低 |
