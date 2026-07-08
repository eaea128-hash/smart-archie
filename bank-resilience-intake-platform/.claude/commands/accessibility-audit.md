# Skill: Accessibility Audit（WCAG 核對）

**觸發時機**：`/accessibility-audit`、無障礙、WCAG、色彩對比、鍵盤操作、screen reader

## 稽核範圍

### 色彩對比
- 一般文字：4.5:1（WCAG AA）
- 大字標題：3:1
- 使用 `var(--c-xxx)` design token 確認對比值
- 特別查：主色 `--c-primary` 搭配白色背景的對比

### 鍵盤導覽
- Tab 鍵可到達所有互動元素
- 邏輯 Tab 順序
- 可見的 focus 指示器
- Modal / Dropdown 有 Escape 關閉
- 無鍵盤陷阱

### 語意標記
- 每頁有且只有一個 `<h1>`
- 標題層級不跳號（h2 → h3，非 h2 → h4）
- 圖片有 `alt`（裝飾性圖片用 `alt=""`）
- 表單 `<input>` 有對應 `<label>`

### 表單可及性
- 錯誤訊息清楚描述問題
- 必填欄位有明確標示
- 送出後有成功/失敗的文字回饋

### ARIA 使用
- 不用 ARIA 代替語意 HTML
- `aria-label` 有意義（非空白）
- 動態內容更新有 `aria-live`

## 輸出格式

```
✅ 通過：[項目]
❌ 違規：[項目] — WCAG [條款] → 修法建議
⚠️  建議：[項目] — 可進一步改善
```
