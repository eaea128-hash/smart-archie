# CloudFrame — Bug 資料庫

> 記錄已知問題、修復狀況與根本原因。每次修 bug 後更新此檔案。
> Claude 在每次 debug 前會先查這裡，避免重複踩坑。

---

## 格式說明

```
### [BUG-XXX] 標題
- **狀態**：🔴 未修 / 🟡 修復中 / ✅ 已修復
- **發現日期**：YYYY-MM-DD
- **影響頁面**：dashboard.html / analyze.html / ...
- **現象**：用戶看到什麼
- **根本原因**：為什麼會發生
- **修復方法**：改了什麼
- **驗證方式**：怎麼確認修好了
```

---

## ✅ 已修復

### [BUG-001] 歷史記錄點進去顯示「開發中」
- **狀態**：✅ 已修復（2026-04-22）
- **影響頁面**：dashboard.html → analyze.html
- **現象**：點歷史記錄項目後，analyze.html 顯示「功能開發中」
- **根本原因**：
  1. `get-analyses.js` SELECT 沒有包含 `inputs, result` 欄位
  2. `saveToHistory()` 沒有把 `inputs` / `result` 存入 localStorage
  3. `loadHistoryItem()` 沒有實作 replay 邏輯
- **修復方法**：
  - API 加上 `inputs, result` 欄位
  - `saveToHistory()` 加入完整 result 物件
  - `loadHistoryItem()` 存入 sessionStorage → 跳轉 `?replay=1`
  - analyze.html DOMContentLoaded 讀取 sessionStorage 重建結果
- **驗證**：新增分析後進儀表板點歷史記錄，應重開完整報告

---

### [BUG-002] KPI 評估分數長條圖不顯示顏色
- **狀態**：✅ 已修復（2026-04-22）
- **影響頁面**：analyze.html（結果頁面）
- **現象**：KPI 長條圖是灰色，數值與圖示不符
- **根本原因**：
  - CSS 只有 `.progress-fill.success/warning/danger`
  - HTML 用的是 `.kpi-fill`（不同 class name）
  - 兩組 class 同名不同，CSS 無法匹配
- **修復方法**：在 `main.css` 加入 `.kpi-fill.success/warning/danger` 規則
- **驗證**：重新執行分析，KPI 長條圖應顯示綠/橙/紅對應顏色

---

### [BUG-003] 策略信心度長條圖卡在 0%
- **狀態**：✅ 已修復（2026-04-22）
- **影響頁面**：analyze.html
- **現象**：信心度圓弧/長條永遠是 0%
- **根本原因**：`animateKPI()` 的 selector 是 `.kpi-fill, .progress-fill`，漏掉 `.conf-fill`
- **修復方法**：`utils.js` animateKPI selector 加入 `.conf-fill`，並加 `width='0%'` reset
- **驗證**：執行分析後信心度應動態增長到正確值

---

### [BUG-004] 趨勢雷達頁面標題被 Navbar 蓋住
- **狀態**：✅ 已修復（2026-04-22）
- **影響頁面**：trends.html
- **現象**：頁面頂部大標題被固定導覽列遮住
- **根本原因**：`.trends-hero` 沒有 `padding-top` 補償 `position: fixed` 的 navbar 高度
- **修復方法**：`padding: calc(var(--nav-h) + var(--sp-10)) var(--sp-8) var(--sp-12)`
- **驗證**：打開 trends.html，標題應完整可見

---

### [BUG-005] Navbar Avatar 顯示「?」
- **狀態**：✅ 已修復（2026-04-22）
- **影響頁面**：dashboard.html（navbar）
- **現象**：右上角頭像顯示「?」而不是用戶名稱首字
- **根本原因**：`auth.js` 的 `injectNavUser()` 只更新 `#sidebarAvatar`，但 navbar 用的是 `id="nav-avatar"`
- **修復方法**：`auth.js` 加入對 `#nav-avatar` 的明確更新
- **驗證**：登入後 navbar 右上角應顯示用戶名首字母

---

### [BUG-006] KPI 分數數字顏色不對
- **狀態**：✅ 已修復（2026-04-22）
- **影響頁面**：analyze.html
- **現象**：KPI 卡片分數數字顏色不隨值改變
- **根本原因**：HTML 用 `.kpi-card-score.high/medium/low`，CSS 用 `.kpi-score.high/medium/low`（class 名稱不同）
- **修復方法**：`main.css` 加入 `.kpi-card-score.high/medium/low` 規則
- **驗證**：分析結果中分數應顯示綠/橙/紅對應顏色

---

### [BUG-007] 帳號刪除只清除本機，雲端資料未刪除
- **狀態**：✅ 已修復（2026-04-22）
- **影響頁面**：dashboard.html（個人資料 → 危險區域）
- **現象**：點刪除帳號後只清除 localStorage，Supabase 資料庫仍保留用戶資料
- **根本原因**：`confirmDeleteAccount()` 沒有呼叫後端 API，只做前端登出
- **修復方法**：
  - 新建 `netlify/functions/delete-account.js`（刪 analyses + profiles + auth user）
  - `dashboard.html` 改為呼叫 `DELETE /api/delete-account` 後再登出
