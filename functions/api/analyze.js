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
/*
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
*/

// ════════════════════════════════════════════════════════════════════════════════
// FinOps TCO Engine v3 — IBM FinOps Framework + Real Instance Pricing 2026-Q1
// Sources: AWS EC2 Pricing Calculator, Azure Retail Prices API, GCP Cloud Pricing
// Region: ap-southeast-1 (AWS/GCP Singapore) | Southeast Asia (Azure)
// ════════════════════════════════════════════════════════════════════════════════

// ── VM Instance Catalog (On-Demand, Linux, USD/month = hourly × 730h) ─────────
// Each entry: [instance_type, vCPU, RAM_GB, monthly_usd]
const VM_CATALOG = {
  aws: {
    general: [
      // General purpose — m6i series (balanced compute/memory)
      { type: 't3.medium',   vcpu: 2,  ram: 4,   monthly: 34   },  // dev/test, burstable
      { type: 'm6i.large',   vcpu: 2,  ram: 8,   monthly: 79   },  // small prod workload
      { type: 'm6i.xlarge',  vcpu: 4,  ram: 16,  monthly: 159  },  // medium app server
      { type: 'm6i.2xlarge', vcpu: 8,  ram: 32,  monthly: 318  },  // large app/web tier
      { type: 'm6i.4xlarge', vcpu: 16, ram: 64,  monthly: 636  },  // enterprise workload
      { type: 'm6i.8xlarge', vcpu: 32, ram: 128, monthly: 1271 },  // enterprise heavy
    ],
    compute: [
      // Compute optimised — c6i series (CPU-intensive: batch, HPC, encoding)
      { type: 'c6i.xlarge',  vcpu: 4,  ram: 8,   monthly: 139  },
      { type: 'c6i.2xlarge', vcpu: 8,  ram: 16,  monthly: 278  },
      { type: 'c6i.4xlarge', vcpu: 16, ram: 32,  monthly: 556  },
    ],
    memory: [
      // Memory optimised — r6i series (in-memory DB, caching, financial analytics)
      { type: 'r6i.large',   vcpu: 2,  ram: 16,  monthly: 110  },
      { type: 'r6i.xlarge',  vcpu: 4,  ram: 32,  monthly: 221  },
      { type: 'r6i.2xlarge', vcpu: 8,  ram: 64,  monthly: 441  },
    ],
    rds: [
      // RDS MySQL/PostgreSQL Multi-AZ (ap-southeast-1) — includes standby replica
      { type: 'db.t3.medium',    vcpu: 2,  ram: 4,   monthly: 115  },
      { type: 'db.m6g.large',    vcpu: 2,  ram: 8,   monthly: 245  },
      { type: 'db.m6g.xlarge',   vcpu: 4,  ram: 16,  monthly: 490  },
      { type: 'db.m6g.2xlarge',  vcpu: 8,  ram: 32,  monthly: 980  },
      { type: 'db.r6g.xlarge',   vcpu: 4,  ram: 32,  monthly: 588  },  // memory-opt DB
      { type: 'db.r6g.2xlarge',  vcpu: 8,  ram: 64,  monthly: 1176 },
    ],
  },
  azure: {
    general: [
      // General purpose — Dv5 series (Southeast Asia, Pay-as-you-go)
      { type: 'B2ms',      vcpu: 2,  ram: 8,   monthly: 61   },  // burstable
      { type: 'D2s_v5',   vcpu: 2,  ram: 8,   monthly: 70   },
      { type: 'D4s_v5',   vcpu: 4,  ram: 16,  monthly: 139  },
      { type: 'D8s_v5',   vcpu: 8,  ram: 32,  monthly: 278  },
      { type: 'D16s_v5',  vcpu: 16, ram: 64,  monthly: 555  },
      { type: 'D32s_v5',  vcpu: 32, ram: 128, monthly: 1109 },
    ],
    compute: [
      // Compute optimised — Fsv2 series
      { type: 'F4s_v2',   vcpu: 4,  ram: 8,   monthly: 139  },
      { type: 'F8s_v2',   vcpu: 8,  ram: 16,  monthly: 278  },
      { type: 'F16s_v2',  vcpu: 16, ram: 32,  monthly: 555  },
    ],
    memory: [
      // Memory optimised — Ev5 series
      { type: 'E4s_v5',   vcpu: 4,  ram: 32,  monthly: 184  },
      { type: 'E8s_v5',   vcpu: 8,  ram: 64,  monthly: 369  },
      { type: 'E16s_v5',  vcpu: 16, ram: 128, monthly: 737  },
    ],
    rds: [
      // Azure SQL Database General Purpose — vCore model (Southeast Asia)
      { type: 'SQL GP 2vCore',   vcpu: 2,  ram: 10, monthly: 190  },
      { type: 'SQL GP 4vCore',   vcpu: 4,  ram: 21, monthly: 380  },
      { type: 'SQL GP 8vCore',   vcpu: 8,  ram: 41, monthly: 760  },
      { type: 'SQL GP 16vCore',  vcpu: 16, ram: 83, monthly: 1520 },
      { type: 'SQL BC 4vCore',   vcpu: 4,  ram: 21, monthly: 760  },  // Business Critical (HA)
    ],
  },
  gcp: {
    general: [
      // General purpose — N2 Standard (asia-southeast1)
      { type: 'e2-medium',        vcpu: 2,  ram: 4,   monthly: 28   },  // dev/test
      { type: 'n2-standard-2',    vcpu: 2,  ram: 8,   monthly: 80   },
      { type: 'n2-standard-4',    vcpu: 4,  ram: 16,  monthly: 161  },
      { type: 'n2-standard-8',    vcpu: 8,  ram: 32,  monthly: 322  },
      { type: 'n2-standard-16',   vcpu: 16, ram: 64,  monthly: 643  },
      { type: 'n2-standard-32',   vcpu: 32, ram: 128, monthly: 1286 },
    ],
    compute: [
      // Compute optimised — C2 series
      { type: 'c2-standard-4',    vcpu: 4,  ram: 16,  monthly: 165  },
      { type: 'c2-standard-8',    vcpu: 8,  ram: 32,  monthly: 330  },
      { type: 'c2-standard-16',   vcpu: 16, ram: 64,  monthly: 661  },
    ],
    memory: [
      // Memory optimised — N2 High-Memory
      { type: 'n2-highmem-4',     vcpu: 4,  ram: 32,  monthly: 206  },
      { type: 'n2-highmem-8',     vcpu: 8,  ram: 64,  monthly: 412  },
      { type: 'n2-highmem-16',    vcpu: 16, ram: 128, monthly: 824  },
    ],
    rds: [
      // Cloud SQL MySQL (asia-southeast1) — HA enabled
      { type: 'db-n1-standard-1', vcpu: 1,  ram: 3.75, monthly: 50   },
      { type: 'db-n1-standard-2', vcpu: 2,  ram: 7.5,  monthly: 135  },
      { type: 'db-n1-standard-4', vcpu: 4,  ram: 15,   monthly: 270  },
      { type: 'db-n1-standard-8', vcpu: 8,  ram: 30,   monthly: 540  },
      { type: 'db-n1-highmem-4',  vcpu: 4,  ram: 26,   monthly: 340  },  // memory-opt
    ],
  },
};

