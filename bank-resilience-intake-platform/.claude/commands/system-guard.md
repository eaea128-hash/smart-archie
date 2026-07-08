---
name: system-guard
description: "系統異常偵測與已知錯誤防護。當使用者說「健檢」、「有沒有問題」、「驗證系統」、「會不會又出錯」、「異常偵測」、「system-guard」時觸發。在每次重要修改前後都應執行。"
---

# System Guard — 系統異常偵測與已知錯誤防護

你是一位嚴格的系統防護工程師。你的工作是：
1. 讀取專案的 BUGS.md 和 retro 文件，提取已知錯誤模式
2. 對當前系統狀態執行兩階段核對
3. 列出異常清單，不掩蓋任何問題

**核心原則：已經出現過的錯誤，不能再出現第二次。**

---

## 執行流程

### 第零步：讀取已知錯誤記錄

依序讀取以下文件（存在就讀，不存在就略過）：
- `docs/BUGS.md`
- `.claude/bugs.md`
- `.claude/retro-*.md`（所有 retro 檔）
- `CLAUDE.md`（工程守則區塊）

從這些文件中提取：
- **已修復但高風險的錯誤**（曾經出現、已修但容易復發）
- **Trigger-Action 規則**（retro 中的 When...before...must 格式）
- **架構約束**（CLAUDE.md 中的禁止事項）

---

### 第一階段：已知錯誤防護掃描

針對從文件中提取的每一條錯誤模式，對當前程式碼執行驗證。

**必查的通用模式（不管有沒有文件記錄）：**

#### Config Drift 類
```
□ Supabase .single() 用法
  → grep -r "\.single()" --include="*.js" .
  → 所有出現處必須改為 .maybeSingle()，除非明確確認該資料一定存在
  
□ 環境變數名稱拼字
  → 檢查所有 env var 引用：ANTHROPIC_API_KEY / OPENAI_API_KEY / SUPABASE_SERVICE_ROLE_KEY
  → 特別注意：OPENAI_API_KEY（不是 PENAI_API_KEY）
  
□ DB schema 與程式碼欄位一致性
  → 讀取 supabase-schema.sql 的欄位清單
  → 比對 JS 程式碼中的 .select() 和 .insert() 欄位是否都存在於 schema
  
□ Supabase Site URL 是否為當前 production domain
  → 在 CLAUDE.md 或 PROJECT_MEMORY.md 找到 production URL
  → 提醒使用者確認 Supabase Dashboard → Auth → URL Configuration 是否一致
```

#### 邏輯邊界類
```
□ GoNoGo conditions 陣列
  → grep -n "conditions: \[\]" --include="*.js" .
  → 任何 decision !== 'go' 的情況下，conditions 不得為空陣列
  
□ Anti-Pattern type 欄位
  → grep -n "type:" data/rules-config.json（或相關設定檔）
  → 每個 AP 必須有 type: 'arch' | 'compliance'，不得缺失
  
□ 指標交叉維度
  → 任何百分比指標（readiness/confidence/risk）是否有引用其他維度的計算
  → 找到 Math.min(98, Math.max(10, ... 的模式，確認有 riskScore 參數
```

#### 部署規範類
```
□ Git push 頻率控制
  → git log --oneline -20 | wc -l
  → 若單一 session 超過 5 個 commit，提醒是否符合批次 push 策略
  
□ 禁止指令確認
  → 本 session 是否有使用 git push --force / rm -rf / DROP TABLE
  → 這些在 .claude/settings.json 的 deny list 中，不應出現
```

---

### 第二階段：通用異常偵測

#### 2-1 靜默失敗偵測
```
□ try-catch 吃掉錯誤但不 log
  → grep -n "catch.*{}" --include="*.js" . （空 catch block）
  → grep -n "catch" --include="*.js" . | grep -v "console\|throw\|return"
  
□ Fallback 遮蔽真實錯誤
  → 找所有 || 預設值的模式，確認 fallback 不會讓錯誤靜默消失
  → 特別注意：function 回傳 null 但呼叫端沒有做 null check
```

#### 2-2 Schema 一致性
```
□ 讀取 supabase-schema.sql 或 intel-schema.sql
□ 列出所有資料表和欄位
□ 掃描 JS 檔案中的 DB 操作
□ 找出：程式碼引用但 schema 沒有定義的欄位
□ 找出：schema 有但程式碼從未使用的欄位（可能是遺棄欄位）
```

#### 2-3 API 端點一致性
```
□ 讀取 functions/api/ 目錄，列出所有存在的端點
□ 搜尋前端 JS 中的 fetch('/api/...') 呼叫
□ 找出：前端呼叫但後端沒有對應 function 的端點（404 地雷）
□ 找出：後端存在但前端從未呼叫的端點（死碼）
```

#### 2-4 環境變數完整性
```
□ 讀取 .env.example（如果存在）
□ 列出所有必要的環境變數
□ 掃描程式碼中的 env 引用（process.env.XXX / context.env.XXX）
□ 確認 .env.example 覆蓋了所有程式碼中引用的變數
□ 警告：任何在程式碼中引用但不在 .env.example 的變數
```

---

### 第三步：輸出報告

以下格式輸出，不省略任何異常：

```
## System Guard 報告
執行時間：{timestamp}
掃描範圍：{列出讀取的文件}

---

### 🔴 高風險（已知會出問題，立刻處理）
- [ ] {問題描述} → {位置} → {修復方式}

### 🟡 中風險（潛在問題，本 session 結束前處理）
- [ ] {問題描述} → {位置} → {修復方式}

### 🟢 已驗證（無問題）
- [x] {檢查項目} — 通過

### ℹ️ 提醒（無法自動驗證，需人工確認）
- {需要到 Dashboard 或外部服務確認的項目}

---

### 本次發現概要
- 高風險：{N} 項
- 中風險：{N} 項
- 已驗證通過：{N} 項

### 建議下一步
{根據報告給出最優先處理的 1-3 個行動}
```

---

## 執行時機

**必須執行的時機：**
- 任何 schema 變更前後
- 任何 API function 新增或修改後
- 每次 session 開始（快速模式：只跑已知錯誤防護掃描）
- 部署到 production 前（完整模式：兩階段全跑）

**觸發關鍵字：**
「健檢」「system-guard」「有沒有問題」「驗證一下」「會不會又出錯」「異常偵測」「跑一下防護」

---

## 注意事項

- 不掩蓋任何問題。就算是小問題也要列出。
- 如果某個檢查無法執行（例如沒有讀取權限），明確說明「無法檢查，原因：{原因}」
- 不要在報告中加入任何「應該沒問題」的猜測，只寫能驗證的事實
- 高風險問題必須在繼續其他工作前先修復
