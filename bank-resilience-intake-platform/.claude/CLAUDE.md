# archie-pqc Claude Entry

## 專案說明
CloudFrame 量子韌性治理盤點平台（PQC Governance Intake Platform）
- 純前端 React 18 + Vite + TypeScript + Tailwind CSS + shadcn/ui
- 資料儲存：localStorage（無後端、無資料庫）
- 部署：Vercel（https://archie-pqc.vercel.app）
- 所有資料為模擬假資料，不涉及真實公司資料

## 安全限制（必讀）
- 所有資料都是假資料，不要使用真實公司資料
- 不要串接真實公司系統
- 本專案不是資安掃描器，不取代 CBOM / CMDB / GRC / SIEM / 弱點掃描工具

## Git Push 策略
- 每個 session 所有修改統一在結束前一次 push
- Commit message：`fix: [說明] (batch deploy)` 或 `feat: 功能名稱 (batch deploy)`
- Push 目標：https://github.com/eaea128-hash/archie-pqc.git（main branch）
- Vercel 自動部署，push 後約 1-2 分鐘生效

## 可用 Skills
| Skill | 指令 | 用途 |
|-------|------|------|
| before-change | /before-change | 修改前確認影響範圍 |
| commit | /commit | 產出 Conventional Commits 格式 |
| debug | /debug | 系統性找根因 |
| review | /review | 程式碼品質核對 |
| testing-guard | /testing-guard | GIVEN-WHEN-THEN 驗收標準 |
| tech-debt | /tech-debt | 技術債掃描 |
| deps-audit | /deps-audit | 套件安全掃描 |
| feature-plan | /feature-plan | 新功能需求規劃 |
| deploy-checklist | /deploy-checklist | Vercel 上線前核對 |
| pre-deploy-check | /pre-deploy-check | push 前 smoke test |
| performance-optimization | /performance-optimization | Core Web Vitals 診斷 |
| compliance-check | /compliance-check | 金管會 / FSC PQC 合規核對 |
| security-governance | /security-governance | ISO 27001 / DPIA 資安治理 |
| accessibility-audit | /accessibility-audit | WCAG 無障礙核對 |
| retro | /retro | Session 工程回顧 |
| system-guard | /system-guard | 系統整體健康檢查 |

## 不適用 Skills（原因）
- content-pipeline / article-writer 等內容生產類：本專案非內容平台
- db-migration：無資料庫（純 localStorage）
- cloudflare-manager：已改用 Vercel
- saas-check：POC 階段，非正式 SaaS 產品
- seo：內部治理工具，不需要 SEO

## 工程規則
- CSS 用 Tailwind class，不 hardcode 色碼
- 元件放 `src/components/`，頁面放 `src/pages/`
- 資料模型放 `src/data/`，工具函式放 `src/lib/`
- Build 前必須通過 `npm run build`（TypeScript + Vite）