// ── VM Sizing Decision Matrix ─────────────────────────────────────────────────
// RAM target (GB) by company size — selects smallest instance that meets target
const VM_RAM_TARGET = { small: 4, medium: 16, large: 32, enterprise: 64 };
const DB_RAM_TARGET = { small: 4, medium: 16, large: 32, enterprise: 64 };

function selectInstance(catalog_list, ramTarget) {
  return catalog_list.find(vm => vm.ram >= ramTarget) || catalog_list[catalog_list.length - 1];
}

// ── DR Tier Matrix ────────────────────────────────────────────────────────────
// Maps drRequirements form value → DR strategy, RTO/RPO, and cost as % of (compute+db)
// Based on AWS DR whitepaper + Microsoft BCDR guidance + GCP DR planning guide
const DR_TIER_MATRIX = {
  'none':   { label: 'No DR',                rto: 'N/A',    rpo: 'N/A',    strategy: '無備援',                              cost_pct: 0.00 },
  'rto24h': { label: 'Backup & Restore',     rto: '24h',    rpo: '24h',    strategy: 'S3/Blob/GCS 異地備份還原',            cost_pct: 0.08 },
  'rto8h':  { label: 'Pilot Light',          rto: '8h',     rpo: '4h',     strategy: 'Pilot Light（最小化備援環境預熱）',   cost_pct: 0.20 },
  'rto4h':  { label: 'Warm Standby',         rto: '4h',     rpo: '1h',     strategy: 'Warm Standby（縮小版跨 AZ 熱備）',   cost_pct: 0.35 },
  'rto1h':  { label: 'Hot Standby',          rto: '1h',     rpo: '15min',  strategy: 'Hot Standby（跨區域主動待機）',      cost_pct: 0.60 },
  'rto15m': { label: 'Active-Active',        rto: '15min',  rpo: '5min',   strategy: 'Active-Active（雙活多區域）',        cost_pct: 1.00 },
  'rto0':   { label: 'Zero Downtime',        rto: '<1min',  rpo: '~0',     strategy: 'Global Active-Active + Global LB',  cost_pct: 1.40 },
};

// ── Storage Class Mapping (per TB/month, tiered by access pattern) ────────────
// Access pattern distribution: hot=frequently accessed, warm=weekly, cool=monthly, archive=yearly
const STORAGE_CLASS = {
  aws: {
    hot:     { name: 'S3 Standard + EBS gp3 (blended)',     per_tb: 52  },
    warm:    { name: 'S3 Standard-IA',                      per_tb: 13  },
    cool:    { name: 'S3 Glacier Instant Retrieval',        per_tb:  5  },
    archive: { name: 'S3 Glacier Deep Archive',             per_tb:  1  },
  },
  azure: {
    hot:     { name: 'Blob Hot + Premium SSD (blended)',    per_tb: 66  },
    warm:    { name: 'Blob Cool',                           per_tb: 15  },
    cool:    { name: 'Blob Cool',                           per_tb: 15  },
    archive: { name: 'Blob Archive',                        per_tb:  2  },
  },
  gcp: {
    hot:     { name: 'GCS Standard + PD SSD (blended)',     per_tb: 55  },
    warm:    { name: 'GCS Nearline',                        per_tb: 10  },
    cool:    { name: 'GCS Coldline',                        per_tb:  4  },
    archive: { name: 'GCS Archive',                         per_tb:  1  },
  },
};

// Data access pattern by classification — determines tier distribution
const STORAGE_DIST = {
  'public':             { hot: 0.20, warm: 0.30, cool: 0.30, archive: 0.20 },
  'internal':           { hot: 0.30, warm: 0.35, cool: 0.25, archive: 0.10 },
  'confidential':       { hot: 0.35, warm: 0.35, cool: 0.20, archive: 0.10 },
  'highly-confidential':{ hot: 0.50, warm: 0.30, cool: 0.15, archive: 0.05 },  // regulatory: more hot (audit trail)
};

function calcStorageCost(provider, dataClassification, dataSize) {
  const tb   = { small: 2, medium: 10, large: 60, very_large: 250 }[dataSize] || 10;
  const cls  = STORAGE_CLASS[provider] || STORAGE_CLASS.aws;
  const dist = STORAGE_DIST[dataClassification] || STORAGE_DIST.confidential;
  const cost = Math.round(
    tb * dist.hot     * cls.hot.per_tb  +
    tb * dist.warm    * cls.warm.per_tb +
    tb * dist.cool    * cls.cool.per_tb +
    tb * dist.archive * cls.archive.per_tb
  );
  return { cost, tb, hotCls: cls.hot.name };
}

// ── Tiered Egress Pricing (USD/TB, volume discount model) ─────────────────────
// AWS: 0-10TB $90 → 10-50TB $85 → 50-150TB $70 → >150TB $50
// Azure/GCP: similar tiers, slightly lower
const EGRESS_TIERS = {
  aws:   [{ upto: 10, rate: 90 }, { upto: 50,  rate: 85 }, { upto: 150, rate: 70 }, { upto: Infinity, rate: 50 }],
  azure: [{ upto: 10, rate: 87 }, { upto: 50,  rate: 83 }, { upto: 150, rate: 67 }, { upto: Infinity, rate: 48 }],
  gcp:   [{ upto: 10, rate: 85 }, { upto: 50,  rate: 81 }, { upto: 150, rate: 60 }, { upto: Infinity, rate: 45 }],
};

function calcTieredEgress(totalTB, provider) {
  const tiers = EGRESS_TIERS[provider] || EGRESS_TIERS.aws;
  let cost = 0, remaining = totalTB, prevLimit = 0;
  for (const t of tiers) {
    if (remaining <= 0) break;
    const slice = Math.min(remaining, t.upto - prevLimit);
    cost    += slice * t.rate;
    remaining -= slice;
    prevLimit  = t.upto;
  }
  return Math.round(cost);
}

