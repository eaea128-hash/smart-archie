---
paths:
  - "*.html"
---

# HTML 頁面開發規則

> 每次編輯根目錄 .html 檔案時自動載入。

---

## 每個 HTML 必備的 head 結構

```html
<head>
  <meta charset="UTF-8">
  <link rel="icon" href="/favicon.svg" type="image/svg+xml">  <!-- 必須 -->
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>頁面名稱 | CloudFrame</title>
  <meta name="description" content="...">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
  <link rel="stylesheet" href="css/main.css">
</head>
```

---

## Script 載入順序（必須）

```html
<!-- 1. 效能較重的第三方 → 加 defer -->
<script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.min.js" defer></script>

<!-- 2. Sentry（錯誤監控）→ 越早載入越好 -->
<script src="https://browser.sentry-cdn.com/7.99.0/bundle.min.js" crossorigin="anonymous"></script>

<!-- 3. Supabase SDK -->
<script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/umd/supabase.min.js"></script>

<!-- 4. 專案 JS（依賴順序）-->
<script src="js/supabase-client.js"></script>
<script src="js/utils.js"></script>
<script src="js/auth.js"></script>
<script src="js/analytics.js"></script>
```

---

## Config 初始化（每個需要 Supabase 的頁面）

```javascript
document.addEventListener('DOMContentLoaded', async () => {
  try {
    const cfg = await fetch('/api/config').then(r => r.json());
    window.__SA_CONFIG__ = cfg;
    // Supabase 現在可用
  } catch {
    // localStorage fallback 模式
  }
});
```

---

## CSS 規範

```css
/* ✅ 使用 design token */
color: var(--c-primary);
padding: var(--sp-4);
border-radius: var(--r-lg);
font-size: var(--fs-sm);

/* ❌ 禁止 hardcode */
color: #0F2B3D;
padding: 16px;
border-radius: 8px;
font-size: 14px;
```

---

## 新頁面 checklist

```
□ head 有 <link rel="icon" href="/favicon.svg">
□ 有 viewport meta tag
□ 有 <link rel="canonical">（SEO）
□ CSS 全用 design token
□ Script 依正確順序載入
□ 有 /api/config 初始化
□ 行動版 RWD 測試（< 768px）
□ 加入 netlify.toml redirects（若需要）
```

---

## 禁止事項

```
❌ 內聯重複樣式（抽到 css/main.css）
❌ hardcode 色碼或間距數值
❌ 忘記 favicon link
❌ script 載入順序錯誤（auth.js 在 supabase-client.js 之前）
❌ 中文字符編碼問題（一律用 Read + Edit，不用 PowerShell）
```
