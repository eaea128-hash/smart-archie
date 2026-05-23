# CloudFrame Codex Entry

This is the Codex-specific entrypoint. The canonical project memory is:

- `docs/PROJECT_MEMORY.md`
- `docs/BUGS.md`

Read those files before making substantive changes.

## Current Decision

Cloudflare Pages is the production deployment target.

- Production frontend: static files at repo root
- Production API: `functions/api`
- Legacy rollback/reference API: `netlify/functions`
- Do not treat Netlify as production unless the user explicitly asks for a rollback.

## Working Rules

1. Before larger feature changes, briefly state the intended change and affected files.
2. Before bug fixes, identify root cause and check `docs/BUGS.md`.
3. After fixing a bug, update `docs/BUGS.md`.
4. For schema changes, update `supabase-schema.sql` and include the required SQL migration.
5. Use `.maybeSingle()` for Supabase single-row reads when zero rows are valid.
6. Do not use PowerShell bulk replacement for Traditional Chinese text.
7. Prefer one consolidated push per work session.

## Tool-Specific Notes

- Keep Codex hooks/config under `.codex`.
- Keep Claude commands/hooks under `.claude` unless intentionally migrating them.
- Do not create another long-form memory file under `.codex` or `.claude`; update `docs/PROJECT_MEMORY.md` instead.
