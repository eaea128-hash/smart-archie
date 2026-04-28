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

// ── Carbon Intensity Data (gCO2eq/kWh) — Source: Cloud provider official data ──
const CARBON_DATA = {
  aws: {
    regions: {
      'ap-east-1':      { name: 'Hong Kong',    intensity: 799, renewable: 5  },
      'ap-southeast-1': { name: 'Singapore',    intensity: 408, renewable: 25 },
      'ap-southeast-2': { name: 'Sydney',       intensity: 690, renewable: 25 },
      'ap-northeast-1': { name: 'Tokyo',        intensity: 463, renewable: 30 },
      'ap-northeast-3': { name: 'Osaka',        intensity: 463, renewable: 30 },
      'ap-south-1':     { name: 'Mumbai',       intensity: 708, renewable: 20 },
      'eu-north-1':     { name: 'Stockholm',    intensity: 8,   renewable: 99 },
      'eu-west-1':      { name: 'Ireland',      intensity: 316, renewable: 72 },
      'eu-central-1':   { name: 'Frankfurt',    intensity: 338, renewable: 70 },
      'us-east-1':      { name: 'N. Virginia',  intensity: 415, renewable: 65 },
      'us-west-2':      { name: 'Oregon',       intensity: 136, renewable: 89 },
    },
    commitment: 'Net Zero by 2040, 100% renewable energy by 2025',
    tool: 'AWS Customer Carbon Footprint Tool',
  },
  azure: {
    regions: {
      'eastasia':       { name: 'Hong Kong',    intensity: 790, renewable: 5  },
      'southeastasia':  { name: 'Singapore',    intensity: 408, renewable: 25 },
      'japaneast':      { name: 'Tokyo',        intensity: 463, renewable: 30 },
      'australiaeast':  { name: 'Sydney',       intensity: 690, renewable: 25 },
      'swedencentral':  { name: 'Sweden',       intensity: 8,   renewable: 99 },
      'northeurope':    { name: 'Ireland',      intensity: 316, renewable: 72 },
      'westeurope':     { name: 'Netherlands',  intensity: 390, renewable: 55 },
    },
    commitment: 'Carbon negative by 2030, remove all historical carbon by 2050',
    tool: 'Azure Emissions Impact Dashboard',
  },
  gcp: {
    regions: {
      'asia-east1':          { name: 'Taiwan',     intensity: 509, renewable: 15 },
      'asia-east2':          { name: 'Hong Kong',  intensity: 790, renewable: 5  },
      'asia-northeast1':     { name: 'Tokyo',      intensity: 463, renewable: 30 },
      'asia-southeast1':     { name: 'Singapore',  intensity: 408, renewable: 25 },
      'australia-southeast1':{ name: 'Sydney',     intensity: 690, renewable: 25 },
      'europe-north1':       { name: 'Finland',    intensity: 35,  renewable: 97 },
      'europe-west1':        { name: 'Belgium',    intensity: 150, renewable: 85 },
      'us-central1':         { name: 'Iowa',       intensity: 356, renewable: 90 },
    },
    commitment: 'Carbon-free energy 24/7 by 2030, carbon neutral since 2007',
    tool: 'GCP Carbon Footprint',
  },
};

// Average on-premises data center carbon intensity (Taiwan/APAC)
const ONPREM_INTENSITY = 509; // gCO2eq/kWh (Taiwan grid average)
const ANNUAL_SERVER_KWH = 8760; // kWh per server per year

// ── MCP Tool Definitions ──────────────────────────────────────
const MCP_TOOLS = [
  {
    name: 'lookup_carbon_intensity',
    description: 'Get real carbon intensity data (gCO2eq/kWh) and renewable energy percentage for all regions of a cloud provider. Use this to recommend the lowest-carbon region and calculate CO2 reduction vs on-premises.',
    input_schema: {
      type: 'object',
      properties: {
        provider: {
          type: 'string',
          enum: ['aws', 'azure', 'gcp'],
          description: 'Cloud provider (lowercase)',
        },
      },
      required: ['provider'],
    },
  },
  {
    name: 'calculate_carbon_reduction',
    description: 'Calculate estimated annual CO2 reduction when migrating from on-premises to a specific cloud region. Returns reduction percentage and absolute tonnes.',
    input_schema: {
      type: 'object',
      properties: {
        provider:       { type: 'string', enum: ['aws', 'azure', 'gcp'] },
        target_region:  { type: 'string', description: 'Target cloud region code' },
        server_count:   { type: 'number', description: 'Estimated number of servers/VMs to migrate' },
      },
      required: ['provider', 'target_region', 'server_count'],
    },
  },
];

