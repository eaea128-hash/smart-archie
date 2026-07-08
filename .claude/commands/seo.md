# Skill: SEO Audit

**觸發時機**：`/seo`、提到 SEO、搜尋排名、meta tags、schema、sitemap、robots.txt、Google 索引

## 初始設定

第一次使用請告知：
- 網站網域（CloudFrame 的 production URL）
- 主要頁面清單
- 目標關鍵字

## 稽核範圍（9 大項目）

✓ 每頁 title、meta description、canonical URL
✓ Open Graph & Twitter Card tags
✓ JSON-LD 結構化資料（WebSite、SoftwareApplication）
✓ robots.txt 與 sitemap.xml 是否存在且正確
✓ 圖片 alt text 品質
✓ H1 標題使用與層級
✓ 內部連結結構
✓ HTTPS、trailing slash 一致性
✓ 行動裝置友善性

## 輸出格式

```
✅ 通過：[項目]
❌ 缺失：[項目] → 建議修法
⚠️  建議：[項目] → 可優化方向
```

稽核後直接提供可插入 HTML 的修正程式碼。

## 指令範例

- `/seo` — 執行完整稽核
- `/seo meta` — 只查 meta tags
- `/seo schema` — 只查結構化資料
- `/seo images` — 只查圖片 alt text
