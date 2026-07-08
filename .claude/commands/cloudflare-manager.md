# Skill: Cloudflare Manager

**觸發時機**：`/cloudflare-manager`、Cloudflare Pages、部署失敗、環境變數、DNS、快取清除

## 功能範圍

### Pages 部署管理
- 確認最新部署狀態與 build logs
- 排查部署失敗原因（build error、環境變數缺失）
- 確認 production / preview 環境差異

### 環境變數核對
```
□ 確認 Cloudflare Pages > Settings > Environment Variables
□ Production / Preview 環境各自設定
□ 敏感值（API Key）確認有加密儲存
```

### DNS 設定
- 確認自訂網域 CNAME 指向正確
- SSL 憑證狀態（Full / Full Strict）
- 重新導向規則（www → non-www 或反之）

### 快取控制
- 頁面更新後若顯示舊版 → 建議清除 Cloudflare Cache
- 靜態資源快取策略（CSS / JS / 圖片）
- `Cache-Control` header 設定建議

### Workers（CloudFrame 適用）
- Functions API 路由確認（`functions/api/` 目錄）
- Worker 執行錯誤排查
- KV Storage 操作建議

## 常用操作指引

```
部署失敗排查流程：
1. Cloudflare Pages > Deployments > 查看 Failed build log
2. 確認 build command 與 output directory 設定
3. 確認所有必要環境變數已設定
4. 重新觸發部署（Retry deployment）
```

## 注意事項
- API Key 請勿貼入對話，透過 Cloudflare 後台設定
- 生產環境的變更建議先在 Preview 分支測試
