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

// ── FinOps TCO Calculator (IBM FinOps Framework + Cloud Provider Pricing 2026-Q1) ─────
// Prices sourced from: AWS Pricing Calculator, Azure Retail Prices API, GCP Cloud Pricing
// Methodology: IBM Cloud Framework for Financial Services TCO model
// Three-tier analysis: On-Demand | Committed-Use (1yr) | Optimised (3yr+Spot+PaaS)

const FINOPS_PRICING = {
  aws: {
    // EC2 On-Demand (ap-southeast-1 Singapore, Linux, USD/month) — verified 2026-Q1
    // t3.medium $34, m6i.large $79, m6i.xlarge $158, m6i.2xlarge $316
    compute: {
      perServer: { small: 34, medium: 158, large: 632, enterprise: 1264 },
    },
    database: {
      // RDS MySQL Multi-AZ ap-southeast-1: db.t3.medium $115, db.m6g.large $490, db.m6g.xlarge $980
      monthly: { small: 115, medium: 490, large: 980, enterprise: 2940 },
    },
    storage: {
      s3_per_tb: 23,       // S3 Standard $0.023/GB
      ebs_gp3_per_tb: 80,  // EBS gp3 $0.08/GB
      blended_per_tb: 32,  // blended: mostly S3 + some EBS
    },
    network: { egress_per_tb: 90 },
    support: { business_pct: 0.10, enterprise_pct: 0.15 },
    reserved_1yr_discount: 0.37,  // Savings Plans 1yr (market 2026: 37%)
    reserved_3yr_discount: 0.57,  // Savings Plans 3yr (market 2026: 57%)
    spot_discount: 0.70,
  },
  azure: {
    // Azure VM Southeast Asia (Pay-As-You-Go, Linux) — verified 2026-Q1
    // B2ms $65, D4s_v5 $162, D16s_v5 $648, D32s_v5 $1,296
    compute: {
      perServer: { small: 65, medium: 162, large: 648, enterprise: 1296 },
    },
    database: {
      // Azure SQL DB General Purpose Southeast Asia: 2-vCore $190, 8-vCore $760
      monthly: { small: 190, medium: 760, large: 1520, enterprise: 4560 },
    },
    storage: {
      blob_per_tb: 18,           // Azure Blob Storage LRS $0.018/GB
      managed_disk_per_tb: 113,  // Premium SSD v2 $0.113/GB (market 2026)
      blended_per_tb: 28,        // blended: mostly Blob + some Premium SSD
    },
    network: { egress_per_tb: 87 },
    support: { business_pct: 0.10, enterprise_pct: 0.15 },
    reserved_1yr_discount: 0.40,  // Azure Reservations 1yr (market 2026: 40%) ← was 33%
    reserved_3yr_discount: 0.60,  // Azure Reservations 3yr (market 2026: 60%) ← was 50%
    spot_discount: 0.60,
  },
  gcp: {
    // GCP asia-southeast1 Singapore — verified 2026-Q1
    // e2-medium $27, n2-standard-4 $158, n2-standard-16 $556, n2-standard-32 $1,112
    compute: {
      perServer: { small: 27, medium: 158, large: 556, enterprise: 1112 },
    },
    database: {
      // Cloud SQL MySQL asia-southeast1: db-f1-micro $50, db-n1-standard-4 $270
      monthly: { small: 50, medium: 270, large: 540, enterprise: 1900 },
    },
    storage: {
      gcs_per_tb: 20,            // GCS Standard $0.020/GB
      persistent_ssd_per_tb: 170, // Persistent Disk SSD $0.17/GB (market 2026)
      blended_per_tb: 30,        // blended: mostly GCS + some PD
    },
    network: { egress_per_tb: 85 },
    support: { business_pct: 0.09, enterprise_pct: 0.13 },
    reserved_1yr_discount: 0.37,  // CUD 1yr (market 2026: 37%)
    reserved_3yr_discount: 0.60,  // CUD 3yr (market 2026: 60%) ← was 57%
    spot_discount: 0.60,
  },
};