- **驗證**：刪除帳號後用相同 email 嘗試登入應失敗

---

### [BUG-008] 行動裝置 Sidebar 消失無替代
- **狀態**：✅ 已修復（2026-04-22）
- **影響頁面**：dashboard.html（< 768px 螢幕）
- **現象**：手機上左側導航列消失，無法切換頁籤
- **根本原因**：`@media (max-width: 768px)` 只設 `display: none`，沒有行動版替代方案
- **修復方法**：
  - navbar 加入漢堡按鈕（僅手機顯示）
  - 加入滑動抽屜（mobile drawer）和背景遮罩
  - `toggleMobileDrawer(open)` function 控制開關
- **驗證**：手機寬度下應出現 ☰ 按鈕，點擊後側欄滑入

---

## 🔴 未修復 / 待確認

### [BUG-009] 舊的歷史記錄（無 result 欄位）無法重開
- **狀態**：🔴 設計限制（非 bug）
- **影響頁面**：dashboard.html
- **現象**：部署 BUG-001 修復前儲存的分析記錄，點擊後顯示「此記錄資料不完整，無法重開」
- **根本原因**：舊記錄沒有 `result` 欄位（修復前的資料結構）
- **說明**：這是預期行為。可以考慮顯示只讀的摘要資訊（project_name, strategy, risk_score）而不是完整報告
- **建議修復**：在 `loadHistoryItem()` 對舊記錄顯示部分資訊卡，而非直接 return

---

### [BUG-010] 手機版計畫方案卡片三欄版面擠在一起
- **狀態**：✅ 已修復（2026-04-22）
- **影響頁面**：dashboard.html（方案 tab）
- **現象**：三個方案卡片在手機上依舊並排，文字被壓縮
- **修復方法**：加入 `.plan-grid { grid-template-columns: 1fr !important; }` 於手機 breakpoint

---

---

## ℹ️ 架構注意事項

### [ARCH-001] RAG 降級設計
- RAG 搜尋（`getRagContext()`）失敗時靜默略過，不影響主分析流程
- 若 `OPENAI_API_KEY` 未設定，直接回傳空字串
- 若 pgvector 搜尋 0 筆結果，同樣略過，Claude 使用自身知識回答

### [ARCH-002] Email 降級設計
- `RESEND_API_KEY` 未設定時，只印 warning log，不拋錯
- 配額警告是非同步 fire-and-forget，不影響 save-analysis 的主要回應

---

---

## 2026-04-24 批次修復（Config Drift Session）

### [BUG-011] Supabase Site URL 指向舊網址
- **狀態**：✅ 已修復（2026-04-24）
- **影響**：所有 auth email 連結（驗證、重設密碼）
- **現象**：點驗證信連結跳到 ai-product-analyzer.netlify.app
- **根本原因**：Supabase Auth > URL Configuration > Site URL 從未更新
- **修復**：手動至 Supabase Dashboard 更新 Site URL + Redirect URLs
- **根因分類**：Config Drift

### [BUG-012] .single() 在 0 筆時回傳 HTTP 406
- **狀態**：✅ 已修復（2026-04-24）
- **影響**：所有頁面登入流程（Dashboard 尤其明顯）
- **現象**：Console 大量 406 Forbidden
- **根本原因**：PostgREST `.single()` 在查無資料時回傳 PGRST116（406）；新用戶無 quota 記錄
- **修復**：auth.js 全部 `.single()` 改為 `.maybeSingle()`（5 處）
- **根因分類**：Edge Case

### [BUG-013] analyses 表欄位不完整導致 500
- **狀態**：✅ 已修復（2026-04-24）
- **影響**：dashboard.html 歷史記錄載入
- **現象**：`/api/get-analyses` 回傳 500，錯誤訊息 `column analyses.project_name does not exist`
- **根本原因**：DB schema 在程式碼新增欄位後沒有同步執行 ALTER TABLE
- **修復**：Supabase SQL Editor 執行 ALTER TABLE 補齊 8 個欄位；get-analyses 加 fallback + try-catch
- **根因分類**：Config Drift

### [BUG-014] Netlify Credits 超限網站暫停
- **狀態**：✅ 已修復（2026-04-24）
- **影響**：整個 SaaS 服務停擺
- **現象**：Netlify 顯示 "This team has exceeded the credit limit"
- **根本原因**：52 次 production deploy × 15 credits = 780（免費上限 500）
- **修復**：購買額外 Credits；改採批次 push 策略
- **預防**：每個 session 統一一次 push，不頻繁小量 commit

### [BUG-015] RAG 匯入 403 — profiles 表無用戶資料
- **狀態**：✅ 已修復（2026-04-24）
- **影響**：/api/rag-ingest 管理員功能
- **現象**：全部 8 筆 403「需要管理員權限」
- **根本原因**：Supabase trigger 未自動建立 profile 資料列；profiles 表為空
- **修復**：手動 INSERT profile + 設定 role='admin', plan='enterprise'
- **根因分類**：Config Drift

---

## 📊 統計

| 類別 | 數量 |
|------|------|
| 已修復 | 15 |
| 未修復 | 0 |
| 設計限制 | 1 |
| 架構注意事項 | 2 |

_最後更新：2026-04-24_
