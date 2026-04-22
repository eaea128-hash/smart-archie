# Skill: Enterprise Architecture Framework

**觸發時機**：「架構評估」、「TOGAF」、「C4」、「畫架構圖」、「系統設計」

## 執行步驟

### Phase 1 — 確認範圍（先問）
- 是哪個架構層級？（系統 / 容器 / 元件 / 程式碼）
- 利害關係人是誰？（CTO / 開發團隊 / 業務）
- 現況 vs 目標（As-Is → To-Be）

### Phase 2 — TOGAF ADM 精簡版
```
A. 架構願景      → 問題是什麼、成功定義
B. 業務架構      → 流程、角色、資料流
C. 資訊系統架構  → 應用架構 + 資料架構
D. 技術架構      → 基礎設施、雲端服務選型
E. 機會與解決方案 → Gap Analysis
F. 遷移規劃      → 優先順序 + 里程碑
```

### Phase 3 — C4 Model 輸出
```
Level 1: Context（系統邊界 + 外部用戶/系統）
Level 2: Container（應用程式、API、資料庫）
Level 3: Component（模組內部結構）
Level 4: Code（只有必要時）
```

### Phase 4 — CloudFrame 對應
評估此架構決策影響的 6R 策略與遷移建議

## 輸出格式
```
🏗️ 架構評估：[系統名稱]
層級：[Context / Container / Component]
As-Is：[現況描述]
To-Be：[目標狀態]
Gap：[差異項目]
風險：[架構風險]
建議：[優先順序 + 原因]
```