// Estimate monthly egress TB from form inputs
function estimateEgressTB(inputs) {
  const gb = parseFloat(inputs.monthlyTrafficGB) || 0;
  if (gb > 0) return gb / 1000 * 0.45; // ~45% of total traffic is internet egress
  // Fallback: derive from company size + tx volume
  const base = {
    small:      { low: 0.5, medium: 2,  high: 8,   very_high: 25  },
    medium:     { low: 2,   medium: 8,  high: 30,  very_high: 100 },
    large:      { low: 5,   medium: 20, high: 80,  very_high: 300 },
    enterprise: { low: 10,  medium: 50, high: 200, very_high: 800 },
  };
  return (base[inputs.companySize] || base.medium)[inputs.txVolume || 'medium'] || 8;
}

// ── Reserved / Committed-Use Discounts ────────────────────────────────────────
const RESERVED_DISCOUNTS = {
  aws:   { one_yr: 0.37, three_yr: 0.57, spot: 0.70 },
  azure: { one_yr: 0.40, three_yr: 0.60, spot: 0.60 },
  gcp:   { one_yr: 0.37, three_yr: 0.60, spot: 0.60 },
};

// ── 6R Multi-Factor Weighted Scoring ─────────────────────────────────────────
// Each strategy has a base score + additive/subtractive factors from inputs.
// This replaces the old "if isOnPrem → rehost++" rule engine.
function score6R(inputs) {
  const months  = parseFloat(inputs.timelineMonths) || 18;
  const budget  = parseFloat(inputs.budgetUSD)      || 500_000;
  const servers = parseFloat(inputs.systemCount)    || 20;
  const isOnPrem    = /on.?prem/i.test(inputs.currentInfra || '');
  const isLegacy    = inputs.systemAge === 'legacy';
  const isModern    = inputs.systemAge === 'modern' || /microservices|serverless/i.test(inputs.archType || '');
  const isMonolith  = /monolith/i.test(inputs.archType || '');
  const isFinancial = /financial|banking|insurance|fintech/i.test(inputs.industry || '');
  const isHighSens  = inputs.dataClassification === 'highly-confidential';
  const isHighRegs  = (inputs.regulatoryRequirements || []).length > 0 || (inputs.complianceFrameworks || []).length > 0;
  const isLargeOrg  = /large|enterprise/.test(inputs.companySize || '');
  const isSmallTeam = inputs.teamSize === 'small';
  const isAdvTeam   = inputs.teamSize === 'large' || inputs.teamCloudMaturity === 'advanced';
  const driver = inputs.migrationDriver || 'cost';
  const isCost      = driver === 'cost';
  const isAgility   = driver === 'agility';
  const isInnovation= driver === 'innovation' || driver === 'digital-transformation';

  // ── Rehost: fast, minimal disruption; best for legacy on-prem + tight timeline
  let rehost = 45;
  if (isOnPrem)            rehost += 15;
  if (months <= 12)        rehost += 20;  // tight deadline → only option
  if (months <= 6)         rehost += 10;
  if (budget < 200_000)    rehost += 12;
  if (servers > 50)        rehost +=  8;  // many systems → move fast
  if (isLegacy || isMonolith) rehost += 8;
  if (isAgility)           rehost -= 20;
  if (isInnovation)        rehost -= 25;
  if (isAdvTeam)           rehost -= 10;
  if (isModern)            rehost -= 15;
  if (isLargeOrg && !isLegacy) rehost -= 8;

  // ── Replatform: lift & reshape — balanced cost/benefit, managed services
  let replatform = 58;
  if (isCost)              replatform += 12;  // managed services reduce ops cost
  if (months >= 12 && months <= 24) replatform += 10;
  if (inputs.companySize === 'medium') replatform += 8;
  if (isOnPrem)            replatform +=  8;  // managed DB/cache is easy early win
  if (isHighRegs)          replatform +=  8;  // managed services simplify compliance
  if (budget >= 200_000)   replatform +=  5;
  if (months < 6)          replatform -= 15;  // too fast for meaningful replatform
  if (isInnovation)        replatform -= 10;

  // ── Refactor: max cloud-native benefit; high cost + time
  let refactor = 30;
  if (isAgility || isInnovation) refactor += 25;
  if (months > 24)         refactor += 15;
  if (months > 18)         refactor +=  8;
  if (budget >= 1_000_000) refactor += 20;
  if (budget >= 500_000)   refactor += 10;
  if (isAdvTeam)           refactor += 15;
  if (isModern && !isMonolith) refactor += 12;
  if (isLargeOrg)          refactor +=  8;
  if (months <= 12)        refactor -= 25;
  if (budget < 300_000)    refactor -= 20;
  if (isSmallTeam && !isAdvTeam) refactor -= 15;
  if (servers > 100)       refactor -= 10;  // too many to refactor all

  // ── Repurchase: replace with SaaS — commodity functions (CRM/HR/ERP)
  let repurchase = 25;
  if (isCost)              repurchase += 10;
  if (inputs.companySize === 'small')  repurchase += 15;
  if (inputs.companySize === 'medium') repurchase +=  8;
  if (/retail|manufacturing|education/i.test(inputs.industry || '')) repurchase += 10;
  if (isFinancial && isHighSens) repurchase -= 20;  // core banking can't use SaaS
  if (isHighRegs)          repurchase -= 10;
  if (isLargeOrg)          repurchase -=  8;

  // ── Retire: eliminate redundant/low-value systems (part of any migration)
  let retire = 15;
  if (servers > 30)        retire += 10;
  if (servers > 100)       retire += 10;
  if (isLegacy)            retire += 15;
  if (isMonolith)          retire +=  5;
  if (isCost)              retire += 10;

  // ── Retain: regulatory/technical blocker — keep on-prem or private cloud
  let retain = 20;
  if (isHighSens && isFinancial) retain += 25;
  if (isFinancial && isHighRegs) retain += 15;
  if (isHighSens)          retain += 15;
  if (isHighRegs && months <= 12) retain += 10;  // can't solve compliance this fast
  if (isCost || isAgility) retain -= 15;
  if (isInnovation)        retain -= 20;

  const scores = {
    rehost:     Math.max(5,  Math.min(95, Math.round(rehost))),
    replatform: Math.max(5,  Math.min(95, Math.round(replatform))),
    refactor:   Math.max(5,  Math.min(95, Math.round(refactor))),
    repurchase: Math.max(5,  Math.min(85, Math.round(repurchase))),
    retire:     Math.max(5,  Math.min(60, Math.round(retire))),
    retain:     Math.max(5,  Math.min(80, Math.round(retain))),
  };
  const sorted  = Object.entries(scores).sort((a, b) => b[1] - a[1]);
  return { scores, primary: sorted[0][0], secondary: sorted[1][0], sorted };
}

