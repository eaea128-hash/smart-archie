# Skill: Dependency Audit

**觸發時機**：`/deps-audit`、套件安全、CVE 漏洞、npm audit、授權合規

## 稽核範圍

### 1. 安全漏洞掃描
```
npm audit --audit-level=moderate
```
- Critical / High → 立即處理，不得上線
- Moderate → 本週排入修復
- Low / Info → 記錄，下次依賴升級時順帶處理

### 2. 過時套件檢查
```
npm outdated
```
- Major version 落後 → 評估 breaking change 再升級
- Minor / Patch 落後 → 可直接升級

### 3. 授權合規
- 禁用授權：GPL（病毒式傳染）、AGPL
- 可接受：MIT、Apache 2.0、ISC、BSD
- 可疑套件：無授權或授權不明 → 禁止使用

### 4. 幽靈依賴 / 未使用依賴
- 檢查 `package.json` 中有無未實際 import 的套件
- 檢查 `devDependencies` 是否錯放入 `dependencies`

## 執行步驟

1. 執行 `npm audit` 並截錄輸出
2. 執行 `npm outdated` 列出過時套件
3. 對照 `package.json` 確認授權
4. 列出 Critical/High 漏洞修復清單

## 輸出格式

```
## 依賴稽核報告

### 🔴 Critical / High（立即處理）
- [套件名稱] vX.X.X → CVE-XXXX-XXXX → 修法：npm update / 替換方案

### 🟡 Moderate（本週處理）
- [套件名稱] → 說明

### 📋 授權問題
- [套件名稱] → 授權：GPL → 建議替換

### ✅ 通過項目
- 無 Critical/High 漏洞
- 授權合規
```

## 規則
- 只分析，不自動執行 `npm install` 或 `npm update`
- 修復前執行 `/before-change`
- Critical 漏洞不得帶入生產環境
