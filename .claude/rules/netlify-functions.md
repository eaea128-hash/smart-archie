---
paths:
  - "netlify/functions/**/*.js"
---

# Netlify Functions 開發規則

> 每次編輯 netlify/functions/ 下的檔案時自動載入。

---

## 必備結構（每個 function 都要有）

```javascript
// 1. CORS headers（必須）
function cors(origin) {
  return {
    'Access-Control-Allow-Origin':  origin || '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  };
}

// 2. OPTIONS preflight（必須）
if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers: corsH, body: '' };

// 3. JWT 驗證（需要登入的 endpoint）
const token = (event.headers?.authorization || '').replace('Bearer ', '').trim();
if (!token) return { statusCode: 401, headers: corsH, body: JSON.stringify({ error: '未提供 Token' }) };

// 4. try-catch 包裹整個 handler（必須）
try {
  // ... 業務邏輯
} catch (e) {
  console.error('[function-name] Unexpected error:', e);
  return { statusCode: 500, headers: corsH, body: JSON.stringify({ error: e.message }) };
}
```

---

## 禁止事項

```
❌ 用 .single()         → 改用 .maybeSingle()
❌ 沒有 CORS headers    → 前端會 CORS error
❌ 沒有 OPTIONS 處理    → preflight 失敗
❌ 沒有 try-catch       → 任何例外都變 500 + text/plain（難以 debug）
❌ 用 SUPABASE_ANON_KEY → 後端一律用 SUPABASE_SERVICE_ROLE_KEY
❌ 回傳無 Content-Type  → 加 'Content-Type': 'application/json'
```

---

## Supabase 查詢規範

```javascript
// ✅ 正確
const { data } = await supabase.from('profiles').select('*').eq('id', userId).maybeSingle();
const user = data ?? null; // 安全處理 null

// ❌ 錯誤（0 筆時回傳 406）
const { data } = await supabase.from('profiles').select('*').eq('id', userId).single();
```

---

## 環境變數使用規則

| 用途 | 正確變數 | 錯誤 |
|------|---------|------|
| 後端 DB 操作 | `SUPABASE_SERVICE_ROLE_KEY` | ~~SUPABASE_ANON_KEY~~ |
| 前端 config | `SUPABASE_ANON_KEY` | ~~SERVICE_ROLE_KEY~~ |
| AI 分析 | `ANTHROPIC_API_KEY` | ~~PENAI_API_KEY~~ |
| Embedding | `OPENAI_API_KEY` | ~~PENAI_API_KEY~~ |
| Email | `RESEND_API_KEY` | — |

---

## 500 錯誤 debug 流程

1. 看 Network tab → Response body（JSON 還是 text/plain？）
2. `text/plain` → 問題在 module 初始化層（top-level code）
3. `JSON { error: "..." }` → 問題在業務邏輯（try-catch 有抓到）
4. 去 Netlify → Functions → Log 看完整 stack trace