/**
 * calculateFinOpsTCO — IBM FinOps Framework with real instance pricing
 *
 * Inputs used:  targetCloud, companySize, systemCount, drRequirements,
 *               dataClassification, dataSize, monthlyTrafficGB, txVolume,
 *               complianceLevel, hasPersonalData, hasFinancialData,
 *               envCount, migrationDriver, industry
 */
function calculateFinOpsTCO(inputs) {
  const provider    = (inputs.targetCloud || 'AWS').toLowerCase();
  const tier        = inputs.companySize || 'medium';
  const n           = Math.max(1, parseInt(inputs.systemCount) || 20);
  const drKey       = inputs.drRequirements || 'rto4h';
  const dataClass   = inputs.dataClassification || 'confidential';
  const hasFinData  = inputs.hasFinancialData === 'yes' || dataClass === 'highly-confidential';
  const hasPII      = inputs.hasPersonalData  === 'yes';

  const catalog = VM_CATALOG[provider] || VM_CATALOG.aws;
  const disc    = RESERVED_DISCOUNTS[provider] || RESERVED_DISCOUNTS.aws;

  // ── Workload profile → instance series ───────────────────────────────────
  let profile = 'general';
  if (/media|gaming|batch|hpc/i.test(inputs.industry || '') ||
      inputs.migrationDriver === 'performance') profile = 'compute';
  if (hasFinData || /financ|banking/i.test(inputs.industry || '')) profile = 'memory';

  // ── VM instance selection (smallest that meets RAM target) ───────────────
  const vmSpec = selectInstance(catalog[profile] || catalog.general, VM_RAM_TARGET[tier] || 16);
  const totalCompute = vmSpec.monthly * n;

  // ── Database selection ───────────────────────────────────────────────────
  const dbCount = { small: 1, medium: 2, large: 4, enterprise: 8 }[tier] || 2;
  const dbSpec  = selectInstance(catalog.rds, DB_RAM_TARGET[tier] || 16);
  const totalDB = dbSpec.monthly * dbCount;

  // ── Storage (tiered access pattern, not flat rate) ───────────────────────
  const stor = calcStorageCost(provider, dataClass, inputs.dataSize || 'medium');
  const totalStorage = stor.cost;

  // ── Network egress (tiered volume pricing, not flat $/TB) ───────────────
  const egressTB  = estimateEgressTB(inputs);
  const totalNetwork = calcTieredEgress(egressTB, provider);

  // ── DR cost (DR tier matrix, not binary yes/no) ───────────────────────────
  const drTier = DR_TIER_MATRIX[drKey] || DR_TIER_MATRIX['rto4h'];
  const drCost = Math.round((totalCompute + totalDB) * drTier.cost_pct);

  // ── Compliance & security add-ons ────────────────────────────────────────
  const compMult  = { low: 1.00, medium: 1.18, high: 1.55 }[inputs.complianceLevel] || 1.18;
  const secBase   = { small: 150, medium: 420, large: 1200, enterprise: 3000 }[tier] || 420;
  const totalSec  = Math.round(secBase * compMult + (hasPII ? 220 : 0) + (hasFinData ? 550 : 0));

  // ── Managed platform services ────────────────────────────────────────────
  const managed   = { small: 180, medium: 580, large: 1500, enterprise: 3400 }[tier] || 580;

  // ── Multi-environment multiplier ─────────────────────────────────────────
  const envCount  = Math.max(1, parseInt(inputs.envCount) || 2);
  const envMult   = envCount >= 4 ? 1.30 : envCount >= 3 ? 1.15 : 1.00;

  // ── Support tier ─────────────────────────────────────────────────────────
  const suppPct   = tier === 'enterprise' ? 0.15 : 0.10;

  // ── Base on-demand total ─────────────────────────────────────────────────
  const base      = (totalCompute + totalDB + totalStorage + totalNetwork + totalSec + drCost + managed) * envMult;
  const support   = Math.round(base * suppPct);
  const onDemand  = Math.round(base + support);

  // ── Three FinOps scenarios ────────────────────────────────────────────────
  const conservative = Math.round(onDemand * 1.20);  // over-provisioned, no commitment

  const recommended  = Math.round((
    totalCompute * 0.6 * (1 - disc.one_yr)  + totalCompute * 0.4 +
    totalDB      * 0.7 * (1 - disc.one_yr)  + totalDB      * 0.3 +
    totalStorage + totalNetwork + totalSec + drCost + managed + support
  ) * envMult);

  const aggressive   = Math.round((
    totalCompute * 0.8 * (1 - disc.three_yr) + totalCompute * 0.2 * (1 - disc.spot) +
    totalDB      * 0.8 * (1 - disc.three_yr) +
    totalStorage * 0.70 +       // Intelligent-Tiering / auto tiering
    totalNetwork * 0.80 +       // CDN offload reduces egress
    totalSec + drCost * 0.60 + managed * 0.90 + support * 0.80
  ) * envMult);

  // ── Migration cost (IBM: team composition × hours × APAC rates) ──────────
  const compFactor  = compMult * (drTier.cost_pct > 0.3 ? 1.35 : 1.0) * (hasFinData ? 1.25 : 1.0);
  const baseHours   = { small: 320, medium: 1000, large: 3200, enterprise: 7500 }[tier] || 1000;
  const migCost     = Math.round(baseHours * 175 * compFactor / 100) * 100; // $175/hr APAC 2026

  // ── 3-yr ROI ─────────────────────────────────────────────────────────────
  const onPremEst   = onDemand * 1.8;   // on-prem TCO typically 1.5–2× cloud
  const saving3yr   = (onPremEst - recommended) * 36 - migCost;
  const payback     = Math.max(1, Math.round(migCost / Math.max(1, onPremEst - recommended)));
  const roi3yr      = saving3yr > 0
    ? `3年節省 USD $${Math.round(saving3yr).toLocaleString()}，ROI ${Math.round(saving3yr / (migCost || 1) * 100)}%`
    : '3年達損益平衡';

  return {
    conservative, recommended, aggressive,
    migration_cost_usd: migCost,
    roi_3yr:        roi3yr,
    payback_months: payback,
    breakdown: {
      compute_monthly:            Math.round(totalCompute),
      compute_per_server:         vmSpec.monthly,
      vm_type:                    vmSpec.type,
      vm_spec:                    `${vmSpec.vcpu} vCPU / ${vmSpec.ram}GB RAM`,
      database_monthly:           Math.round(totalDB),
      db_type:                    dbSpec.type,
      db_count:                   dbCount,
      storage_monthly:            Math.round(totalStorage),
      storage_tb:                 stor.tb,
      storage_class:              stor.hotCls,
      network_monthly:            Math.round(totalNetwork),
      egress_tb:                  Math.round(egressTB * 10) / 10,
      managed_services_monthly:   Math.round(managed),
      security_compliance_monthly:Math.round(totalSec),
      dr_monthly:                 Math.round(drCost),
      dr_strategy:                drTier.label,
      dr_rto:                     drTier.rto,
      dr_rpo:                     drTier.rpo,
      support_monthly:            Math.round(support),
    },
    methodology: `IBM FinOps TCO | ${provider.toUpperCase()} ${vmSpec.type} (${vmSpec.vcpu}vCPU/${vmSpec.ram}GB) × ${n} servers | DB: ${dbSpec.type} × ${dbCount} | DR: ${drTier.label} (+${Math.round(drTier.cost_pct * 100)}%) | Storage: ${stor.tb}TB tiered | Egress: ${Math.round(egressTB * 10) / 10}TB`,
  };
}

