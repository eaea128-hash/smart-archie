# Skill: Session Retro（Evidence-Based Engineering Review）

## 觸發關鍵字
`retro`, `retrospective`, `回顧`, `事後檢討`, `post-mortem`, `lessons learned`, `哪裡出錯`, `改進`

## 角色定位
你是一位**資深 AI 工程師**，同時具備系統思考與工程紀律。  
執行 Retro 時，必須誠實、具體、引用證據，不得模糊帶過。

---

## 執行步驟（7 Steps + 1 Gate）

### Step 1｜轉折點帳本
列出本 session 所有方向改變的時刻：
- **(A) 使用者觸發**：使用者提供截圖、錯誤訊息、或糾正才改方向
- **(B) 自行發現**：Claude 主動發現問題並修正

輸出格式：
```
| # | 時刻 | 描述 | 觸發 | 初始方向 | 修正後方向 |
```

計算 A:B 比例。**A:B > 2:1 代表自主偵錯能力不足，需強化探針策略。**

---

### Step 2｜5 Whys
對每個 **(A) 轉折點**追問五次「為什麼」。  
**規則**：每個答案必須引用具體證據（錯誤訊息、截圖內容、程式碼行號）。

```
| # | Why | 證據 |
| W1 | 為什麼 X 發生？ | [具體錯誤] |
| W2 | 為什麼造成 X 的原因存在？ | [具體設定/程式碼] |
...
```

---

### Step 3｜根因選擇
從以下標準清單選出**唯一一個**主要根因：

- [ ] 邏輯錯誤（Algorithm）
- [ ] 邊界條件未處理（Edge Case）
- [ ] 環境/設定不一致（Config Drift）
- [ ] 依賴版本衝突（Dependency）
- [ ] 測試覆蓋不足（Test Gap）
- [ ] 需求理解錯誤（Misunderstanding）
- [ ] 外部服務行為變更（External Change）

說明選擇理由，引用 Step 2 的證據。

---

### Step 4｜反事實分析
**誠實**回答：如果使用者完全沒有介入，每個 (A) 轉折點會：
- 卡在哪裡？
- 給出什麼錯誤答案？
- 影響是否上線到 production？

```
| 轉折點 | 若無介入的結果 |
```

---

### Step 5｜觸發-行動清單
**主要交付物**。格式：

```
When {可觀察的觸發條件},
before {工程階段},
must {具體行動}
```

**規則**：
- 用英文撰寫（可攜帶、跨專案通用）
- 不含專案特定路徑
- 每條規則可獨立執行，不依賴上下文

**常見觸發類型（參考）**：
```
When starting a debug session...
When querying Supabase for single row...
When deploying to new hosting environment...
When adding DB schema columns...
When implementing admin-only API...
When Function returns 500 with text/plain Content-Type...
When email fails to send...
When RAG ingest returns 403...
```

---

### Step 5.5｜人類回饋 Gate（阻斷步驟）

⏸️ 暫停。問使用者：
1. 觸發-行動清單有遺漏嗎？
2. 根因選擇是否準確？
3. 哪個盲點最需要優先修復？

**等待確認才繼續 Step 6。**

---

### Step 6｜持久化

根據使用者確認後的清單：

**選項 A：寫入新 Skill 檔案**
```
.claude/commands/{domain}-checklist.md
```

**選項 B：追加到 CLAUDE.md**
在「開發守則」區塊新增規則。

**選項 C：更新 bugs.md**
把本次 bug 加入記錄，標記根因分類。

**規則**：至少選 2 個選項，觸發-行動清單必定持久化。

---

### Step 7｜一句話結論

輸出格式：
```
本次最貴的錯誤是：[具體錯誤]
花費輪數：[N 輪對話]
核心教訓：[一句話]
```

---

## 金融業專用補充（國泰/銀行情境）

當專案涉及以下情境時，Retro 需額外檢核：

### 法遵風險轉折點
- 若 (A) 轉折涉及 **個資外洩風險**（PII 出現在 URL、log、共享文件）→ 必須評估 DPIA 影響
- 若 (A) 轉折涉及 **API key 暴露** → 立即標記為 Critical，要求 key rotation

### 碳排/ESG 相關
- 若分析結果的碳排數據與 TCFD 框架不符 → 必須追溯 RAG 知識庫資料來源
- 若雲端區域選擇忽略碳強度數據 → 標記為 ESG 合規缺口

### MAS TRM / 金管會要求
- 若系統設計缺少 audit log → 標記為法遵缺口
- 若跨境資料流沒有評估 → 標記為資料主權風險

---

## 輸出範本

```markdown
# Retro — [日期] [專案名稱]

## 1. 轉折點帳本
[表格]
A:B = X:Y

## 2. 5 Whys
[各 A 轉折點的 5 Why 表格]

## 3. 根因
[x] Config Drift — [理由]

## 4. 反事實
[表格]

## 5. 觸發-行動清單
When ..., before ..., must ...
[10 條以上]

## 5.5 → 等待人類確認

## 6. 持久化
- 已更新 bugs.md
- 已新增 {skill}.md

## 7. 一句話結論
最貴的錯誤是：...（N 輪）
```
