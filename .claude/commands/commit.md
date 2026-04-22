# Skill: Smart Commit

**觸發時機**：使用者說「commit」、「提交」、「存檔」

## 執行步驟

1. 執行 `git status` 確認變更清單
2. 執行 `git diff --stat` 確認變更量
3. 依照變更內容自動判斷 commit type：
   - `feat:` 新功能
   - `fix:` 修復 bug
   - `chore:` 設定/依賴/非功能性變更
   - `refactor:` 重構（不影響功能）
   - `docs:` 文件
   - `style:` 純樣式/CSS
4. 撰寫繁體中文 commit message 說明（補充 what + why）
5. 加上 Co-Authored-By 標記
6. 執行 `git push origin main`

## Commit 格式

```
<type>: <英文簡述>

<繁體中文說明 what + why，2-3 句>

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>
```

## 規則
- 不使用 `git add -A`，改用明確指定檔案
- 不跳過 pre-commit hooks
- 若有敏感資料（.env、密碼）自動警告並拒絕
