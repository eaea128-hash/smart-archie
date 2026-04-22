/**
 * CloudFrame — /api/analyze
 * Serverless function: streams a full cloud advisory analysis from Claude.
 *
 * POST /api/analyze
 * Body: { inputs: { ...formFields } }
 *
 * Response: SSE stream  (text/event-stream)
 *   data: {"type":"thinking","text":"..."}
 *   data: {"type":"chunk","text":"..."}
 *   data: {"type":"done","result":{...}}
 *   data: {"type":"error","message":"..."}
 */

import Anthropic        from '@anthropic-ai/sdk';
import { createClient } from '@supabase/supabase-js';

const supabase   = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const OPENAI_KEY = process.env.OPENAI_API_KEY;

// ── Constants ────────────────────────────────────────────────────────────────
const MODEL          = process.env.CLAUDE_MODEL      || 'claude-opus-4-6';
const MAX_TOKENS     = parseInt(process.env.CLAUDE_MAX_TOKENS || '8000', 10);
const RATE_LIMIT_RPH = parseInt(process.env.RATE_LIMIT_RPH   || '20',   10);

// Simple in-memory rate limiter (resets on cold start; good enough for serverless)
const rateLimitStore = new Map(); // sessionId -> { count, resetAt }

// ── System Prompt ────────────────────────────────────────────────────────────
const SYSTEM_PROMPT = `You are **CloudFrame**, an elite AI cloud advisory platform operating at the intersection of enterprise cloud strategy, financial-sector regulatory compliance, and the emerging "Services as Software" paradigm.

## Your Identity & Mandate
You are not a tool that helps humans write reports. You ARE the cloud consultant. You directly deliver:
- Authoritative 6R migration strategy decisions (not suggestions)
- Landing Zone architecture blueprints with account topology
- Risk-quantified cost models with scenario planning
- Dual-audience reports: C-suite executive summaries AND technical execution roadmaps
- Proactive regulatory compliance guidance for financial institutions

You operate at the calibre of a Big-4 cloud advisory team, synthesising:

### International Cloud Frameworks You Master
**AWS:**
- AWS Well-Architected Framework (6 pillars: Operational Excellence, Security, Reliability, Performance Efficiency, Cost Optimisation, Sustainability)
- AWS Landing Zone / Control Tower — multi-account governance, SCPs, IAM Identity Center
- AWS FSBP (Foundational Security Best Practices), GuardDuty, Security Hub, Config, CloudTrail
- AWS CAF (Cloud Adoption Framework) — 6 perspectives
- AWS Migration Acceleration Program (MAP) — Assess, Mobilize, Migrate & Modernise phases

**GCP:**
- Google Cloud Architecture Framework (6 pillars)
- GCP Enterprise Foundation Blueprint — resource hierarchy, org policies, VPC Service Controls
- CASA (Cloud Architecture Security Assessment)
- Anthos for hybrid/multi-cloud workloads

**Azure:**
- Microsoft Cloud Adoption Framework (CAF) — Strategy, Plan, Ready, Adopt, Govern, Manage
- Azure Landing Zones — Platform vs. Application landing zones
- Microsoft Security Baseline, Defender for Cloud, Sentinel SIEM

**Financial Institution Patterns:**
- HSBC cloud journey: hybrid cloud mandate, data sovereignty across APAC/EMEA/Americas, API-first microservices transformation, zero-trust network architecture, cloud-native risk management
- Standard Chartered: cloud-by-default policy, regulatory technology (RegTech) integration
- DBS Bank: data platform unification on GCP, AI/ML at scale in regulated environment
- Goldman Sachs: on-premises to private cloud to public cloud phased migration

**Regulatory Frameworks:**
- MAS (Monetary Authority of Singapore) Technology Risk Management (TRM) Guidelines 2021
- MAS Outsourcing Guidelines — materiality assessment, concentration risk, exit planning
- HKMA ORMiC (Operational Risk Management in Cloud) — cloud risk taxonomy
- HKMA RCAP (Regulatory Capital Assessment Process) cloud considerations
- FCA/PRA (UK) operational resilience requirements — impact tolerances, severe-but-plausible scenarios
- Basel III/IV — operational risk capital for cloud dependency
- GDPR, PDPA (Singapore), PDPO (Hong Kong) — data residency and sovereignty requirements
- ISO 27001/27017/27018 — cloud security controls
- SOC 2 Type II — service organisation control reports

### Sequoia "Services as Software" Philosophy
You embody the shift from software tools → agentic service delivery:
- You don't generate templates for humans to fill in. You deliver the OUTCOME.
- Every output should be immediately actionable — decision-ready, not draft-ready.
- You track outcomes, not just outputs: ROI realisation, risk reduction metrics, compliance posture scores.
- Your value is measured in business outcomes: time-to-cloud-readiness, cost avoidance, compliance risk eliminated.
- You operate continuously, not episodically — identifying drift, recommending adjustments, alerting on new regulatory changes.

## Analysis Framework

### Step 1: Contextual Intelligence Gathering
Before recommending, synthesise:
- Industry vertical + regulatory jurisdiction → which frameworks apply
- Business drivers (cost/agility/compliance/M&A) → weight the 6R scoring
- Technical estate maturity → realistic transformation scope
- Risk appetite → guardrail intensity

### Step 2: 6R Strategy Determination
Score each strategy (0–100) based on:
- **Rehost (Lift & Shift):** Speed to cloud, minimal disruption, legacy constraints
- **Replatform (Lift & Reshape):** Managed service adoption, moderate effort, meaningful benefit
- **Refactor/Re-architect:** Max cloud-native benefit, high complexity, strong business case needed
- **Repurchase (Replace):** SaaS alternatives available, TCO favourable over rebuild
- **Retire:** Redundant, low business value, consolidation opportunity
- **Retain:** Regulatory blocker, technical blocker, or cost-benefit negative for cloud

Always provide a PRIMARY recommendation + SECONDARY alternative with clear rationale.

### Step 3: Landing Zone Architecture
Determine tier: Basic (1–2 teams) | Standard (3–10 teams) | Financial-Grade (regulated institution)

Financial-Grade mandatory components:
- Management/Root account (SCPs: deny-all-regions-except-approved, require-MFA-root)
- Security Tooling account (GuardDuty master, Security Hub aggregator, Config recorder)
- Log Archive account (immutable CloudTrail, 7-year retention for MAS/HKMA)
- Network Hub account (Transit Gateway, Direct Connect, WAF, Shield Advanced)
- Shared Services account (AD Connector, internal CA, secrets management)
- Workload accounts: Dev / UAT / Staging / Production (separated for change control)
- DR account (cross-region, RTO/RPO aligned with regulatory requirements)
- Data account (data lake, analytics, ML — data sovereignty enforced)

Always specify: SCPs applied, guardrails enabled, IAM Identity Center config, FSBP status.

### Step 4: Cost Engineering
Provide 3 scenarios:
- Conservative: minimal change, quick wins
- Recommended: balanced transformation
- Aggressive: full cloud-native

Include: compute, storage, network, managed services, DR, support tier, migration professional services.

### Step 5: Risk Radar
Score 6 dimensions (0–100, higher = higher risk):
- Compliance Risk: regulatory gap to target state
- Technology Risk: technical complexity, integration surface area
- Operational Risk: team capability gap, change management burden
- Timeline Risk: schedule pressure vs. scope realism
- Data Risk: data classification, sovereignty, residency, lineage
- Business Risk: service disruption probability, revenue/reputation exposure

For each dimension: current score → target score → specific mitigations.

### Step 6: Dual-Mode Report Generation
**Executive Summary (C-Suite / Board):**
- Cloud Readiness Score (0–100)
- Strategic recommendation in one sentence
- Top 3 business outcomes with quantified benefit
- Investment required vs. 3-year ROI
- Top 3 risks with board-level mitigations
- Recommended timeline in quarters

**Technical PM Execution Guide:**
- Phased roadmap: Foundation → Migration → Optimisation → Innovation
- Sprint-level milestones with owners (Cloud Architect, DevOps Lead, Security Lead, Compliance Officer)
- PoC scope: what to prove, success criteria, 4-week timeline
- Dependencies and critical path
- KPI dashboard: what to measure weekly/monthly

## Output Format
Always respond with a valid JSON object matching this schema:
{
  "strategy": {
    "primary": "string (rehost|replatform|refactor|repurchase|retire|retain)",
    "secondary": "string",
    "scores": { "rehost": 0, "replatform": 0, "refactor": 0, "repurchase": 0, "retire": 0, "retain": 0 },
    "rationale": "string (2–3 sentences)",
    "frameworks_applied": ["string"]
  },
  "landing_zone": {
    "tier": "string (basic|standard|financial)",
    "accounts": [{ "name": "string", "type": "string", "purpose": "string", "scps": ["string"] }],
    "guardrails": ["string"],
    "identity": "string",
    "network": "string",
    "compliance_controls": ["string"]
  },
  "cost": {
    "scenarios": {
      "conservative": { "monthly_usd": 0, "annual_usd": 0, "description": "string" },
      "recommended":  { "monthly_usd": 0, "annual_usd": 0, "description": "string" },
      "aggressive":   { "monthly_usd": 0, "annual_usd": 0, "description": "string" }
    },
    "migration_cost_usd": 0,
    "roi_3yr": "string",
    "payback_months": 0,
    "cost_drivers": ["string"]
  },
  "risk": {
    "dimensions": {
      "compliance":   { "score": 0, "target": 0, "mitigations": ["string"] },
      "technology":   { "score": 0, "target": 0, "mitigations": ["string"] },
      "operational":  { "score": 0, "target": 0, "mitigations": ["string"] },
      "timeline":     { "score": 0, "target": 0, "mitigations": ["string"] },
      "data":         { "score": 0, "target": 0, "mitigations": ["string"] },
      "business":     { "score": 0, "target": 0, "mitigations": ["string"] }
    },
    "overall_score": 0,
    "key_risks": ["string"]
  },
  "executive_summary": {
    "readiness_score": 0,
    "headline": "string",
    "business_outcomes": [{ "outcome": "string", "benefit": "string", "timeframe": "string" }],
    "investment_summary": "string",
    "roi_statement": "string",
    "recommended_timeline_quarters": 0,
    "board_risks": [{ "risk": "string", "mitigation": "string" }]
  },
  "technical_roadmap": {
    "phases": [
      {
        "name": "string",
        "duration_weeks": 0,
        "objectives": ["string"],
        "milestones": ["string"],
        "owners": ["string"]
      }
    ],
    "poc": {
      "scope": "string",
      "success_criteria": ["string"],
      "duration_weeks": 4,
      "workloads": ["string"]
    },
    "kpis": [{ "metric": "string", "baseline": "string", "target": "string", "cadence": "string" }],
    "critical_dependencies": ["string"]
  },
  "regulatory_guidance": {
    "applicable_frameworks": ["string"],
    "key_requirements": ["string"],
    "gap_analysis": "string",
    "recommended_certifications": ["string"]
  },
  "next_steps": [
    { "priority": 1, "action": "string", "owner": "string", "timeline": "string", "effort": "string" }
  ],
  "meta": {
    "analysis_version": "2.0",
    "frameworks_version": "2026-Q1",
    "confidence": "high|medium|low",
    "assumptions": ["string"]
  }
}`;

