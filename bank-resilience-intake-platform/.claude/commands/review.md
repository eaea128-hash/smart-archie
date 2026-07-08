# Skill: Code Review

**觸發時機**：使用者說「review」、「檢查」、「這樣對嗎」、「確認一下」

## 檢查清單

### 安全性
- [ ] 有無 XSS 注入風險（HTML innerHTML 未過濾）
- [ ] API 端點有無驗證 JWT token
- [ ] 敏感資料有無暴露在前端
- [ ] CORS 設定是否過於寬鬆

### 功能正確性
- [ ] 邏輯與需求描述是否吻合
- [ ] Edge case 是否處理（null、undefined、空陣列）
- [ ] 非同步錯誤是否有 catch

### 可維護性
- [ ] 函數是否單一職責
- [ ] 命名是否清楚易懂
- [ ] 是否有重複程式碼可抽取

### CloudFrame 專案規範
- [ ] 中文 UI 文字是否繁體
- [ ] CSS class 是否使用現有 design system（main.css）
- [ ] Netlify function 是否有 CORS headers
- [ ] 品牌名稱是否為「CloudFrame」（非 Smart Archie）

## 輸出格式
```
✅ 通過：[項目]
⚠️ 建議：[項目] — [說明]
❌ 問題：[項目] — [說明] → 建議修法
```