// Simple in-memory rate limiter (resets on cold start; good enough for serverless)
const rateLimitStore = new Map(); // sessionId -> { count, resetAt }

// ── Prompt Version (increment when system prompt changes) ────────────────────
const PROMPT_VERSION = '3.0.0'; // FinOps Engine v3: real VM catalog, DR matrix, tiered egress, multi-factor 6R

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

// ── Server-side Fallback Result Builder ──────────────────────────────────────
// Called when Workers AI fails to produce valid JSON.
// Generates a complete analysis result from FinOps TCO + carbon data + rule-based scoring.
function buildServerFallbackResult(inputs) {
  const industry             = inputs.industry             || 'General';
  const companySize          = inputs.companySize          || 'medium';
  const targetCloud          = inputs.targetCloud          || 'AWS';
  const systemCount          = parseInt(inputs.systemCount) || 20;
  const migrationDriver      = inputs.migrationDriver      || 'cost';
  const timelineMonths       = parseInt(inputs.timelineMonths) || 18;
  const dataClassification   = inputs.dataClassification   || 'confidential';
  const regulatoryRequirements = Array.isArray(inputs.regulatoryRequirements) ? inputs.regulatoryRequirements : [];
  const complianceFrameworks   = Array.isArray(inputs.complianceFrameworks)   ? inputs.complianceFrameworks   : [];
  const teamSize             = inputs.teamSize             || 'medium';
  const esgFramework         = inputs.esgFramework         || 'none';

  // ── 6R Strategy — multi-factor weighted scoring (score6R engine) ────────────
  const s6r        = score6R(inputs);
  const scores     = s6r.scores;
  const primary    = s6r.primary;
  const secondary  = s6r.secondary;
  const isHighCompl= regulatoryRequirements.length > 0 || complianceFrameworks.length > 0;
  const isLargeOrg = companySize === 'large' || companySize === 'enterprise';
  const isCostDriven   = migrationDriver === 'cost';
  const hasFinancial   = dataClassification === 'highly-confidential';
  const stratNames = {
    rehost: 'Rehost (Lift & Shift)', replatform: 'Replatform (Lift & Reshape)',
    refactor: 'Refactor / Re-architect', repurchase: 'Repurchase (Replace with SaaS)',
    retire: 'Retire', retain: 'Retain',
  };

  // ── Landing Zone ─────────────────────────────────────────────────────────
  const lzTier = hasFinancial || isHighCompl ? 'financial' : isLargeOrg ? 'standard' : 'basic';
  const lzAccounts = [
    { name: 'Management Account',      type: 'management',  purpose: '根帳號，僅供治理與計費管理', scps: ['deny-region-except-approved', 'require-mfa-root'] },
    { name: 'Security Tooling Account',type: 'security',    purpose: '集中安全掃描、GuardDuty、Security Hub', scps: ['restrict-security-modification'] },
    { name: 'Log Archive Account',     type: 'log',         purpose: 'CloudTrail、Config 不可篡改日誌保存（建議7年）', scps: ['deny-log-deletion'] },
    { name: 'Network Hub Account',     type: 'network',     purpose: 'Transit Gateway、共用VPC、WAF', scps: [] },
    { name: 'Production Account',      type: 'workload',    purpose: '正式環境，最小授權原則', scps: ['require-encryption', 'deny-public-s3'] },
    { name: 'Development Account',     type: 'workload',    purpose: '開發測試環境，獨立隔離', scps: [] },
    ...(lzTier === 'financial' ? [
      { name: 'DR Account',            type: 'dr',          purpose: '異地備援、跨區域複寫，符合RTO/RPO要求', scps: ['require-encryption'] },
      { name: 'Compliance Account',    type: 'compliance',  purpose: '稽核存取、合規報告、外部審計師存取', scps: [] },
    ] : []),
  ];

  // ── Cost (FinOps TCO) ─────────────────────────────────────────────────────
  const tco = calculateFinOpsTCO(inputs);

  // ── Risk Scores (rule-based) ──────────────────────────────────────────────
  const complianceRisk = isHighCompl ? 65 : hasFinancial ? 55 : 40;
  const techRisk       = isLargeOrg  ? 60 : 45;
  const opRisk         = teamSize === 'small' ? 70 : teamSize === 'large' ? 35 : 50;
  const timelineRisk   = timelineMonths < 12 ? 70 : timelineMonths < 24 ? 45 : 30;
  const dataRisk       = hasFinancial ? 70 : dataClassification === 'confidential' ? 50 : 30;
  const bizRisk        = companySize === 'enterprise' ? 55 : 40;
  const overallRisk    = Math.round((complianceRisk + techRisk + opRisk + timelineRisk + dataRisk + bizRisk) / 6);
  const readinessScore = Math.min(90, Math.max(40, 100 - overallRisk));

  // ── Sustainability ─────────────────────────────────────────────────────────
  const providerKey   = targetCloud.toLowerCase();
  const provData      = CARBON_DATA[providerKey] || CARBON_DATA.aws;
  const sortedRegions = Object.entries(provData.regions).sort((a, b) => a[1].intensity - b[1].intensity);
  const [, lowestR]   = sortedRegions[0];
  const kwhPerYear    = systemCount * ANNUAL_SERVER_KWH;
  const onpremCO2     = kwhPerYear * ONPREM_INTENSITY / 1e6;
  const cloudCO2      = kwhPerYear * lowestR.intensity / 1e6;
  const reductionPct  = Math.max(0, Math.round((onpremCO2 - cloudCO2) / onpremCO2 * 100));
  const reductionTon  = Math.max(0, Math.round((onpremCO2 - cloudCO2) * 10) / 10);
  const esgGuidanceMap = {
    tcfd: ['揭露氣候相關財務風險（TCFD框架）','建立情境分析（2°C / 4°C）','量化碳排基準數據（Scope 1/2/3）'],
    gri:  ['依 GRI 305-1/2/3 揭露溫室氣體排放','設定科學基礎目標（SBTi）','建立碳排監控 Dashboard'],
    sbti: ['提交 SBTi 承諾書','設定 1.5°C 對齊目標','建立年度減排路徑'],
    twse: ['依台灣 TWSE 永續報告書 GRI/SASB 規範揭露','建立董事會永續治理機制','量化 Scope 2 排放（市場基礎法）'],
    none: ['建議選擇 GRI Standards 作為揭露框架','優先建立碳排基準數據（Scope 1/2）','評估加入 RE100 或 SBTi'],
  };
  const quarters = Math.ceil(timelineMonths / 3);

  return {
    strategy: {
      primary, secondary, scores,
      rationale: `基於 ${industry} 產業、${companySize} 規模組織評估，建議採行 ${stratNames[primary]}。${isCostDriven ? '以成本優化為主要驅動因素，' : ''}${isHighCompl ? '需兼顧合規要求，' : ''}${isLargeOrg ? '大型組織建議分階段遷移。' : '建議優先遷移非核心系統以建立遷移信心。'}`,
      frameworks_applied: [
        `${targetCloud} Well-Architected Framework`,
        targetCloud === 'AWS' ? 'AWS Cloud Adoption Framework (CAF)' : targetCloud === 'Azure' ? 'Microsoft Cloud Adoption Framework' : 'GCP Architecture Framework',
        ...(isHighCompl ? ['ISO 27001', 'SOC 2 Type II'] : []),
        ...(regulatoryRequirements.includes('MAS') ? ['MAS TRM Guidelines 2021', 'MAS Outsourcing Guidelines'] : []),
      ],
    },
    landing_zone: {
      tier: lzTier,
      accounts: lzAccounts,
      guardrails: [
        'Root MFA 強制啟用（SCPs 防護）',
        'CloudTrail 多區域不可篡改日誌',
        'S3 Block Public Access 全面啟用',
        'GuardDuty 威脅偵測（所有帳號）',
        'AWS Config 合規持續評估',
        ...(isHighCompl ? ['AWS Security Hub（FSBP 基線）', 'IAM Access Analyzer 跨帳號存取審查'] : []),
      ],
      identity: 'IAM Identity Center (SSO) + 最小權限原則 + 角色型存取控制（RBAC）',
      network: 'Transit Gateway 中心輻射型網路架構，VPC Flow Logs 啟用，Network Firewall 保護',
      compliance_controls: [
        ...complianceFrameworks,
        ...(isHighCompl ? ['ISO 27001', 'SOC 2 Type II'] : []),
      ],
    },
    cost: {
      scenarios: {
        conservative: { monthly_usd: tco.conservative, annual_usd: tco.conservative * 12, description: 'On-Demand 定價，20% 容量緩衝，最小化管理服務配置' },
        recommended:  { monthly_usd: tco.recommended,  annual_usd: tco.recommended  * 12, description: '60% Reserved Instances（1年期）+ 右側配置，IBM FinOps 建議情境' },
        aggressive:   { monthly_usd: tco.aggressive,   annual_usd: tco.aggressive   * 12, description: '80% Reserved Instances（3年期）+ Spot/Serverless + PaaS 整合' },
      },
      migration_cost_usd: tco.migration_cost_usd,
      roi_3yr:        tco.roi_3yr,
      payback_months: tco.payback_months,
      cost_drivers: [
        `${targetCloud} 運算 ${tco.breakdown.vm_type || ''} (${tco.breakdown.vm_spec || ''}) × ${systemCount} 台: $${tco.breakdown.compute_monthly}/月`,
        `資料庫 ${tco.breakdown.db_type || ''} × ${tco.breakdown.db_count || 1} 實例: $${tco.breakdown.database_monthly}/月`,
        `儲存空間 ${tco.breakdown.storage_tb || 0}TB (${tco.breakdown.storage_class || 'tiered'}): $${tco.breakdown.storage_monthly}/月`,
        `網路出口 ${tco.breakdown.egress_tb || 0}TB (分級計價): $${tco.breakdown.network_monthly}/月`,
        `安全合規服務: $${tco.breakdown.security_compliance_monthly}/月`,
        ...(tco.breakdown.dr_monthly > 0 ? [`DR 備援 ${tco.breakdown.dr_strategy || ''} (${tco.breakdown.dr_rto || ''}): $${tco.breakdown.dr_monthly}/月`] : []),
      ],
    },
    risk: {
      dimensions: {
        compliance:  { score: complianceRisk, target: Math.max(20, complianceRisk - 25), mitigations: ['建立合規監控 Dashboard','聘請合規顧問進行 GAP 分析','ISO 27001 認證計畫'] },
        technology:  { score: techRisk,       target: Math.max(20, techRisk - 20),       mitigations: ['制定詳細應用程式盤點清單','建立技術債還清計畫','PoC 驗證核心技術風險'] },
        operational: { score: opRisk,         target: Math.max(20, opRisk - 20),         mitigations: ['制定雲端技能訓練計畫','建立 Cloud CoE（卓越中心）','導入 SRE 文化'] },
        timeline:    { score: timelineRisk,   target: Math.max(20, timelineRisk - 20),   mitigations: ['採用敏捷式遷移方法','優先遷移低風險系統','建立明確里程碑與 KPI'] },
        data:        { score: dataRisk,       target: Math.max(20, dataRisk - 25),       mitigations: ['建立資料分類與標記機制','實施端對端加密','確認資料主權與存放地點'] },
        business:    { score: bizRisk,        target: Math.max(20, bizRisk - 20),        mitigations: ['建立業務連續性計畫（BCP）','制定回滾策略','利害關係人溝通計畫'] },
      },
      overall_score: overallRisk,
      key_risks: [
        isHighCompl ? '法規合規要求複雜，需提前進行差距分析與主管機關溝通' : '應用程式技術遷移複雜度需仔細評估',
        `${timelineMonths} 個月時程${timelineRisk >= 60 ? '較為緊迫，建議考慮延長或縮小範圍' : '合理，可按計畫推進'}`,
        '人員雲端技能轉型需要提前規劃培訓計畫',
      ],
    },
    executive_summary: {
      readiness_score: readinessScore,
      headline: `${industry} 產業雲端遷移評估：建議採行 ${stratNames[primary]}，雲端就緒分數 ${readinessScore}%`,
      business_outcomes: [
        { outcome: '營運成本優化', benefit: `預估月雲端支出 USD $${tco.recommended.toLocaleString()}，${tco.roi_3yr}`, timeframe: '12–18 個月' },
        { outcome: '系統可用性提升', benefit: '達成 99.9%+ SLA，自動縮放應對流量峰值', timeframe: '6–12 個月' },
        { outcome: '安全合規強化', benefit: '建立全面監控體系，符合監管要求', timeframe: '3–6 個月' },
      ],
      investment_summary: `遷移投資 USD $${tco.migration_cost_usd.toLocaleString()}，預計 ${tco.payback_months} 個月回本`,
      roi_statement: tco.roi_3yr,
      recommended_timeline_quarters: quarters,
      board_risks: [
        { risk: '資料安全與合規風險',   mitigation: '建立 Data Governance 框架，實施端對端加密' },
        { risk: '業務連續性風險',       mitigation: '分階段遷移，確保每個階段均可回滾' },
        { risk: '人員與文化轉型風險',   mitigation: '建立 Cloud CoE，系統化培訓計畫' },
      ],
    },
    technical_roadmap: {
      phases: [
        { name: 'Phase 1：評估與基礎建設', duration_weeks: 8,
          objectives: ['完成應用程式盤點與依賴關係分析', 'Landing Zone 建置與安全基線', '建立 CI/CD Pipeline'],
          milestones: ['Landing Zone 驗收完成', '第一個非核心系統遷移完成'],
          owners: ['Cloud Architect', 'Security Lead'] },
        { name: 'Phase 2：遷移執行', duration_weeks: Math.max(8, Math.round(timelineMonths * 1.8)),
          objectives: ['批次遷移應用程式系統', '資料庫遷移與驗證', '效能基線建立'],
          milestones: ['50% 系統完成遷移', '效能驗收測試通過'],
          owners: ['Cloud Engineer', 'DevOps Lead', 'DBA'] },
        { name: 'Phase 3：最佳化與創新', duration_weeks: 8,
          objectives: ['成本最佳化（Reserved Instances、右側配置）', '導入 AI/ML 雲端原生服務', '建立 FinOps 治理機制'],
          milestones: ['成本目標達成驗收', 'FinOps Dashboard 上線'],
          owners: ['FinOps Lead', 'Cloud Architect'] },
      ],
      poc: {
        scope: '選取 1–2 個低風險、高代表性系統進行雲端 PoC 驗證',
        success_criteria: [
          '功能完整性：100% 業務功能正常運行',
          '效能：回應時間 ≤ 現有系統 110%',
          `成本：月成本在 USD $${Math.round(tco.recommended * 0.1).toLocaleString()} 預算範圍內`,
          '安全：通過滲透測試，0 個 Critical 漏洞',
        ],
        duration_weeks: 4,
        workloads: ['選取非核心業務系統', '無狀態 Web 服務優先'],
      },
      kpis: [
        { metric: '遷移完成率',    baseline: '0%',         target: '100%',                             cadence: 'monthly' },
        { metric: '雲端月支出',    baseline: `USD $${tco.conservative.toLocaleString()}`, target: `USD $${tco.recommended.toLocaleString()}`, cadence: 'monthly' },
        { metric: '系統可用性',    baseline: '99.5%',      target: '99.9%',                            cadence: 'weekly'  },
        { metric: '安全事件數',    baseline: 'N/A',        target: '0 Critical',                       cadence: 'weekly'  },
      ],
      critical_dependencies: [
        `${targetCloud} 帳號開通與 IAM 權限設定`,
        '網路連線方案評估（Direct Connect / ExpressRoute / Cloud Interconnect）',
        '應用程式盤點與依賴關係確認（Application Portfolio Assessment）',
        isHighCompl ? '合規主管機關確認（監管批准取得）' : '內部 IT 治理委員會批准',
      ],
    },
    regulatory_guidance: {
      applicable_frameworks: [
        ...complianceFrameworks,
        ...(regulatoryRequirements.includes('MAS') ? ['MAS TRM Guidelines 2021', 'MAS Outsourcing Guidelines'] : []),
        'ISO 27017（雲端安全控制）',
        'SOC 2 Type II',
      ],
      key_requirements: [
        '資料主權：確認資料存放於允許的地理區域',
        '存取控制：MFA 強制啟用、最小權限原則',
        '稽核日誌：不可篡改日誌保存（建議 7 年）',
        ...(isHighCompl ? ['第三方風險管理：雲端供應商盡職調查', '業務連續性計畫（BCP）年度演練'] : []),
      ],
      gap_analysis: `主要合規差距：雲端環境稽核日誌機制、資料加密標準、第三方風險管理框架。建議優先建立 ${targetCloud} Security Hub 集中監控。`,
      recommended_certifications: ['ISO 27001', 'CSA STAR', ...(isHighCompl ? ['PCI DSS（如適用）', 'SOC 2 Type II'] : [])],
    },
    next_steps: [
      { priority: 1, action: '成立雲端遷移專案小組，指定 Cloud Owner 與決策機制', owner: 'CIO / IT Director', timeline: '第 1 週', effort: 'low' },
      { priority: 2, action: '完成應用程式盤點（Application Portfolio Assessment）與 6R 分類', owner: 'Cloud Architect', timeline: '第 2–4 週', effort: 'high' },
      { priority: 3, action: `建立 ${targetCloud} Landing Zone，完成安全基線設定（Guardrails）`, owner: 'Cloud Architect + Security Lead', timeline: '第 3–6 週', effort: 'high' },
      { priority: 4, action: '選定 PoC 系統，啟動 4 週概念驗證（含效能與安全測試）', owner: 'Cloud Engineer', timeline: '第 5–8 週', effort: 'medium' },
      { priority: 5, action: '簽訂 Reserved Instances / Committed Use Discounts，鎖定長期成本優勢', owner: 'FinOps Lead', timeline: '遷移完成後 1 個月', effort: 'low' },
    ],
    sustainability: {
      carbon_reduction_pct:         reductionPct,
      annual_co2_reduction_tonnes:  reductionTon,
      recommended_region:           lowestR.name,
      recommended_region_intensity: lowestR.intensity,
      renewable_pct:                lowestR.renewable,
      onprem_baseline_intensity:    ONPREM_INTENSITY,
      rationale: `依台灣電網碳強度（${ONPREM_INTENSITY} gCO₂eq/kWh）為基準，遷移 ${systemCount} 台伺服器至 ${lowestR.name}（${lowestR.intensity} gCO₂eq/kWh，${lowestR.renewable}% 再生能源），預估每年減少 ${reductionTon} 噸 CO₂，碳排強度降低 ${reductionPct}%。計算依據：${systemCount} 台 × ${ANNUAL_SERVER_KWH.toLocaleString()} kWh/年 = ${Math.round(kwhPerYear / 1000)} MWh/年。`,
      esg_guidance:      esgGuidanceMap[esgFramework] || esgGuidanceMap.none,
      provider_commitment: provData.commitment,
      monitoring_tool:     provData.tool,
    },
    meta: {
      analysis_version:  '2.0',
      frameworks_version: '2026-Q1',
      confidence: 'medium',
      assumptions: [
        `IBM FinOps TCO 方法論（${targetCloud} ${companySize} tier，${systemCount} servers）`,
        `碳排計算基準：台灣電網 ${ONPREM_INTENSITY} gCO₂eq/kWh`,
        '專業服務費率：USD $165/小時（APAC 市場 2026 Q1）',
        '此為規則型備援分析（Workers AI 回應格式解析失敗後的伺服器端備援）',
      ],
    },
  };
}

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

  // Auth check — need at least one AI engine
  if (!env.OPENAI_API_KEY && !env.AI) {
    return new Response(
      JSON.stringify({
        error: 'AI engine not configured. Set OPENAI_API_KEY (recommended: gpt-4o-mini) or enable Cloudflare Workers AI binding.',
        code:  'NO_AI_ENGINE',
      }),
      { status: 503, headers: { ...cors, 'Content-Type': 'application/json' } }
    );
  }

  // Engine config
  const USE_OPENAI     = !!env.OPENAI_API_KEY;
  const OPENAI_MODEL   = env.OPENAI_MODEL   || 'gpt-4o-mini';   // gpt-4o for higher quality
  const CF_AI_MODEL    = env.CF_AI_MODEL    || '@cf/meta/llama-3.1-8b-instruct';
  const MAX_TOKENS     = parseInt(env.AI_MAX_TOKENS || env.CLAUDE_MAX_TOKENS || '4096', 10);
  const RATE_LIMIT_RPH = parseInt(env.RATE_LIMIT_RPH || '20', 10);

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

  // ── AI Call (OpenAI preferred → Cloudflare Workers AI fallback) ─────────────
  try {
    // ── RAG：取得相關知識庫文件 ──────────────────────────────
    const ragContext  = await getRagContext(inputs, supabase, openaiKey);
    const userMessage = buildUserMessage(inputs) + ragContext;
    const messages    = [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user',   content: userMessage   },
    ];

    let aiText = '', aiModelUsed = '', aiProvider = '';

    if (USE_OPENAI) {
      // ── OpenAI GPT-4o / gpt-4o-mini ───────────────────────────────────────
      // response_format: json_object → API GUARANTEES valid JSON output
      const oaiRes = await fetch('https://api.openai.com/v1/chat/completions', {
        method:  'POST',
        headers: {
          'Authorization': `Bearer ${env.OPENAI_API_KEY}`,
          'Content-Type':  'application/json',
        },
        body: JSON.stringify({
          model:           OPENAI_MODEL,
          messages,
          max_tokens:      MAX_TOKENS,
          temperature:     0.2,             // low temp = consistent structured output
          response_format: { type: 'json_object' },  // guaranteed valid JSON
        }),
      });

      if (!oaiRes.ok) {
        const err = await oaiRes.json().catch(() => ({}));
        const e   = new Error(err.error?.message || `OpenAI HTTP ${oaiRes.status}`);
        e.status  = oaiRes.status;
        e.code    = err.error?.code;
        throw e;
      }

      const oaiData  = await oaiRes.json();
      aiText         = oaiData.choices?.[0]?.message?.content || '';
      aiModelUsed    = oaiData.model || OPENAI_MODEL;
      aiProvider     = 'openai';
      console.log(`[analyze] OpenAI ${aiModelUsed} | ${oaiData.usage?.total_tokens ?? '?'} tokens | prompt_tokens=${oaiData.usage?.prompt_tokens}`);

    } else {
      // ── Cloudflare Workers AI (fallback) ──────────────────────────────────
      const cfRes = await env.AI.run(CF_AI_MODEL, { messages, max_tokens: MAX_TOKENS });
      aiText      = cfRes.response || '';
      aiModelUsed = CF_AI_MODEL;
      aiProvider  = 'cloudflare';
      console.log(`[analyze] Workers AI ${CF_AI_MODEL}`);
    }

    // ── JSON Extraction ───────────────────────────────────────────────────────
    let jsonResult = null;

    if (aiProvider === 'openai') {
      // OpenAI with response_format:json_object guarantees parseable JSON
      try { jsonResult = JSON.parse(aiText); } catch (e) {
        console.warn('[analyze] OpenAI JSON parse failed (extremely rare):', e.message);
      }
    } else {
      // Workers AI: multi-strategy extraction (model may add prose around JSON)
      if (aiText.trim()) {
        const fenceMatch = aiText.match(/```json\s*([\s\S]*?)\s*```/);
        if (fenceMatch) {
          try { jsonResult = JSON.parse(fenceMatch[1]); } catch { /* try next */ }
        }
        if (!jsonResult) {
          const objMatch = aiText.match(/(\{[\s\S]*\})/);
          if (objMatch) {
            try { jsonResult = JSON.parse(objMatch[1]); } catch { /* try next */ }
          }
        }
        if (!jsonResult) {
          try { jsonResult = JSON.parse(aiText.trim()); } catch { /* fall through */ }
        }
      }
    }

    // ── Server-side fallback (if AI failed to produce valid JSON) ─────────────
    if (!jsonResult) {
      console.warn(`[analyze] ${aiProvider} response JSON parse failed; using server-side rule-based fallback.`);
      jsonResult = buildServerFallbackResult(inputs);
    }

    // ── Server-side sustainability: always compute from CARBON_DATA ───────────
    // Do NOT rely on AI to generate carbon numbers — compute directly and merge.
    // jsonResult is always non-null at this point (fallback builder ensures it).
    {
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
          all_regions_ranked:  sorted.slice(0, 5).map(([, d]) => `${d.name}: ${d.intensity} gCO₂/kWh (${d.renewable}% RE)`),
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
        success:        true,
        result:         jsonResult,
        model:          aiModelUsed,
        provider:       aiProvider,
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