// ── Tool Executor ─────────────────────────────────────────────
function executeMCPTool(name, input) {
  if (name === 'lookup_carbon_intensity') {
    const providerData = CARBON_DATA[input.provider];
    if (!providerData) return { error: 'Unknown provider' };
    return {
      provider: input.provider,
      commitment: providerData.commitment,
      monitoring_tool: providerData.tool,
      onprem_baseline_gco2_kwh: ONPREM_INTENSITY,
      regions: Object.entries(providerData.regions).map(([code, d]) => ({
        code, name: d.name,
        intensity_gco2_kwh: d.intensity,
        renewable_pct: d.renewable,
        vs_onprem_reduction_pct: Math.round((1 - d.intensity / ONPREM_INTENSITY) * 100),
      })).sort((a, b) => a.intensity_gco2_kwh - b.intensity_gco2_kwh),
    };
  }

  if (name === 'calculate_carbon_reduction') {
    const providerData = CARBON_DATA[input.provider];
    const regionData   = providerData?.regions[input.target_region];
    if (!regionData) return { error: 'Unknown region', available_regions: Object.keys(providerData?.regions || {}) };

    const servers    = input.server_count || 20;
    const onpremCO2  = (ONPREM_INTENSITY * ANNUAL_SERVER_KWH * servers) / 1_000_000; // tonnes
    const cloudCO2   = (regionData.intensity * ANNUAL_SERVER_KWH * servers) / 1_000_000;
    const reduction  = onpremCO2 - cloudCO2;
    const reductionPct = Math.round((reduction / onpremCO2) * 100);

    return {
      provider: input.provider,
      region:   input.target_region,
      region_name: regionData.name,
      server_count: servers,
      annual_onprem_co2_tonnes:  Math.round(onpremCO2 * 10) / 10,
      annual_cloud_co2_tonnes:   Math.round(cloudCO2 * 10) / 10,
      annual_reduction_tonnes:   Math.round(reduction * 10) / 10,
      reduction_pct:             reductionPct,
      renewable_pct:             regionData.renewable,
    };
  }

  return { error: `Unknown tool: ${name}` };
}

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

