# CloudFrame Claude Entry

This is the Claude-specific entrypoint. The canonical project memory is:

- `docs/PROJECT_MEMORY.md`
- `docs/BUGS.md`

Read those files before making substantive changes.

## Current Decision

Cloudflare Pages is the production deployment target.

- Production frontend: static files at repo root
- Production API: `functions/api`
- Legacy rollback/reference API: `netlify/functions`
- Do not treat Netlify as production unless the user explicitly asks for a rollback.

## Git Push 策略（必讀）

本專案採批次 push 策略，避免 Cloudflare 部署次數過多。

### 規則
- 每個 session 所有修改統一在結束前 **一次 push**
- 禁止每修一個 bug 就立刻 push
- Commit message 格式：`fix: [BUG-XXX] 標題` 或 `feat: 功能名稱 (batch deploy)`

### Session 結束前執行
1. `git status` 確認所有變更
2. `git add <明確列出的檔案>`（不要 `git add -A` 以免誤入 .env）
3. `git commit -m "fix/feat: [本次修復清單] (batch deploy)"`
4. 更新 `docs/BUGS.md` 狀態
5. `git push`

### 緊急例外（允許中途 push）
- 網站完全停擺
- 安全性漏洞

## Working Rules

1. Before larger feature changes, briefly state the intended change and affected files.
2. Before bug fixes, identify root cause and check `docs/BUGS.md`.
3. After fixing a bug, update `docs/BUGS.md`.
4. For schema changes, update `supabase-schema.sql` and include the required SQL migration.
5. Use `.maybeSingle()` for Supabase single-row reads when zero rows are valid.
6. Do not use PowerShell bulk replacement for Traditional Chinese text.
7. Prefer one consolidated push per work session.

## Tool-Specific Notes

- Keep reusable Claude workflows in `.claude/commands`.
- Keep Claude hooks/settings in `.claude`.
- Do not create another long-form memory file under `.claude`; update `docs/PROJECT_MEMORY.md` instead.

## Engineering Rules (from Retro 2026-05-21)

### Metric Cross-Dimension Constraints
- `readiness` must factor in `riskScore` — use `calcReadiness(lzReadiness, riskScore)` in analyze-engine.js
- Before implementing any `%` metric, document which other dimensions affect it
- Verify metric changes meaningfully across low-risk vs high-risk inputs before shipping

### Anti-Pattern Classification
- Every AP must have `type: 'arch' | 'compliance'` — set in both `data/rules-config.json` AND `FALLBACK_AP`
- `type='arch'` → triggers No-Go (technical foundation broken)
- `type='compliance'` → triggers Conditional Go (process gap, not technical blocker)
- Never use a hardcoded ID list to distinguish AP types — read the `type` field

### GoNoGo Consistency
- GoNoGo `conditions` array must NEVER be empty when `decision !== 'go'`
- Strategy recommendation and GoNoGo must be logically consistent:
  - No-Go = technical foundation broken (IAM/LandingZone/DR gaps)
  - Conditional Go = direction is correct, compliance process incomplete
- After modifying GoNoGo logic, manually verify: does "recommended strategy X" coexist with "No-Go"?

### Display / Explainability
- Every rendered decision with a count ("N 個問題") must also list the named items
- API owner/role arrays must be normalized through ROLE_MAP before display
- When adding a render component, trace the data shape through both API path AND local engine path
