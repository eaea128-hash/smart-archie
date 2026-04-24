---
paths:
  - "js/**/*.js"
---

# 前端 JavaScript 開發規則

> 每次編輯 js/ 下的檔案時自動載入。

---

## Supabase Client 使用規則

```javascript
// ✅ 正確：透過 SupabaseClient.getClient() 取得（動態讀取 config）
const client = SupabaseClient.getClient();
if (!client) { /* 處理未初始化的情況 */ return; }

// ❌ 錯誤：直接用全局 supabase（可能未初始化）
const { data } = await supabase.from('...')
```

## Auth 狀態檢查

```javascript
// ✅ 正確
const user = await Auth.getCurrentUser();
if (!user) { window.location.href = 'login.html'; return; }

// 取得 session token（給 API 用）
const session = (await SupabaseClient.getClient().auth.getSession()).data.session;
const token = session?.access_token;
```

## DOM 操作安全規範

```javascript
// ✅ 永遠先 null check
const el = document.getElementById('myElement');
if (!el) return;
el.textContent = value;

// ❌ 直接操作（可能 null）
document.getElementById('myElement').textContent = value;
```

## Toast 通知

```javascript
// 使用 utils.js 的 showToast
showToast('操作成功', 'success');   // success / error / warning / info
showToast('發生錯誤', 'error');
```

## API 呼叫標準格式

```javascript
async function callAPI(endpoint, body) {
  const session = (await SupabaseClient.getClient().auth.getSession()).data.session;
  const res = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${session?.access_token}`
    },
    body: JSON.stringify(body)
  });
  if (!res.ok) throw new Error(`API error: ${res.status}`);
  return res.json();
}
```

## localStorage 使用規則

```javascript
// CloudFrame 使用 Supabase session storage（sb-xxx-auth-token）
// 不再使用舊的 archie_ 前綴 key
// 如果看到 archie_history / archie_users → localStorage fallback 模式（Supabase 未初始化）

// 清除舊 fallback 資料（debug 用）
// localStorage.clear()  ← 只在 debug 時用
```

## 錯誤邊界

```javascript
// 所有 async 入口加保護
document.addEventListener('DOMContentLoaded', async () => {
  try {
    await init();
  } catch (e) {
    console.error('[page] Init error:', e);
    showToast('頁面初始化失敗，請重新整理', 'error');
  }
});
```
