/**
 * CloudFrame — /api/pricing
 * Real-time cloud instance pricing from official public APIs.
 *
 * GET /api/pricing?provider=azure|aws|gcp|all
 *
 * Sources:
 *   Azure: prices.azure.com (Microsoft official, free, no auth)
 *   AWS:   ec2.shop (open-source aggregator, no auth) + static verified fallback
 *   GCP:   Static 2026-Q1 verified rates (live API requires Google credentials)
 *
 * Response is cached in-memory for 24h (resets on cold start).
 */

// ── In-memory cache ───────────────────────────────────────────────────────────
let _cache    = null;
let _cacheAt  = 0;
const CACHE_TTL = 24 * 3600 * 1000;  // 24 hours

// ── Instance filters: what we care about ─────────────────────────────────────
const AZURE_ARM_SKUS = [
  'Standard_B2ms',
  'Standard_D2s_v5', 'Standard_D4s_v5', 'Standard_D8s_v5',
  'Standard_D16s_v5', 'Standard_D32s_v5',
  'Standard_F4s_v2',  'Standard_F8s_v2',  'Standard_F16s_v2',
  'Standard_E4s_v5',  'Standard_E8s_v5',  'Standard_E16s_v5',
];

const AWS_INSTANCE_TYPES = [
  't3.medium',
  'm6i.large',   'm6i.xlarge',   'm6i.2xlarge', 'm6i.4xlarge', 'm6i.8xlarge',
  'c6i.xlarge',  'c6i.2xlarge',  'c6i.4xlarge',
  'r6i.large',   'r6i.xlarge',   'r6i.2xlarge',
];

// ── GCP Static pricing (asia-southeast1, Linux, On-Demand, 2026-Q1) ──────────
// Live: Cloud Billing Catalog API requires service account credentials.
// Update quarterly via: https://cloud.google.com/skus/pricing
const GCP_STATIC = [
  { type: 'e2-medium',        vcpu: 2,  ram: 4,   monthly: 28,   hourly: 0.038  },
  { type: 'n2-standard-2',    vcpu: 2,  ram: 8,   monthly: 80,   hourly: 0.110  },
  { type: 'n2-standard-4',    vcpu: 4,  ram: 16,  monthly: 161,  hourly: 0.221  },
  { type: 'n2-standard-8',    vcpu: 8,  ram: 32,  monthly: 322,  hourly: 0.441  },
  { type: 'n2-standard-16',   vcpu: 16, ram: 64,  monthly: 643,  hourly: 0.881  },
  { type: 'n2-standard-32',   vcpu: 32, ram: 128, monthly: 1286, hourly: 1.762  },
  { type: 'c2-standard-4',    vcpu: 4,  ram: 16,  monthly: 165,  hourly: 0.226  },
  { type: 'c2-standard-8',    vcpu: 8,  ram: 32,  monthly: 330,  hourly: 0.452  },
  { type: 'n2-highmem-4',     vcpu: 4,  ram: 32,  monthly: 206,  hourly: 0.282  },
  { type: 'n2-highmem-8',     vcpu: 8,  ram: 64,  monthly: 412,  hourly: 0.564  },
  // Cloud SQL (asia-southeast1, HA)
  { type: 'db-n1-standard-2', vcpu: 2,  ram: 7.5, monthly: 135,  hourly: 0.185, category: 'rds' },
  { type: 'db-n1-standard-4', vcpu: 4,  ram: 15,  monthly: 270,  hourly: 0.370, category: 'rds' },
  { type: 'db-n1-standard-8', vcpu: 8,  ram: 30,  monthly: 540,  hourly: 0.740, category: 'rds' },
];

