# 部署前 Smoke Test Checklist

Invoke: `/pre-deploy-check`

---

## 環境設定
- [ ] Supabase Site URL 是否指向正確網域
- [ ] Supabase Redirect URLs 是否包含新網域
- [ ] Cloudflare Pages 環境變數名稱拼字確認（特別是 OPENAI_API_KEY，不是 PENAI_API_KEY）
- [ ] RESEND_API_KEY 是否設定
- [ ] 自訂 email 網域是否在 Resend 驗證完成
- [ ] `env.URL` 是否設定為 `https://cloudframe.pages.dev`（share API fallback 用）

## 資料庫
- [ ] `supabase/migrations/` 最新 migration 是否已執行
- [ ] profiles trigger 是否生效（新用戶註冊後確認有建立 profile 列）
- [ ] `quota_usage` 表是否有當月記錄

## 功能驗證
- [ ] 新用戶完整流程：註冊 → 收驗證信 → 登入 → dashboard
- [ ] 歷史記錄可以點開（新記錄 → replay；舊記錄 → 顯示摘要卡）
- [ ] 分析功能可以跑完整流程
- [ ] PDF 匯出：確認無黑色 loading overlay 蓋入
- [ ] 分享連結：產生連結含 `cloudframe.pages.dev`，新分頁可正常顯示報告
- [ ] RAG ingest 用 admin 帳號測試一筆

## 部署紀律
- [ ] 確認本 session 所有修改統一一次 push（不逐筆）
- [ ] `git diff --stat` 列出本次異動後再 push
- [ ] Commit message 格式：`type: 說明 (batch deploy)`