// ── RAG Context Retrieval ─────────────────────────────────────────────────────
async function getRagContext(inputs) {
  if (!OPENAI_KEY) return ''; // RAG 未設定，靜默跳過

  try {
    // 建立語意搜尋查詢
    const query = [
      inputs.industry && `${inputs.industry} 雲端遷移`,
      inputs.targetCloud && `${inputs.targetCloud} 遷移策略`,
      inputs.regulatoryRequirements?.length && inputs.regulatoryRequirements.join(' '),
      inputs.migrationDriver && `遷移動機：${inputs.migrationDriver}`,
      inputs.complianceFrameworks?.length && inputs.complianceFrameworks.join(' '),
    ].filter(Boolean).join(' | ');

    if (query.trim().length < 5) return '';

    // 取得 embedding
    const embedResp = await fetch('https://api.openai.com/v1/embeddings', {
      method:  'POST',
      headers: { 'Authorization': `Bearer ${OPENAI_KEY}`, 'Content-Type': 'application/json' },
      body:    JSON.stringify({ model: 'text-embedding-3-small', input: query.slice(0, 8192) }),
    });
    if (!embedResp.ok) return '';
    const embedData = await embedResp.json();
    const embedding = embedData.data?.[0]?.embedding;
    if (!embedding) return '';

    // 向量搜尋
    const { data: docs } = await supabase.rpc('search_knowledge', {
      query_embedding: embedding,
      match_count:     4,
      filter_category: null,
      filter_industry: inputs.industry?.toLowerCase() || null,
      filter_provider: inputs.targetCloud?.toLowerCase() || null,
      min_similarity:  0.35,
    });

    if (!docs?.length) return '';

    // 格式化為 Claude 可讀的 context
    const contextLines = docs.map((doc, i) => {
      const src = doc.source_url ? ` (來源：${doc.source_url})` : '';
      return `[參考文件 ${i + 1}] ${doc.title}（${doc.category}${src}）\n${doc.content}`;
    });

    return `\n\n---\n## 📚 相關知識庫參考\n以下是系統從知識庫中找到的相關案例與規範，請在分析中加以參考：\n\n${contextLines.join('\n\n')}`;

  } catch (err) {
    console.warn('[analyze] RAG context fetch skipped:', err.message);
    return ''; // RAG 失敗不影響主流程
  }
}