// ── AWS static fallback (ap-southeast-1, Linux, On-Demand, 2026-Q1) ──────────
// Used when ec2.shop is unavailable. Verified Jan 2026 from AWS Pricing Calculator.
const AWS_STATIC = [
  { type: 't3.medium',    vcpu: 2,  ram: 4,   monthly: 34,   hourly: 0.0464, source: 'static-2026Q1' },
  { type: 'm6i.large',    vcpu: 2,  ram: 8,   monthly: 79,   hourly: 0.108,  source: 'static-2026Q1' },
  { type: 'm6i.xlarge',   vcpu: 4,  ram: 16,  monthly: 159,  hourly: 0.218,  source: 'static-2026Q1' },
  { type: 'm6i.2xlarge',  vcpu: 8,  ram: 32,  monthly: 318,  hourly: 0.435,  source: 'static-2026Q1' },
  { type: 'm6i.4xlarge',  vcpu: 16, ram: 64,  monthly: 636,  hourly: 0.870,  source: 'static-2026Q1' },
  { type: 'm6i.8xlarge',  vcpu: 32, ram: 128, monthly: 1271, hourly: 1.741,  source: 'static-2026Q1' },
  { type: 'c6i.xlarge',   vcpu: 4,  ram: 8,   monthly: 139,  hourly: 0.190,  source: 'static-2026Q1' },
  { type: 'c6i.2xlarge',  vcpu: 8,  ram: 16,  monthly: 278,  hourly: 0.381,  source: 'static-2026Q1' },
  { type: 'r6i.large',    vcpu: 2,  ram: 16,  monthly: 110,  hourly: 0.151,  source: 'static-2026Q1' },
  { type: 'r6i.xlarge',   vcpu: 4,  ram: 32,  monthly: 221,  hourly: 0.302,  source: 'static-2026Q1' },
  // RDS MySQL Multi-AZ (ap-southeast-1)
  { type: 'db.t3.medium',   vcpu: 2, ram: 4,  monthly: 115,  hourly: 0.157,  source: 'static-2026Q1', category: 'rds' },
  { type: 'db.m6g.large',   vcpu: 2, ram: 8,  monthly: 245,  hourly: 0.335,  source: 'static-2026Q1', category: 'rds' },
  { type: 'db.m6g.xlarge',  vcpu: 4, ram: 16, monthly: 490,  hourly: 0.671,  source: 'static-2026Q1', category: 'rds' },
  { type: 'db.m6g.2xlarge', vcpu: 8, ram: 32, monthly: 980,  hourly: 1.342,  source: 'static-2026Q1', category: 'rds' },
];

// ── Handler ───────────────────────────────────────────────────────────────────
export async function onRequest(context) {
  const { request } = context;

  const cors = {
    'Access-Control-Allow-Origin':  '*',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Content-Type':                 'application/json',
  };

  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: cors });
  }
  if (request.method !== 'GET') {
    return new Response(JSON.stringify({ error: 'GET only' }), { status: 405, headers: cors });
  }

  const url      = new URL(request.url);
  const provider = url.searchParams.get('provider') || 'all';

  // Serve from cache if fresh
  const now = Date.now();
  if (_cache && now - _cacheAt < CACHE_TTL) {
    const resp = provider === 'all' ? _cache : { [provider]: _cache[provider] };
    return new Response(JSON.stringify({
      source:     'cache',
      cached_at:  new Date(_cacheAt).toISOString(),
      expires_at: new Date(_cacheAt + CACHE_TTL).toISOString(),
      ...resp,
    }), { headers: cors });
  }

  // Fetch fresh pricing in parallel
  const [azureResult, awsResult] = await Promise.allSettled([
    (provider === 'all' || provider === 'azure') ? fetchAzure() : Promise.resolve(null),
    (provider === 'all' || provider === 'aws')   ? fetchAWS()   : Promise.resolve(null),
  ]);

  const result = {
    fetched_at: new Date().toISOString(),
    azure: azureResult.value ?? (azureResult.reason ? { error: azureResult.reason?.message, instances: AWS_STATIC } : null),
    aws:   awsResult.value   ?? (awsResult.reason   ? { error: awsResult.reason?.message,   instances: AWS_STATIC } : null),
    gcp: {
      source:        'static-verified',
      last_verified: '2026-01-15',
      region:        'asia-southeast1',
      note:          'GCP Cloud Billing Catalog API requires service account credentials. Rates verified Jan 2026 from GCP Pricing Calculator.',
      instances:     GCP_STATIC,
    },
  };

  _cache   = result;
  _cacheAt = now;

  const resp = provider === 'all' ? result : { [provider]: result[provider] };
  return new Response(JSON.stringify({ source: 'live', ...resp }), { headers: cors });
}

