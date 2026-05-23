# CloudFrame Project Memory

> Canonical project context for both Codex and Claude. Tool-specific entry files
> (`AGENTS.md`, `CLAUDE.md`) should stay thin and point here.

## Project

CloudFrame is an AI-powered cloud migration strategy advisor SaaS.

- Product: enterprise cloud migration strategy assessment
- Users: enterprise IT PMs, cloud architects, CIO/CTO, digital transformation leads
- Core features: 6R strategy analysis, Landing Zone recommendations, cost estimation, risk assessment
- Production: Cloudflare Pages at <https://cloudframe.pages.dev>
- GitHub: <https://github.com/eaea128-hash/smart-archie>
- Brand: always use `CloudFrame`; do not use `Smart Archie` in product UI

## Architecture

| Layer | Current standard |
| --- | --- |
| Frontend | Static HTML, CSS, vanilla JavaScript |
| Production hosting | Cloudflare Pages |
| Production API | Cloudflare Pages Functions in `functions/api` |
| Legacy API | Netlify Functions in `netlify/functions` |
| Database | Supabase PostgreSQL with RLS |
| Auth | Supabase Auth |
| AI | Cloudflare Workers AI / provider API integration, with local rule-based fallback |
| Payments | Stripe code present, secrets pending |
| Analytics/monitoring | Sentry and Mixpanel code present, secrets pending |

## Source Of Truth

- Project memory: `docs/PROJECT_MEMORY.md`
- Bug log: `docs/BUGS.md`
- Codex entrypoint: `AGENTS.md`
- Claude entrypoint: `CLAUDE.md`
- Claude command library: `.claude/commands`
- Codex app hooks/config: `.codex`

Do not maintain separate long-form project memories in `.claude` and `.codex`.
If the project context changes, update this file first.

## Key Files

```text
/
├── index.html
├── analyze.html
├── dashboard.html
├── trends.html
├── login.html / register.html / reset-password.html
├── share.html
├── privacy.html / terms.html
├── admin-dashboard.html
├── css/main.css
├── js/
│   ├── analyze-engine.js
│   ├── auth.js
│   ├── api-client.js
│   ├── supabase-client.js
│   ├── utils.js
│   ├── export.js
│   └── analytics.js
├── functions/api/          Cloudflare Pages Functions, production path
├── netlify/functions/      Legacy Netlify Functions, keep only as fallback/reference
├── supabase-schema.sql
├── supabase-rag-schema.sql
├── wrangler.toml
├── netlify.toml            Legacy Netlify config
└── docs/
    ├── PROJECT_MEMORY.md
    └── BUGS.md
```

## Deployment Decision

Cloudflare Pages is the production target. GitHub pushes should not trigger
Netlify production deploys.

Recommended policy:

1. Production code path is `functions/api`.
2. CI must lint/check `functions/api`, shared frontend JavaScript, and static files.
3. `netlify/functions` is legacy. Keep it only if an explicit rollback path is needed.
4. If a backend API changes, update `functions/api` first. Only mirror to
   `netlify/functions` when a Netlify rollback is intentionally being maintained.
5. Avoid frequent production pushes; batch related fixes in one session.

## API Rules

- All API endpoints must include CORS handling.
- Authenticated endpoints must verify Supabase JWT.
- Supabase single-row reads should use `.maybeSingle()` when zero rows are valid.
- Keep `/api/*` routes aligned with actual functions. No dead routes.
- Dashboard calls currently rely on `/api/delete-analysis`; both production
  Cloudflare and legacy Netlify now have a matching endpoint.

## Design System

- UI language: Traditional Chinese.
- Code and identifiers: English.
- Commit messages: English title with Chinese explanation when useful.
- CSS variables live in `css/main.css`.
- Prefer existing classes and design tokens before adding new styles.
- Primary brand colors: `--c-primary`, `--c-accent-teal`, `--c-gold`.

## Environment Variables

Production variables are configured in Cloudflare Pages unless a Netlify rollback
is explicitly being prepared.

Required or expected variables:

- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `NODE_ENV=production`
- `AI_ENABLED`
- `CF_AI_MODEL` or provider-specific AI model setting
- `ANTHROPIC_API_KEY` if Anthropic path is enabled
- `STRIPE_SECRET_KEY`, `STRIPE_PRICE_PRO`, `STRIPE_WEBHOOK_SECRET` when payments go live
- `SENTRY_DSN`
- `MIXPANEL_TOKEN`
- `OPENAI_API_KEY` for RAG embeddings
- `RESEND_API_KEY` for transactional email

## RAG

Flow:

```text
User inputs (industry, regulatory requirements, provider)
  -> OpenAI text-embedding-3-small
  -> Supabase pgvector search_knowledge RPC
  -> relevant knowledge documents
  -> injected analysis context
```

Categories:

- `case_study`
- `compliance`
- `vendor`
- `governance`
- `architecture`
- `pricing`

Admin ingest endpoint: `POST /api/rag-ingest`
Public search endpoint: `POST /api/rag-search`

## Operational Rules

1. Before larger feature changes, state the intended change and affected files.
2. Before bug fixes, identify root cause and check `docs/BUGS.md`.
3. After fixing a bug, update `docs/BUGS.md`.
4. For schema changes, update `supabase-schema.sql` and include the required
   `ALTER TABLE` or migration instruction.
5. Do not use PowerShell bulk replacement for Traditional Chinese text; it has
   already caused encoding damage in this repo.
6. Prefer one consolidated push per work session.
7. When touching deployment, keep Cloudflare Pages as production unless the user
   explicitly asks for a Netlify rollback.

## Known Follow-Ups

- Repair existing mojibake in legacy docs and user-facing fallback strings.
- Decide whether to delete or archive `netlify/functions` after Cloudflare has
  enough production confidence.
- Add real tests; current `npm test` passes with no tests.
- Ensure CI checks the Cloudflare Pages Functions path.