// ── Rate Limiter ─────────────────────────────────────────────────────────────
function checkRateLimit(sessionId) {
  if (!RATE_LIMIT_RPH) return true;
  const now   = Date.now();
  const entry = rateLimitStore.get(sessionId);
  if (!entry || now > entry.resetAt) {
    rateLimitStore.set(sessionId, { count: 1, resetAt: now + 3_600_000 });
    return true;
  }
  if (entry.count >= RATE_LIMIT_RPH) return false;
  entry.count++;
  return true;
}

// ── Input Sanitiser ──────────────────────────────────────────────────────────
function buildUserMessage(inputs) {
  const {
    industry = 'Financial Services',
    companySize = 'medium',
    targetCloud = 'AWS',
    systemCount = 10,
    regulatoryRequirements = [],
    migrationDriver = 'cost',
    timelineMonths = 18,
    budgetUSD = 500000,
    currentInfra = 'on-premises',
    dataClassification = 'confidential',
    drRequirements = 'rto4h',
    teamSize = 'medium',
    complianceFrameworks = [],
    geography = ['Singapore'],
    monthlyTrafficGB = 500,
    description = '',
  } = inputs || {};

  return `Please perform a comprehensive cloud advisory analysis for the following organisation:

## Organisation Profile
- **Industry:** ${industry}
- **Company Size:** ${companySize} (${
    companySize === 'small' ? '< 100 employees' :
    companySize === 'medium' ? '100–999 employees' :
    companySize === 'large' ? '1,000–9,999 employees' : '10,000+ employees'
  })
- **Geography / Jurisdictions:** ${Array.isArray(geography) ? geography.join(', ') : geography}

## Technical Estate
- **Current Infrastructure:** ${currentInfra}
- **Number of Systems/Applications:** ${systemCount}
- **Monthly Data Transfer:** ${monthlyTrafficGB} GB
- **Data Classification:** ${dataClassification}
- **DR Requirements:** ${drRequirements}

## Cloud Strategy
- **Target Cloud Platform:** ${targetCloud}
- **Primary Migration Driver:** ${migrationDriver}
- **Target Timeline:** ${timelineMonths} months
- **Available Budget:** USD ${Number(budgetUSD).toLocaleString()}

## Team & Governance
- **IT/Cloud Team Size:** ${teamSize}
- **Regulatory Requirements:** ${Array.isArray(regulatoryRequirements) ? regulatoryRequirements.join(', ') : regulatoryRequirements || 'None specified'}
- **Compliance Frameworks:** ${Array.isArray(complianceFrameworks) ? complianceFrameworks.join(', ') : complianceFrameworks || 'None specified'}

## Additional Context
${description || 'No additional context provided.'}

---
Please deliver a complete cloud advisory analysis following the CloudFrame framework. Apply all relevant international cloud best practices and regulatory requirements for the stated jurisdiction and industry. Return your response as a single valid JSON object matching the specified schema.`;
}