// Additional managed services (provider-agnostic monthly estimates)
const MANAGED_SERVICES = {
  waf:         { small: 50,  medium: 200,  large: 500,  enterprise: 1000 },
  monitoring:  { small: 30,  medium: 100,  large: 300,  enterprise: 600  },
  security:    { small: 100, medium: 300,  large: 800,  enterprise: 1800 },  // GuardDuty/Defender/Chronicle
  cdn:         { small: 20,  medium: 80,   large: 250,  enterprise: 600  },
  backup:      { small: 30,  medium: 100,  large: 300,  enterprise: 700  },
};

// Migration professional services (USD/hour, APAC market rates 2026)
const MIGRATION_RATES = {
  architect:   220,  // Cloud Architect / Solutions Architect
  engineer:    160,  // Cloud Engineer / DevOps
  pm:          130,  // Project Manager
  security:    200,  // Security Engineer
};

/**
 * Calculate FinOps TCO using IBM FinOps Framework methodology
 * Returns conservative, recommended, and aggressive monthly cost scenarios
 */
function calculateFinOpsTCO(inputs) {
  const provider = (inputs.targetCloud || 'AWS').toLowerCase();
  const p = FINOPS_PRICING[provider] || FINOPS_PRICING.aws;

  const tier = inputs.companySize || 'medium'; // small|medium|large|enterprise
  const serverCount = inputs.systemCount || 20;
  const hasFinancial = inputs.dataClassification === 'highly-confidential';
  const needsDR = inputs.drRequirements === 'rto4h';
  const budgetUSD = inputs.budgetUSD || 500000;

  // ── Compute ─────────────────────────────────────────────────
  const computePerServer = p.compute.perServer[tier] || p.compute.perServer.medium;
  const totalCompute = computePerServer * serverCount;

  // ── Database ────────────────────────────────────────────────
  const dbInstances = tier === 'enterprise' ? 4 : tier === 'large' ? 2 : 1;
  const totalDB = (p.database.monthly[tier] || p.database.monthly.medium) * dbInstances;

  // ── Storage (blended object+block, primarily object storage) ────────────────
  const storageTB = tier === 'enterprise' ? 100 : tier === 'large' ? 30 : tier === 'medium' ? 10 : 3;
  const totalStorage = storageTB * (p.storage.blended_per_tb || 30); // use blended rate

  // ── Network ─────────────────────────────────────────────────
  const networkTB = tier === 'enterprise' ? 50 : tier === 'large' ? 15 : tier === 'medium' ? 5 : 2;
  const totalNetwork = networkTB * p.network.egress_per_tb;

  // ── Managed Services ─────────────────────────────────────────
  const ms = MANAGED_SERVICES;
  const totalManaged =
    ms.monitoring[tier] +
    ms.security[tier] +
    ms.backup[tier] +
    (hasFinancial ? ms.waf[tier] : 0) +
    ms.cdn[tier];

  // ── DR (cross-region replica ~40% of primary) ────────────────
  const drCost = needsDR ? (totalCompute + totalDB) * 0.4 : 0;

  // ── Support ───────────────────────────────────────────────────
  const supportTier = tier === 'enterprise' ? p.support.enterprise_pct : p.support.business_pct;

  // ── Base monthly (on-demand) ─────────────────────────────────
  const baseMonthly = totalCompute + totalDB + totalStorage + totalNetwork + totalManaged + drCost;
  const supportCost = baseMonthly * supportTier;
  const onDemandTotal = Math.round(baseMonthly + supportCost);

  // ── Conservative: on-demand + 20% buffer (over-provisioned, no optimisation) ──
  const conservative = Math.round(onDemandTotal * 1.20);

  // ── Recommended: 60% Reserved 1yr + 40% on-demand + right-sizing ─────────────
  const recommended = Math.round(
    (totalCompute * 0.6 * (1 - p.reserved_1yr_discount) + totalCompute * 0.4) +
    (totalDB     * 0.7 * (1 - p.reserved_1yr_discount) + totalDB     * 0.3) +
    totalStorage + totalNetwork + totalManaged + drCost + supportCost
  );

  // ── Aggressive: 80% Reserved 3yr + 20% Spot/Serverless + PaaS consolidation ──
  const aggressive = Math.round(
    (totalCompute * 0.8 * (1 - p.reserved_3yr_discount) + totalCompute * 0.2 * (1 - p.spot_discount)) +
    (totalDB     * 0.8 * (1 - p.reserved_3yr_discount)) +
    totalStorage * 0.7 +  // tiered/intelligent storage
    totalNetwork * 0.8 +  // CDN reduces egress
    totalManaged + drCost * 0.6 + supportCost * 0.8
  );

  // ── Migration Cost (IBM methodology: team × duration × rate) ────────────────
  const durationMonths = tier === 'enterprise' ? 8 : tier === 'large' ? 5 : tier === 'medium' ? 3 : 2;
  const hoursPerMonth = 160;
  const teamComposition = tier === 'enterprise'
    ? { architect: 2, engineer: 4, pm: 1, security: 2 }
    : tier === 'large'
      ? { architect: 1, engineer: 3, pm: 1, security: 1 }
      : { architect: 1, engineer: 2, pm: 1, security: 0 };

  const monthlyProfessionalServices =
    (teamComposition.architect * MIGRATION_RATES.architect +
     teamComposition.engineer  * MIGRATION_RATES.engineer  +
     teamComposition.pm        * MIGRATION_RATES.pm        +
     teamComposition.security  * MIGRATION_RATES.security) * hoursPerMonth;

  const migrationCost = Math.round(monthlyProfessionalServices * durationMonths);

  // ── 3-yr ROI ─────────────────────────────────────────────────
  const onPremEstimate = onDemandTotal * 1.8; // On-prem TCO typically 1.5-2x cloud
  const cloudSavings3yr = (onPremEstimate - recommended) * 36 - migrationCost;
  const roi3yr = cloudSavings3yr > 0
    ? `3年節省 USD $${Math.round(cloudSavings3yr).toLocaleString()}，ROI ${Math.round(cloudSavings3yr / (migrationCost || 1) * 100)}%`
    : '3年達損益平衡';
  const paybackMonths = cloudSavings3yr > 0
    ? Math.round(migrationCost / ((onPremEstimate - recommended) || 1))
    : durationMonths + 6;

  return {
    conservative,
    recommended,
    aggressive,
    migration_cost_usd: migrationCost,
    roi_3yr: roi3yr,
    payback_months: paybackMonths,
    breakdown: {
      compute_monthly: Math.round(totalCompute),
      database_monthly: Math.round(totalDB),
      storage_monthly: Math.round(totalStorage),
      network_monthly: Math.round(totalNetwork),
      managed_services_monthly: Math.round(totalManaged),
      dr_monthly: Math.round(drCost),
      support_monthly: Math.round(supportCost),
    },
    methodology: `IBM FinOps TCO 三情境分析（${provider.toUpperCase()} ${tier} tier, ${serverCount} servers）：Conservative=On-Demand+20%緩衝；Recommended=60%一年期Reserved+右側配置；Aggressive=80%三年期Reserved+Spot實例+PaaS整合`,
  };
}