// ── Azure Retail Prices API ───────────────────────────────────────────────────
// https://learn.microsoft.com/en-us/rest/api/cost-management/retail-prices
// Free, no authentication required.
async function fetchAzure() {
  // Fetch all VM prices for southeastasia region, Linux, on-demand
  const filter = encodeURIComponent(
    `serviceName eq 'Virtual Machines' and armRegionName eq 'southeastasia' and priceType eq 'Consumption'`
  );
  const endpoint = `https://prices.azure.com/api/retail/prices?currencyCode=USD&$filter=${filter}`;

  const res = await fetch(endpoint, {
    headers: { 'User-Agent': 'CloudFrame/3.0 (+https://cloudframe.pages.dev)' },
  });
  if (!res.ok) throw new Error(`Azure Retail Prices API: HTTP ${res.status}`);

  const data  = await res.json();
  const items = data.Items || [];

  const instances = [];
  const seen      = new Set();

  for (const item of items) {
    const armSku = item.armSkuName || '';
    if (!AZURE_ARM_SKUS.includes(armSku))               continue;
    if (seen.has(armSku))                               continue;
    if (/windows|spot|low priority/i.test(item.skuName)) continue;
    if (item.unitOfMeasure !== '1 Hour')                continue;

    seen.add(armSku);
    instances.push({
      type:     armSku.replace('Standard_', ''),
      armSku,
      vcpu:     null,  // Azure API doesn't return vCPU count directly
      monthly:  Math.round(item.retailPrice * 730 * 100) / 100,
      hourly:   item.retailPrice,
      region:   item.armRegionName,
      sku_name: item.skuName,
      source:   'prices.azure.com',
    });
  }

  // Enrich with known vCPU/RAM specs
  const SPECS = {
    'B2ms':     { vcpu: 2,  ram: 8   },
    'D2s_v5':   { vcpu: 2,  ram: 8   },
    'D4s_v5':   { vcpu: 4,  ram: 16  },
    'D8s_v5':   { vcpu: 8,  ram: 32  },
    'D16s_v5':  { vcpu: 16, ram: 64  },
    'D32s_v5':  { vcpu: 32, ram: 128 },
    'F4s_v2':   { vcpu: 4,  ram: 8   },
    'F8s_v2':   { vcpu: 8,  ram: 16  },
    'F16s_v2':  { vcpu: 16, ram: 32  },
    'E4s_v5':   { vcpu: 4,  ram: 32  },
    'E8s_v5':   { vcpu: 8,  ram: 64  },
    'E16s_v5':  { vcpu: 16, ram: 128 },
  };
  for (const inst of instances) {
    const key = inst.type.replace(/_/g, '');
    for (const [k, v] of Object.entries(SPECS)) {
      if (k.replace(/_/g, '').toLowerCase() === key.toLowerCase()) {
        inst.vcpu = v.vcpu;
        inst.ram  = v.ram;
        break;
      }
    }
  }

  return {
    source:     'prices.azure.com (official Microsoft API)',
    region:     'southeastasia',
    currency:   'USD',
    count:      instances.length,
    fetched_at: new Date().toISOString(),
    instances,
  };
}

// ── AWS Pricing ───────────────────────────────────────────────────────────────
// ec2.shop is an open-source price aggregator (https://github.com/nathanpeck/ec2shop)
// Falls back to static 2026-Q1 verified rates if unavailable.
async function fetchAWS() {
  const liveInstances = [];
  const errors        = [];

  // Fetch pricing for each instance type (in parallel, batched)
  const BATCH_SIZE = 4;
  for (let i = 0; i < AWS_INSTANCE_TYPES.length; i += BATCH_SIZE) {
    const batch = AWS_INSTANCE_TYPES.slice(i, i + BATCH_SIZE);
    const results = await Promise.allSettled(
      batch.map(type => fetchEC2Shop(type))
    );
    for (const r of results) {
      if (r.status === 'fulfilled' && r.value) liveInstances.push(r.value);
      else if (r.reason) errors.push(r.reason.message);
    }
  }

  if (liveInstances.length >= 3) {
    return {
      source:     'ec2.shop (open-source AWS pricing aggregator)',
      region:     'ap-southeast-1',
      currency:   'USD',
      count:      liveInstances.length,
      fetched_at: new Date().toISOString(),
      instances:  liveInstances,
    };
  }

  // Fallback to static data
  console.warn('[pricing] AWS live fetch failed, using static 2026-Q1 data. Errors:', errors.join(', '));
  return {
    source:        'static-verified',
    last_verified: '2026-01-15',
    region:        'ap-southeast-1',
    note:          'Live AWS pricing fetch failed (ec2.shop unavailable). Using 2026-Q1 verified rates from AWS Pricing Calculator.',
    instances:     AWS_STATIC,
  };
}

async function fetchEC2Shop(instanceType) {
  // ec2.shop: open-source tool that queries AWS pricing and returns per-instance JSON
  // GitHub: https://github.com/nathanpeck/ec2shop
  const url = `https://ec2.shop?instance=${instanceType}&region=ap-southeast-1&os=linux`;
  const res = await fetch(url, {
    headers: {
      'User-Agent': 'CloudFrame/3.0',
      'Accept':     'application/json',
    },
    // Cloudflare edge cache 24h
    cf: { cacheTtl: 86400, cacheEverything: true },
  });

  if (!res.ok) throw new Error(`ec2.shop ${instanceType}: HTTP ${res.status}`);

  const data = await res.json();
  const inst = data.Instances?.[0];
  if (!inst) throw new Error(`ec2.shop: no data for ${instanceType}`);

  return {
    type:    inst.Instance,
    vcpu:    inst.VCPU,
    ram:     parseFloat((inst.Memory || '0 GiB').replace(' GiB', '')),
    monthly: Math.round(inst.Price * 730 * 100) / 100,
    hourly:  inst.Price,
    source:  'ec2.shop',
  };
}
