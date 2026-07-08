# Skill: Performance Optimization

**觸發時機**：`/performance-optimization`、效能、載入慢、API 超時、Core Web Vitals、Supabase 查詢慢

## 稽核範圍

### 1. API 回應時間
- Cloudflare Functions / Netlify Functions 冷啟動
- 目標：P95 < 2s，P99 < 5s
- 常見瓶頸：Supabase 連線未複用、N+1 查詢、未加索引

### 2. Supabase 查詢優化
```sql
-- 確認高頻查詢有索引
EXPLAIN ANALYZE SELECT * FROM analyses WHERE user_id = $1;
```
- `.select('*')` → 只選需要的欄位
- 多次查詢同表 → 考慮 `.select()` join 或批次查詢
- RLS policy 是否影響查詢計畫

### 3. 前端資源
- JS bundle size：目標 < 200KB gzipped
- 圖片：使用 WebP，加 `loading="lazy"`
- 無用的 CSS → 移除未使用的 class

### 4. Cloudflare 快取策略
- 靜態資源（CSS/JS/圖片）：`Cache-Control: public, max-age=31536000, immutable`
- API 回應：不快取（含用戶資料）
- 確認 Cloudflare Pages 的 `_headers` 設定

### 5. Core Web Vitals 目標
| 指標 | 目標 | 工具 |
|------|------|------|
| LCP  | < 2.5s | PageSpeed Insights |
| INP  | < 200ms | Chrome DevTools |
| CLS  | < 0.1  | Lighthouse |

## 執行步驟

1. 執行 Lighthouse / PageSpeed Insights 取得基線分數
2. 分析 Network waterfall（最大 LCP 資源）
3. 找出 Supabase 慢查詢（> 500ms）
4. 列出 Quick Wins 清單

## 輸出格式

```
## 效能稽核報告

### 🔴 Critical（立即影響用戶體驗）
- [問題] → 預估改善：[X ms / X%]

### Quick Wins（本週可做）
- [問題] → 修法：[建議]

### 基線分數
- LCP: Xs | INP: Xms | CLS: X.X
- PageSpeed Mobile: XX / Desktop: XX
```

## 規則
- 只分析，不自動修改
- 效能改動需有 before/after 數據
- 修復前執行 `/before-change`