// Simple in-memory rate limiter (resets on cold start; good enough for serverless)
const rateLimitStore = new Map(); // sessionId -> { count, resetAt }

// ── Prompt Version (increment when system prompt changes) ────────────────────
const PROMPT_VERSION = '2.1.0'; // Design-Time 版控：變更前須走 review

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
Provide 3 scenarios with REALISTIC USD amounts based on the actual inputs (server count, cloud provider, workload type). Use these reference prices:

**Compute (per server/month):**
- AWS EC2: t3.medium $34, m6i.large $70, m6i.xlarge $140, m6i.2xlarge $280, c6i.4xlarge $490
- Azure VM: B2ms $61, D2s_v5 $70, D4s_v5 $140, D8s_v5 $280, F8s_v2 $310
- GCP: e2-medium $25, n2-standard-2 $67, n2-standard-4 $134, n2-standard-8 $267

**Database (managed, per month):**
- AWS RDS MySQL Multi-AZ db.m6g.large: $230; db.m6g.xlarge: $460; Aurora Serverless: $0.12/ACU-hr
- Azure SQL Database General Purpose 4 vCores: $370; Business Critical: $740
- GCP Cloud SQL MySQL db-n1-standard-4: $260; Cloud Spanner: $0.90/node-hr

**Storage (per TB/month):**
- AWS S3: $23, EBS gp3: $80, EFS: $300
- Azure Blob: $18, Managed Disk P30: $80
- GCP Cloud Storage: $20, Persistent Disk SSD: $85

