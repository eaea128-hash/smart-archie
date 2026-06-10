# Bank Resilience Intake Platform

銀行科技韌性前期盤點平台

**把新興科技風險從分散填報，轉成跨部門可查閱、可追蹤、可稽核的治理資料流。**

第一個應用場景：**PQC / Quantum Readiness 後量子密碼遷移準備度前期盤點**

## 1. 專案名稱

**Bank Resilience Intake Platform** 是銀行新興科技風險治理的前期示範 / POC。

中文名稱：**銀行科技韌性前期盤點平台**

## 2. 專案定位

本平台協助銀行將 PQC、智慧化系統風險、供應商科技韌性等新興科技議題，轉成跨部門可執行、可追蹤、可稽核的治理流程，而非停留在分散填報。

本平台聚焦正式工具導入前的新興科技風險治理 Intake：讓業務、PM、系統 Owner、資安、架構、採購與供應商，用同一套資料模型描述系統、資料生命週期、加密依存、供應商準備度、政策依據與待辦責任。

## 3. 本專案不是資安掃描器

本專案不取代，也不宣稱具備以下工具能力：

- CBOM 或密碼物料清單工具
- CMDB 或正式 IT 資產管理系統
- GRC、稽核或法遵工作流平台
- SIEM、SOC 或資安事件監控平台
- 弱點掃描、原始碼掃描或滲透測試工具
- IBM、SandboxAQ 或其他專業 PQC discovery 工具

本平台定位在上述工具之前，作為銀行 PQC 遷移前期的治理 intake 層。它產生的是可交接給資安、架構、採購與主管會議使用的治理資料，不是掃描結果。

## 4. 解決的銀行痛點

- 業務單位看不懂資安語言，導致盤點填報失真
- 資安單位看不懂業務白話，無法快速判斷 HNDL 風險
- 同一供應商服務多個系統，PQC 準備度回覆重複追問
- 外部 API、批次檔、憑證、簽章與資料保存年限缺乏統一欄位
- 政策要求更新後，難以找出受影響問題、系統與報告缺口
- 待辦責任分散在業務、系統 Owner、資安、架構、採購與供應商之間

## 5. 第一個應用場景：PQC / Quantum Readiness

PQC / Quantum Readiness 聚焦於後量子密碼遷移前期準備度盤點，特別是：

- HNDL：Harvest Now, Decrypt Later，現在攔截、未來解密
- 長期保存敏感資料的風險排序
- RSA / ECC / TLS / 憑證 / HSM / API token / 批次檔加密依存初步盤點
- 供應商 PQC 遷移計畫與加密調整能力追蹤
- 監理、NIST、CISA 與內部政策的合規軌跡

NIST NCCoE 的 PQC 遷移專案強調，組織需要先建立密碼使用可視化與風險管理能力，再推動從量子脆弱的公鑰加密演算法遷移到 NIST 標準化的 PQC 演算法。CISA、NSA、NIST 的量子準備文件也要求組織建立量子準備路線圖、進行盤點、與供應商互動並依風險排序遷移工作。這代表 PQC 不是單一技術問題，而是跨資產、供應商與組織責任的治理問題。

## 6. 三個管理能力

### Risk Visibility：風險可視化

目的：讓主管知道哪裡最危險、哪裡最需要優先投入。

對應能力：

- Dashboard
- HNDL Analysis
- Vendor Readiness
- 風險分布圖

| 高層會問 | 平台要回答 |
| --- | --- |
| 哪些系統最需要優先看？ | HNDL 高風險排行 |
| 哪些資料保存太久？ | 超過 10 年 / 永久保存系統 |
| 哪些供應商沒有準備？ | PQC 遷移計畫未提供清單 |
| 哪些跨機構串接風險高？ | 外部 API / 聯徵 / 財金 / 醫療交換 |

### Explainability：風險可解釋

目的：避免主管或資安質疑「系統怎麼判斷」。本示範的風險判斷不是黑箱推論，而是明確規則、觸發原因與政策來源。

對應能力：

- `explainRiskForSystem()`
- `RiskExplanationPanel`
- 11 條風險規則
- `policySource` / `policyReference`

範例：

```text
保單理賠系統：高風險

原因：
1. 資料永久保存
2. 包含保單、醫療、個資資料
3. 涉及外部醫療院所資料交換
4. 供應商尚未提供 PQC 遷移計畫
5. 存在憑證 / API / 加密模組待確認事項

政策依據：
- FSC 金融資安韌性發展藍圖 — 後量子密碼遷移準備
- NIST NCCoE Migration to Post-Quantum Cryptography
- CISA Quantum Readiness Roadmap
```