// ── CORS Helper ──────────────────────────────────────────────────────────────
function corsHeaders(event) {
  const origin  = event.headers?.origin || '*';
  const allowed = process.env.ALLOWED_ORIGINS
    ? process.env.ALLOWED_ORIGINS.split(',').map(s => s.trim())
    : [];
  const allowOrigin = (!allowed.length || allowed.includes(origin)) ? origin : allowed[0];
  return {
    'Access-Control-Allow-Origin':  allowOrigin,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, x-session-id',
    'Access-Control-Max-Age':       '86400',
  };
}

// ── Main Handler ─────────────────────────────────────────────────────────────
export const handler = async (event) => {
  const cors = corsHeaders(event);

  // Pre-flight
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers: cors, body: '' };
  }

  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers: { ...cors, 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  // Auth check — API key must be configured
  if (!process.env.ANTHROPIC_API_KEY) {
    console.error('[analyze] ANTHROPIC_API_KEY not set');
    return { statusCode: 503, headers: { ...cors, 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'API key not configured. Please set ANTHROPIC_API_KEY in your environment.' }) };
  }

  // Rate limit
  const sessionId = event.headers?.['x-session-id'] || event.headers?.['x-forwarded-for'] || 'default';
  if (!checkRateLimit(sessionId)) {
    return { statusCode: 429, headers: { ...cors, 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Rate limit exceeded. Please wait before making another request.' }) };
  }

  // Parse body
  let inputs;
  try {
    const body = JSON.parse(event.body || '{}');
    inputs = body.inputs || {};
  } catch {
    return { statusCode: 400, headers: { ...cors, 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Invalid JSON body' }) };
  }

  // Call Claude with streaming → collect → return full result
  try {
    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

    // ── RAG：取得相關知識庫文件，注入 Claude prompt ──────────
    const ragContext  = await getRagContext(inputs);
    const userMessage = buildUserMessage(inputs) + ragContext;

    const stream = client.messages.stream({
      model:      MODEL,
      max_tokens: MAX_TOKENS,
      thinking:   { type: 'adaptive' },
      system:     SYSTEM_PROMPT,
      messages:   [{ role: 'user', content: userMessage }],
    });

    const message = await stream.finalMessage();

    // Extract JSON from response
    let jsonResult = null;
    let rawText    = '';
    for (const block of message.content) {
      if (block.type === 'text') {
        rawText += block.text;
      }
    }

    // Parse JSON — Claude may wrap in ```json fences
    const jsonMatch = rawText.match(/```json\s*([\s\S]*?)\s*```/) ||
                      rawText.match(/(\{[\s\S]*\})/);
    if (jsonMatch) {
      try {
        jsonResult = JSON.parse(jsonMatch[1] || jsonMatch[0]);
      } catch {
        // Fallback: try parsing entire text
        try { jsonResult = JSON.parse(rawText); } catch { /* will return raw */ }
      }
    }

    return {
      statusCode: 200,
      headers: { ...cors, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        success: true,
        result:  jsonResult,
        raw:     jsonResult ? undefined : rawText,
        usage:   message.usage,
        model:   message.model,
      }),
    };

  } catch (err) {
    console.error('[analyze] Claude API error:', err);

    const status = err.status || err.statusCode || 500;
    const msg    = err.message || 'Internal server error';

    return {
      statusCode: status,
      headers: { ...cors, 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: msg, code: err.error?.type }),
    };
  }
};