### Step 7: Sustainability & Carbon Assessment
When MCP tools provide carbon intensity data, use it to:
- Calculate CO2 reduction vs on-premises baseline (Taiwan grid: 509 gCO2eq/kWh)
- Recommend the lowest-carbon region for the target provider
- Provide ESG compliance guidance aligned with stated frameworks (TCFD/GRI/SBTi)
- Quantify annual CO2 reduction in absolute tonnes
- Reference the cloud provider's sustainability commitment and monitoring tools

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
  "sustainability": {
    "carbon_reduction_pct": 0,
    "annual_co2_reduction_tonnes": 0,
    "recommended_region": "string (region with lowest carbon intensity for target provider)",
    "recommended_region_intensity": 0,
    "rationale": "string (explanation of carbon reduction methodology)",
    "esg_guidance": ["string"],
    "provider_commitment": "string",
    "monitoring_tool": "string"
  },
  "meta": {
    "analysis_version": "2.0",
    "frameworks_version": "2026-Q1",
    "confidence": "high|medium|low",
    "assumptions": ["string"]
  }
}`;

// ── RAG Context Retrieval ─────────────────────────────────────────────────────
async function getRagContext(inputs, supabase, openaiKey) {
  if (!openaiKey) return ''; // RAG 未設定，靜默跳過

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
      headers: { 'Authorization': `Bearer ${openaiKey}`, 'Content-Type': 'application/json' },
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
function checkRateLimit(sessionId, rateLimitRph) {
  if (!rateLimitRph) return true;
  const now   = Date.now();
  const entry = rateLimitStore.get(sessionId);
  if (!entry || now > entry.resetAt) {
    rateLimitStore.set(sessionId, { count: 1, resetAt: now + 3_600_000 });
    return true;
  }
  if (entry.count >= rateLimitRph) return false;
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
function corsHeaders(origin, allowedOriginsStr) {
  const allowed = allowedOriginsStr
    ? allowedOriginsStr.split(',').map(s => s.trim())
    : [];
  const allowOrigin = (!allowed.length || allowed.includes(origin)) ? origin : allowed[0];
  return {
    'Access-Control-Allow-Origin':  allowOrigin || '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, x-session-id',
    'Access-Control-Max-Age':       '86400',
  };
}

// ── Main Handler ─────────────────────────────────────────────────────────────
export async function onRequest(context) {
  const { request, env } = context;

  const origin = request.headers.get('origin') || '*';
  const cors   = corsHeaders(origin, env.ALLOWED_ORIGINS);

  // Pre-flight
  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: cors });
  }

  if (request.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405, headers: { ...cors, 'Content-Type': 'application/json' },
    });
  }

  // Auth check — API key must be configured
  if (!env.ANTHROPIC_API_KEY) {
    console.error('[analyze] ANTHROPIC_API_KEY not set');
    return new Response(
      JSON.stringify({ error: 'API key not configured. Please set ANTHROPIC_API_KEY in your environment.' }),
      { status: 503, headers: { ...cors, 'Content-Type': 'application/json' } }
    );
  }

  // Rate limit
  const MODEL          = env.CLAUDE_MODEL      || 'claude-opus-4-6';
  const MAX_TOKENS     = parseInt(env.CLAUDE_MAX_TOKENS || '8000', 10);
  const RATE_LIMIT_RPH = parseInt(env.RATE_LIMIT_RPH   || '20',   10);

  const sessionId = request.headers.get('x-session-id') || request.headers.get('x-forwarded-for') || 'default';
  if (!checkRateLimit(sessionId, RATE_LIMIT_RPH)) {
    return new Response(
      JSON.stringify({ error: 'Rate limit exceeded. Please wait before making another request.' }),
      { status: 429, headers: { ...cors, 'Content-Type': 'application/json' } }
    );
  }

  // Parse body
  let inputs;
  try {
    const body = await request.json().catch(() => ({}));
    inputs = body.inputs || {};
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON body' }), {
      status: 400, headers: { ...cors, 'Content-Type': 'application/json' },
    });
  }

  // Initialise clients inside handler
  const supabase  = createClient('https://oxownfzafrveihxhuxay.supabase.co', env.SUPABASE_SERVICE_ROLE_KEY);
  const openaiKey = env.OPENAI_API_KEY;

  // Call Claude with MCP tool_use → final analysis → return result
  try {
    const client = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY });

    // ── RAG：取得相關知識庫文件 ──────────────────────────────
    const ragContext  = await getRagContext(inputs, supabase, openaiKey);
    const userMessage = buildUserMessage(inputs) + ragContext;

    // ── Phase 1: MCP Tool Use — gather carbon intensity data ─
    let toolContextMessages = [];
    const hasSustainability = inputs.sustainabilityGoal && inputs.sustainabilityGoal !== 'none';
    const provider = (inputs.targetCloud || 'AWS').toLowerCase();

    if (hasSustainability || inputs.esgFramework !== 'none') {
      try {
        const toolPhase = await client.messages.create({
          model:      MODEL,
          max_tokens: 1024,
          tools:      MCP_TOOLS,
          messages:   [{
            role: 'user',
            content: `The user is migrating to ${inputs.targetCloud}. Their sustainability goal is "${inputs.sustainabilityGoal}" and ESG framework is "${inputs.esgFramework}". Use the tools to look up carbon intensity data and calculate CO2 reduction for approximately ${inputs.systemCount || 20} servers migrating to the lowest-carbon region.`,
          }],
        });

        // Execute tool calls
        const toolResults = [];
        for (const block of toolPhase.content) {
          if (block.type === 'tool_use') {
            const result = executeMCPTool(block.name, block.input);
            console.log(`[MCP] Tool called: ${block.name}`, block.input);
            toolResults.push({
              type: 'tool_result',
              tool_use_id: block.id,
              content: JSON.stringify(result),
            });
          }
        }

        if (toolResults.length > 0) {
          toolContextMessages = [
            { role: 'user',      content: toolPhase.content[0]?.type === 'text' ? toolPhase.content : 'Use tools to gather carbon data' },
            { role: 'assistant', content: toolPhase.content },
            { role: 'user',      content: toolResults },
          ];
        }
      } catch (toolErr) {
        console.warn('[MCP] Tool phase skipped:', toolErr.message);
      }
    }

    // ── Phase 2: Full analysis with tool context ──────────────
    const analysisMessages = toolContextMessages.length > 0
      ? [
          ...toolContextMessages,
          { role: 'user', content: `Now perform the full cloud advisory analysis. ${userMessage}\n\nIMPORTANT: Include a complete "sustainability" object in your JSON output using the carbon data from the tools above.` },
        ]
      : [{ role: 'user', content: userMessage }];

    const message = await client.messages.create({
      model:      MODEL,
      max_tokens: MAX_TOKENS,
      system:     SYSTEM_PROMPT,
      messages:   analysisMessages,
    });

    // Extract JSON from response
    let jsonResult = null;
    let rawText    = '';
    for (const block of message.content) {
      if (block.type === 'text') rawText += block.text;
    }

    const jsonMatch = rawText.match(/```json\s*([\s\S]*?)\s*```/) ||
                      rawText.match(/(\{[\s\S]*\})/);
    if (jsonMatch) {
      try {
        jsonResult = JSON.parse(jsonMatch[1] || jsonMatch[0]);
      } catch {
        try { jsonResult = JSON.parse(rawText); } catch { /* will return raw */ }
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        result:  jsonResult,
        raw:     jsonResult ? undefined : rawText,
        usage:   message.usage,
        model:   message.model,
      }),
      { status: 200, headers: { ...cors, 'Content-Type': 'application/json' } }
    );

  } catch (err) {
    console.error('[analyze] Claude API error:', err);
    const status = err.status || err.statusCode || 500;
    const msg    = err.message || 'Internal server error';
    return new Response(
      JSON.stringify({ error: msg, code: err.error?.type }),
      { status, headers: { ...cors, 'Content-Type': 'application/json' } }
    );
  }
}