### Evidence & Accountability：證據與責任追蹤

目的：讓平台不像一般展示頁，而像銀行治理工具。系統可以協助整理文字，但銀行真正需要的是：哪個單位要補件、哪個供應商未回覆、哪條規則觸發、哪個政策來源要求、哪次匯出報告作為會議證據。

對應能力：

- Evidence Pack
- Cross-functional Tasks
- GuardrailPanel
- Compliance Lineage
- 政策變更影響模擬

## 7. 管理訊息地圖

| 順序 | 頁面 | 要講的管理訊息 |
| ---: | --- | --- |
| 1 | Dashboard | 全行 PQC 準備度不是平均看，而是先看高風險系統、供應商缺口、補件壓力 |
| 2 | HNDL Analysis | 房貸、保單、醫療資料因保存年限長，會形成 Harvest Now, Decrypt Later 風險 |
| 3 | Risk Explanation | 風險不是黑箱判斷，是 11 條明確規則加總，每條有政策來源 |
| 4 | Vendor Readiness | 同一供應商服務多個系統，準備度回覆可複用，降低重複追問成本 |
| 5 | Cross-functional Tasks | 業務白話自動轉成資安、採購、供應商待辦，解決跨部門語言不通 |
| 6 | Compliance Lineage | 每題與每條規則都能追溯政策來源，政策更新時可找出需補件系統 |
| 7 | Evidence Pack | 產出主管會議、資安評估與後續追蹤可用的盤點證據包 |

## 8. Executive Demo Walkthrough

主管簡報建議路線（7 步驟）。`/storyboard` 可作為開場一頁式主管說明，正式展示則從 Dashboard 開始：

| 步驟 | 頁面 | 展示重點 |
| ---: | --- | --- |
| 1 | Dashboard（`/`） | 全行風險總覽：本期主要風險、需主管介入事項、供應商缺口、補件壓力、建議下一步 |
| 2 | HNDL Analysis（`/hndl`） | 長期敏感資料高風險：房貸、保單、醫療資料為何需優先納入 PQC 遷移 |
| 3 | Risk Explanation | 規則透明，不是黑箱判斷：每條風險規則都有編號、分數、原因與政策來源 |
| 4 | Vendor Readiness（`/vendors`） | 供應商準備度可複用，降低同一供應商多系統重複追問成本 |
| 5 | Cross-functional Tasks（`/tasks`） | 跨部門待辦與雙向轉譯：業務語言轉成資安、採購、供應商可執行事項 |
| 6 | Compliance Lineage（`/lineage`） | 政策來源與合規應變：新監理要求發布後，找出受影響系統與補件任務 |
| 7 | Evidence Pack（`/report`） | 盤點證據包作為主管會議、資安評估與後續追蹤依據 |

> **展示建議**：先用 Executive Storyboard 交代「為什麼現在要做」，再從 Dashboard 進入七步驟展示。

## 9. 核心功能

- Executive Storyboard 高層定位說明頁
- Dashboard 主管儀表板（含管理摘要）
- PQC Intake 新興科技風險治理 Intake
- HNDL 資料生命週期風險分析
- Vendor Readiness 供應商準備度資料庫
- Cross-functional Tasks 跨部門待辦與雙向轉譯
- Compliance Lineage 合規軌跡
- Evidence Pack 盤點證據包
- Settings 示範設定頁

## 10. Evidence Pack 盤點證據包

Evidence Pack 是本 POC 的正式輸出物。它不是單純報告，而是把前期盤點轉成可稽核、可追蹤、可交接的治理證據。

| 區塊 | 內容 | 價值 |
| --- | --- | --- |
| Snapshot | 系統、供應商、匯出時間、資料版本 | 形成時間點證據 |
| Business Context | 業務重要性、資料類型、保存年限、外部串接 | 補足資安工具缺的業務脈絡 |
| Risk Explanation | 觸發規則、分數、原因 | 避免黑箱 |
| Guardrail Alerts | 缺漏、矛盾、待補件 | 證明盤點品質有控管 |
| Compliance Lineage | FSC / NIST / CISA / Internal Policy 對應 | 可稽核 |
| Action Items | 業務、資安、採購、供應商待辦 | 可追蹤 |
| Known Limits | 假資料、非掃描器、需資安確認 | 降低誤用風險 |

