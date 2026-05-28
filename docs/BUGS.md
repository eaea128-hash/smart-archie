# CloudFrame Bug Log

> Canonical bug log for both Codex and Claude. Historical entries may still
> exist under `.claude/bugs.md`, but new entries should be added here.

## Active Architectural Issues

### ARCH-001: Deployment Target Drift

- Status: fixed
- Found: 2026-05-14
- Fixed: 2026-05-23
- Area: GitHub Actions, Netlify, Cloudflare Pages
- Symptom: project memory says production is Cloudflare Pages, but GitHub deploy
  workflow still deploys Netlify and references `smartarchie.ai`.
- Fix:
  - `deploy.yml` converted to `workflow_dispatch`-only legacy Netlify workflow
  - `ci.yml` now triggers on `push: [main, develop]` — gates every Cloudflare Pages deploy
  - `lint` script scoped to `functions/api` + `js` only (removed netlify/functions from ESLint)
  - `package.json` dev script changed to `wrangler pages dev .`; added `wrangler` to devDependencies
  - `dev:legacy` retained for Netlify local dev if needed

### ARCH-002: Dual API Trees

- Status: partially mitigated
- Found: 2026-05-14
- Area: `functions/api`, `netlify/functions`
- Symptom: production Cloudflare Pages Functions and legacy Netlify Functions
  can diverge.
- Mitigation: added legacy Netlify `/api/delete-analysis` support and removed
  the dead `/api/chat` Netlify redirect.
- Recommendation: treat `functions/api` as authoritative. Mirror to Netlify only
  for an intentional rollback path.

### ARCH-003: Project Memory Split

- Status: fixed
- Found: 2026-05-14
- Area: `AGENTS.md`, `CLAUDE.md`, `.claude`, `.codex`
- Symptom: project memory referenced `.Codex/bugs.md`, while tracked history
  lived in `.claude/bugs.md`, and root `AGENTS.md` was untracked.
- Fix: introduce `docs/PROJECT_MEMORY.md` and `docs/BUGS.md` as canonical files;
  keep tool-specific entrypoints thin.

---

## Session Retro 2026-05-21 — Root Cause: Cross-Dimension Metric Isolation

Three bugs found in same session, all sharing the same root cause pattern:
**scoring dimensions computed independently without cross-referencing related dimensions.**

### BUG-017: readiness metric ignored riskScore (Algorithm Error)

- Status: fixed
- Found: 2026-05-21 — user pointed out all strategies showed 98% readiness
- Area: `js/analyze-engine.js` — `runScenario()` and `compareStrategies()`
- Root cause: `readiness = Math.min(98, Math.max(10, kpi.lzReadiness))` had no risk parameter
- Fix: added `calcReadiness(lzReadiness, riskScore)` with tiered penalty (–14/–26/–42) and hard cap (84/70/52)
- Lesson: every percentage metric must define which other dimensions affect it before implementation

### BUG-018: GoNoGo No-Go triggered by compliance-process anti-patterns (Logic Error)

- Status: fixed
- Found: 2026-05-21 — user showed strategy=Rehost recommended but GoNoGo=No-Go simultaneously
- Area: `js/rule-base.js` — `determineGoNoGo()`
- Root cause: `criticalAP >= 2` hardblock treated AP-007 (regulatory notification) same as AP-003 (no Landing Zone)
- Fix: introduced `type: 'arch' | 'compliance'` field on each AP; No-Go only triggers on arch-type APs
- Lesson: when a ruleset has heterogeneous items, add an explicit type discriminator — never rely on ID lists

### BUG-019: GoNoGo conditions array empty on No-Go (Explainability Gap)

- Status: fixed
- Found: 2026-05-21 — user screenshot showed banner with count only, no specifics
- Area: `js/rule-base.js` — hardBlock return object had `conditions: []`
- Fix: populated conditions with `【RuleID】title — 補救：remedy` for each failing rule and AP
- Lesson: `conditions: []` is never acceptable when decision ≠ 'go'; every decision must have named evidence

### Design Rule Added (from Retro)

```
When adding a new anti-pattern with risk='critical',
before assigning it to the criticalAP counter,
must set type: 'arch' | 'compliance' — determines whether it triggers No-Go or Conditional Go.

When implementing any percentage metric (readiness, confidence, risk),
before shipping,
must document which other dimensions affect it and verify it changes across low/high risk inputs.

When GoNoGo decision !== 'go',
before rendering,
must assert conditions.length > 0 — empty conditions array is a bug, not a valid state.
```

## Historical Notes

See `.claude/bugs.md` for older bug history until those entries are cleaned up
and migrated out of mojibake-damaged text.