**Network egress (per TB):** AWS: $90, Azure: $87, GCP: $85

**Managed services (monthly add-ons):**
- Load Balancer: $20–50; WAF: $200–500; GuardDuty/Defender: $100–400; CloudTrail/Monitor: $50–200
- Business Support: 10% of monthly bill; Enterprise Support: 15%

**Migration professional services:** $150–250/hour, typical engagement 3–6 months

Calculate based on: systemCount servers + database tier + storage needs + network + support.
Conservative = IaaS lift-and-shift with minimal managed services.
Recommended = mix of IaaS + PaaS managed services + right-sizing.
Aggressive = full PaaS/serverless, auto-scaling, reserved instances (30-40% savings).
IMPORTANT: monthly_usd must reflect actual workload size — do NOT return 0 or placeholder values.

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

## Pre-Calculated FinOps TCO (IBM FinOps Framework — use these as your cost baseline)
${(() => {
  try {
    const tco = calculateFinOpsTCO(inputs);
    return `
- **Conservative scenario:** USD $${tco.conservative.toLocaleString()}/month (on-demand, 20% buffer)
- **Recommended scenario:** USD $${tco.recommended.toLocaleString()}/month (60% Reserved 1yr + right-sizing)
- **Aggressive scenario:** USD $${tco.aggressive.toLocaleString()}/month (80% Reserved 3yr + Spot + PaaS)
- **Migration cost:** USD $${tco.migration_cost_usd.toLocaleString()} (professional services, ${tco.payback_months}m payback)
- **3-Year ROI:** ${tco.roi_3yr}
- **Cost breakdown:** Compute $${tco.breakdown.compute_monthly}/mo · DB $${tco.breakdown.database_monthly}/mo · Storage $${tco.breakdown.storage_monthly}/mo · Network $${tco.breakdown.network_monthly}/mo · Managed $${tco.breakdown.managed_services_monthly}/mo · DR $${tco.breakdown.dr_monthly}/mo
- **Methodology:** ${tco.methodology}

INSTRUCTION: Use these pre-calculated values as the basis for your cost.scenarios in the JSON output. You may adjust ±15% based on workload-specific factors you identify, but must explain any deviation in cost_drivers.`;
  } catch(e) {
    return '(Cost pre-calculation unavailable — please estimate based on inputs above.)';
  }
})()}

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

  // ── Kill Switch（緊急停用）────────────────────────────────────
  if (env.AI_ENABLED === 'false') {
    return new Response(
      JSON.stringify({ error: 'AI 分析服務暫時停用中，請稍後再試。', code: 'SERVICE_DISABLED' }),
      { status: 503, headers: { ...cors, 'Content-Type': 'application/json' } }
    );
  }

  if (request.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405, headers: { ...cors, 'Content-Type': 'application/json' },
    });
  }

  // Auth check — Workers AI binding must be available
  if (!env.AI) {
    console.error('[analyze] Cloudflare AI binding not configured. Add [ai] binding = "AI" in wrangler.toml and enable in Cloudflare Dashboard.');
    return new Response(
      JSON.stringify({ error: 'AI binding not configured. Please enable Workers AI in Cloudflare Dashboard → Settings → Functions → AI bindings.' }),
      { status: 503, headers: { ...cors, 'Content-Type': 'application/json' } }
    );
  }

  // Rate limit
  const CF_AI_MODEL    = env.CF_AI_MODEL || '@cf/meta/llama-3.3-70b-instruct';
  const MAX_TOKENS     = parseInt(env.CLAUDE_MAX_TOKENS || '3072', 10);
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

  // Call Cloudflare Workers AI → full analysis → return result
  try {
    // ── RAG：取得相關知識庫文件 ──────────────────────────────
    const ragContext  = await getRagContext(inputs, supabase, openaiKey);
    const userMessage = buildUserMessage(inputs) + ragContext;

    // ── Workers AI: single-pass analysis ─────────────────────
    // (MCP tool phase removed — carbon data computed server-side after response)
    const aiResponse = await env.AI.run(CF_AI_MODEL, {
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user',   content: userMessage },
      ],
      max_tokens: MAX_TOKENS,
    });

    // Workers AI returns { response: "..." }
    const message = { content: [{ type: 'text', text: aiResponse.response || '' }], model: CF_AI_MODEL };

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

    // ── Server-side sustainability: always compute from CARBON_DATA ───────────
    // Do NOT rely on Claude to generate carbon numbers — compute directly and merge.
    if (jsonResult) {
      const providerKey = (inputs.targetCloud || 'AWS').toLowerCase();
      const provData    = CARBON_DATA[providerKey];
      if (provData) {
        const serverCount = inputs.systemCount || 20;
        // Find lowest-carbon region
        const sorted = Object.entries(provData.regions).sort((a, b) => a[1].intensity - b[1].intensity);
        const [lowestCode, lowestRegion] = sorted[0];
        // Calculate CO2 reduction vs Taiwan on-prem baseline
        const kwhPerYear   = serverCount * ANNUAL_SERVER_KWH;
        const onpremCO2    = kwhPerYear * ONPREM_INTENSITY / 1e6;      // tonnes/yr
        const cloudCO2     = kwhPerYear * lowestRegion.intensity / 1e6; // tonnes/yr
        const reductionPct = Math.max(0, Math.round((onpremCO2 - cloudCO2) / onpremCO2 * 100));
        const reductionTon = Math.max(0, Math.round((onpremCO2 - cloudCO2) * 10) / 10);

        // ESG guidance based on stated framework
        const esgFramework = inputs.esgFramework || 'none';
        const esgGuidance = {
          tcfd:   ['揭露氣候相關財務風險（TCFD框架）', '建立情境分析（2°C / 4°C）', '量化碳排基準數據（Scope 1/2/3）'],
          gri:    ['依 GRI 305-1/2/3 揭露溫室氣體排放', '設定科學基礎目標（SBTi）', '建立碳排監控 Dashboard'],
          sbti:   ['提交 SBTi 承諾書', '設定 1.5°C 對齊目標', '建立年度減排路徑'],
          twse:   ['依台灣 TWSE 永續報告書 GRI/SASB 規範揭露', '建立董事會永續治理機制', '量化 Scope 2 排放（市場基礎法）'],
          none:   ['建議選擇 GRI Standards 作為揭露框架', '優先建立碳排基準數據', '評估加入 RE100 或 SBTi'],
        };

        // Build complete sustainability object — server-computed, reliable
        const serverSustainability = {
          carbon_reduction_pct:         reductionPct,
          annual_co2_reduction_tonnes:  reductionTon,
          recommended_region:           lowestRegion.name,
          recommended_region_intensity: lowestRegion.intensity,
          renewable_pct:                lowestRegion.renewable,
          onprem_baseline_intensity:    ONPREM_INTENSITY,
          rationale: `依據台灣電網碳強度（${ONPREM_INTENSITY} gCO₂eq/kWh）為基準，遷移 ${serverCount} 台伺服器至 ${provData.regions[lowestCode].name}（${lowestRegion.intensity} gCO₂eq/kWh，${lowestRegion.renewable}% 再生能源）後，預估每年減少 ${reductionTon} 噸 CO₂，碳排強度降低 ${reductionPct}%。計算方法：每台伺服器年耗電 ${ANNUAL_SERVER_KWH} kWh × ${serverCount} 台 = ${(kwhPerYear/1000).toFixed(0)} MWh/年。`,
          esg_guidance: esgGuidance[esgFramework] || esgGuidance.none,
          provider_commitment: provData.commitment,
          monitoring_tool:     provData.tool,
          all_regions_ranked:  sorted.slice(0, 5).map(([c, d]) => `${d.name}: ${d.intensity} gCO₂/kWh (${d.renewable}% RE)`),
        };

        // Merge: server numbers take priority; Claude's rationale/esg can enrich if present
        const claudeSustainability = jsonResult.sustainability || {};
        jsonResult.sustainability = {
          ...serverSustainability,
          // Accept Claude's rationale/esg_guidance only if they contain real content
          rationale:    (claudeSustainability.rationale && claudeSustainability.rationale.length > 30 && !claudeSustainability.rationale.includes('string'))
                          ? claudeSustainability.rationale : serverSustainability.rationale,
          esg_guidance: (Array.isArray(claudeSustainability.esg_guidance) && claudeSustainability.esg_guidance.length > 0 && !claudeSustainability.esg_guidance[0].includes('string'))
                          ? claudeSustainability.esg_guidance : serverSustainability.esg_guidance,
        };
      }

      // ── Server-side cost: merge FinOps TCO if Claude returned 0s ─────────────
      try {
        const tco = calculateFinOpsTCO(inputs);
        const cs  = jsonResult.cost?.scenarios || {};
        const recM = cs.recommended?.monthly_usd;
        const conM = cs.conservative?.monthly_usd;
        const aggM = cs.aggressive?.monthly_usd;
        // Only override if Claude returned 0 or missing
        if (!recM || recM === 0) {
          jsonResult.cost = jsonResult.cost || {};
          jsonResult.cost.scenarios = {
            conservative: { monthly_usd: tco.conservative, annual_usd: tco.conservative * 12, description: 'On-Demand 定價，20% 容量緩衝，最小化管理服務' },
            recommended:  { monthly_usd: tco.recommended,  annual_usd: tco.recommended  * 12, description: '60% Reserved Instances (1年期) + 40% On-Demand，右側配置' },
            aggressive:   { monthly_usd: tco.aggressive,   annual_usd: tco.aggressive   * 12, description: '80% Reserved Instances (3年期) + Spot/Serverless，PaaS整合' },
          };
          jsonResult.cost.migration_cost_usd = tco.migration_cost_usd;
          jsonResult.cost.roi_3yr            = tco.roi_3yr;
          jsonResult.cost.payback_months     = tco.payback_months;
          jsonResult.cost.cost_drivers       = [
            `運算資源 (${inputs.targetCloud}): $${tco.breakdown.compute_monthly}/月`,
            `資料庫託管服務: $${tco.breakdown.database_monthly}/月`,
            `儲存空間: $${tco.breakdown.storage_monthly}/月`,
            `網路流量: $${tco.breakdown.network_monthly}/月`,
            `安全監控服務: $${tco.breakdown.managed_services_monthly}/月`,
            tco.breakdown.dr_monthly > 0 ? `DR 備援: $${tco.breakdown.dr_monthly}/月` : null,
          ].filter(Boolean);
        }
      } catch (tcoErr) {
        console.warn('[FinOps] TCO calculation error:', tcoErr.message);
      }
    }

    return new Response(
      JSON.stringify({
        success:       true,
        result:        jsonResult,
        raw:           jsonResult ? undefined : rawText,
        model:         CF_AI_MODEL,
        prompt_version: PROMPT_VERSION,
      }),
      { status: 200, headers: { ...cors, 'Content-Type': 'application/json' } }
    );

  } catch (err) {
    console.error('[analyze] Workers AI error:', err);
    const status = err.status || err.statusCode || 500;
    const msg    = err.message || 'Internal server error';
    // 備援機制提示：告知前端可使用本地 rule-based engine
    return new Response(
      JSON.stringify({
        error:    msg,
        code:     err.error?.type,
        fallback: true, // 前端收到 fallback:true 時改用 analyze-engine.js
      }),
      { status, headers: { ...cors, 'Content-Type': 'application/json' } }
    );
  }
}
