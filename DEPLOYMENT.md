# CloudFrame ??Deployment Guide

## Prerequisites
- Node.js >= 20
- Netlify CLI (`npm install -g netlify-cli`)
- Git
- Anthropic API key ([console.anthropic.com](https://console.anthropic.com))

---

## Local Development

```bash
# 1. Clone the repo
git clone https://github.com/YOUR_ORG/cloudframe.git
cd cloudframe

# 2. Install dependencies
npm install

# 3. Set up environment variables
cp .env.example .env
# Edit .env and add your ANTHROPIC_API_KEY

# 4. Start local dev server (Netlify Dev)
npm run dev
# ??Opens at http://localhost:8888

# 5. Without API key ??local engine fallback
# Open index.html directly in browser (file:// protocol)
# The app auto-detects no API and uses the built-in rule engine
```

---

## Environment Variables

| Variable | Required | Description |
|---|---|---|
| `ANTHROPIC_API_KEY` | Yes (for AI analysis) | Get from console.anthropic.com |
| `CLAUDE_MODEL` | No | Default: `claude-opus-4-6` |
| `CLAUDE_MAX_TOKENS` | No | Default: `8000` |
| `RATE_LIMIT_RPH` | No | Requests per hour per session. Default: `20` |
| `ALLOWED_ORIGINS` | No | Comma-separated CORS origins. Default: all |

---

## Netlify Deployment

### Initial Setup

```bash
# Login to Netlify
netlify login

# Link to an existing site OR create new
netlify init

# Set environment variables in Netlify
netlify env:set ANTHROPIC_API_KEY sk-ant-api03-YOUR-KEY
netlify env:set NODE_ENV production
```

### Deploy

```bash
# Deploy to staging (preview)
netlify deploy --dir=. --functions=netlify/functions

# Deploy to production
netlify deploy --prod --dir=. --functions=netlify/functions
```

### Netlify Dashboard Setup
1. Go to **Site Settings ??Environment Variables**
2. Add `ANTHROPIC_API_KEY` with your key
3. Add `NODE_ENV=production`
4. Go to **Site Settings ??Functions** ??verify functions directory is `netlify/functions`

---

## GitHub Actions CI/CD

### Required GitHub Secrets
Go to **Settings ??Secrets and Variables ??Actions** and add:

| Secret | Description |
|---|---|
| `NETLIFY_AUTH_TOKEN` | Netlify personal access token |
| `NETLIFY_SITE_ID` | Your Netlify site ID |
| `ANTHROPIC_API_KEY` | For running tests |

### Workflow Overview
- **`ci.yml`** ??Runs on every PR to `main`/`develop`: lint, tests, security scan, secrets detection
- **`deploy.yml`** ??Staging deploy on push to `develop`; Production deploy on push to `main`

### Branch Strategy
```
main        ??Production (cloudframe.ai)
develop     ??Staging (deploy preview)
feature/*   ??PR ??CI checks ??merge to develop
```

---

## API Endpoints

| Endpoint | Method | Description |
|---|---|---|
| `/api/analyze` | POST | Run cloud advisory analysis via Claude |
| `/api/trends` | GET | Get international cloud trends |

### POST /api/analyze
```json
{
  "inputs": {
    "industry": "Financial Services",
    "companySize": "large",
    "targetCloud": "AWS",
    "timelineMonths": 18,
    "budgetUSD": 1000000,
    "regulatoryRequirements": ["MAS TRM", "HKMA ORMiC"],
    "description": "Core banking migration from on-premises to AWS"
  }
}
```

### GET /api/trends
```
/api/trends?category=regulatory&region=Singapore
/api/trends?category=all
/api/trends?category=financial&impact=high
```

---

## Architecture

```
cloudframe/
?œâ??€ *.html                  # Pages (static)
?œâ??€ css/main.css            # Design system
?œâ??€ js/
??  ?œâ??€ utils.js            # Toast, Store, formatting
??  ?œâ??€ auth.js             # LocalStorage-based auth
??  ?œâ??€ analyze-engine.js   # Rule-based fallback engine
??  ?”â??€ api-client.js       # Claude API client (with fallback)
?œâ??€ netlify/
??  ?”â??€ functions/
??      ?œâ??€ analyze.js      # Claude API ??analysis
??      ?”â??€ trends.js       # International trends data
?œâ??€ .github/workflows/
??  ?œâ??€ ci.yml              # PR checks
??  ?”â??€ deploy.yml          # Staging + production deploy
?œâ??€ netlify.toml            # Netlify config
?œâ??€ package.json
?”â??€ .env.example
```

---

## Cost Estimation

Running CloudFrame with real Claude API:
- Each analysis: ~3,000??,000 input tokens + ~6,000??,000 output tokens
- `claude-opus-4-6` pricing: $5/M input, $25/M output
- Cost per analysis: ~$0.17??0.22 (with adaptive thinking)
- 100 analyses/month: ~$17??22/month API cost

For high-volume usage, consider:
1. Using `claude-sonnet-4-6` for lower-cost analyses ($3/M in, $15/M out)
2. Implementing result caching for identical inputs
3. Using prompt caching for the system prompt (saves ~60% on repeated calls)