支援匯出：

- JSON
- CSV
- Markdown
- Print-friendly HTML，可由瀏覽器列印成 PDF

## 11. 使用技術

- React
- Vite
- TypeScript
- Tailwind CSS
- shadcn/ui 風格元件
- lucide-react
- recharts
- localStorage 示範資料儲存

## 12. 啟動方式

```bash
cd bank-resilience-intake-platform
npm install
npm run dev
```

預設本機網址通常為：

```text
http://localhost:5173
```

建置檢查：

```bash
npm run lint
npm run build
npm test
```

目前 `npm run lint` 執行 TypeScript 靜態檢查；若需正式導入，可再加入 ESLint 與 React hooks 規則。

## 13. 示範假資料說明

所有示範資料均為虛構，不包含任何真實公司、客戶、供應商或內部系統資料。

資料涵蓋：

- 12 筆銀行內部模擬系統
- 8 筆供應商準備度狀態
- 跨部門待辦
- CMDB tags 與 crypto signals
- 合規軌跡
- 盤點資料送出後寫入 localStorage 的新增盤點案件

資料入口包含：

- `src/data/demo-data.ts`
- `src/data/mockSystems.ts`
- `src/data/mockVendors.ts`
- `src/data/mockTasks.ts`
- `src/data/mockComplianceLineage.ts`
- `src/data/mockCmdbTags.ts`

## 14. 風險規則說明

本平台不使用黑箱判斷風險。風險等級由明確規則觸發，規則集中在：

- `src/lib/risk-rules.ts`
- `src/rules/riskRules.ts`
- `src/rules/hndlRiskRules.ts`
- `src/rules/vendorRiskRules.ts`
- `src/rules/cryptoSignalRules.ts`
- `src/rules/validationRules.ts`
- `src/rules/taskGenerationRules.ts`

每條風險規則包含：

- `ruleId`
- 規則名稱
- 觸發條件
- 分數貢獻
- 政策來源
- 觸發原因說明

資料防呆規則涵蓋：

- 敏感資料但未填保存年限
- 外部串接但未填外部對象
- 供應商 PQC 遷移計畫未提供或未確認
- legacy crypto / TLS 1.0 / TLS 1.1 / weak cipher 與低風險判斷矛盾
- 合約到期日小於 6 個月
- 長期保存敏感資料標示 HNDL 高風險
- 跨機構資料交換但未填憑證、簽章、token 或加密傳輸

## 15. 合規軌跡說明

Compliance Lineage 頁面讓每一個盤點問題、風險規則與報告欄位都可追溯政策來源，例如：

- FSC 金管會金融資安韌性
- NIST NCCoE PQC Migration
- CISA Quantum Readiness
- Internal Policy 內部政策

示範情境包含未來政策新增「需列出跨機構 API 串接點」後，平台如何找出缺口系統、標示補件、產生任務並更新報告缺口。

## 16. 未來可延伸方向

- 擴展到智慧化系統風險、第三方科技韌性、雲端重大變更前期盤點
- 串接真實 CMDB / GRC / 供應商管理平台
- 匯入 CBOM 或 PQC discovery 工具輸出
- 盤點版本管理與政策變更影響分析
- 與 Jira / ServiceNow / GRC 平台建立待辦同步
- 增加審核流程、角色權限與稽核軌跡
- 將 localStorage 改為正式後端資料庫

## 17. 已知限制

- 純前端 POC，資料僅存於 localStorage
- 不應存放任何真實公司或個人資料
- 風險分數為 POC 規則模型，非正式量化風險模型
- PDF 目前採瀏覽器列印，不是伺服器端 PDF 產生
- 尚未加入登入、權限、多人協作與正式稽核紀錄
- `lint` 目前為 TypeScript 型別檢查，尚未導入 ESLint 規則集

## 專案結構摘要

```text
src/
  components/
    RiskBadge.tsx
    StatusBadge.tsx
    MetricCard.tsx
    EmptyState.tsx
    FilterBar.tsx
    RuleExplanationPanel.tsx
  data/
    mockSystems.ts
    mockVendors.ts
    mockTasks.ts
    mockComplianceLineage.ts
    mockCmdbTags.ts
  rules/
    riskRules.ts
    validationRules.ts
    taskGenerationRules.ts
    hndlRiskRules.ts
    vendorRiskRules.ts
    cryptoSignalRules.ts
    complianceRules.ts
  utils/
    exportUtils.ts
    formatters.ts
  types/
    index.ts
```
