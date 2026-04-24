# CloudFrame — 全局工程規則

> 無 paths 設定，每次對話自動載入。

---

## 部署紀律
- 同一 session 所有修改**統一最後一次 push**，不逐一 push
- Commit message 格式：`type: 說明 (batch deploy)`
- push 前確認：`git diff --stat` 列出本次異動

## 語言規範
- UI 文字：**繁體中文**
- 程式碼、變數名、函式名：**英文**
- Commit message：英文 + 中文說明

## 設計系統
- CSS 全用 `var(--c-xxx)` design token，禁止 hardcode 色碼
- 間距用 `var(--sp-N)`，字體用 `var(--fs-xxx)`
- 新元素優先重用 `css/main.css` 現有 class

## 品牌
- 產品名稱：**CloudFrame**（不是 Smart Archie）
- 主色：`--c-primary`（深藍）、`--c-accent-teal`（青）、`--c-gold`

## Supabase 查詢
- 單筆查詢一律用 `.maybeSingle()`，**禁用 `.single()`**
- 原因：`.single()` 在 0 筆時回傳 HTTP 406

## 錯誤處理
- 所有 async 函式必須有 try-catch 或 .catch()
- 不得 silently fail（至少 console.warn）
- 用戶看到的錯誤訊息用繁體中文

## Session 結束前
- 若有重大 bug 修復 → 執行 `/retro`
- 若有 schema 變更 → 確認 migration 檔已建立
- 若有新功能 → 更新 CLAUDE.md SaaS 完成度
