/**
 * CloudFrame — API Client
 * Handles all communication with Netlify Functions / backend API.
 * Falls back to local rule-based engine when API is unavailable.
 *
 * Usage:
 *   const result = await APIClient.analyze(inputs, { onProgress });
 *   const trends = await APIClient.getTrends('regulatory');
 */

(function(global) {
  'use strict';

  // ── Config ─────────────────────────────────────────────────────────────────
  const API_BASE = (() => {
    // In development (file://) fall back to local engine
    if (location.protocol === 'file:') return null;
    // Netlify Functions path
    return '/api';
  })();

  const DEFAULT_TIMEOUT_MS = 90_000; // 90s — Claude with thinking can be slow

  // ── Session ID (for rate limiting) ─────────────────────────────────────────
  const SESSION_ID = (() => {
    const key = 'archie_session_id';
    let id = sessionStorage.getItem(key);
    if (!id) {
      id = 'sess_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
      sessionStorage.setItem(key, id);
    }
    return id;
  })();

  // ── Helpers ────────────────────────────────────────────────────────────────
  function isAPIAvailable() {
    return API_BASE !== null;
  }

  async function fetchWithTimeout(url, options = {}, timeoutMs = DEFAULT_TIMEOUT_MS) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const res = await fetch(url, { ...options, signal: controller.signal });
      clearTimeout(timer);
      return res;
    } catch (err) {
      clearTimeout(timer);
      if (err.name === 'AbortError') throw new Error('Request timed out after ' + (timeoutMs / 1000) + 's');
      throw err;
    }
  }

  // ── Analyse ────────────────────────────────────────────────────────────────
  /**
   * Run a cloud advisory analysis.
   *
   * @param {object} inputs       - Form inputs from analyze.html
   * @param {object} [opts]
   * @param {function} [opts.onProgress]  - Called with { stage, message } during processing
   * @param {boolean} [opts.forceLocal]   - Skip API, use local engine only
   * @returns {Promise<object>}   - Analysis result object
   */
  async function analyze(inputs, opts = {}) {
    const { onProgress = () => {}, forceLocal = false } = opts;

    // Always try API first (unless forced local or no API base)
    if (!forceLocal && isAPIAvailable()) {
      try {
        return await _analyzeViaAPI(inputs, onProgress);
      } catch (err) {
        console.warn('[APIClient] API call failed, falling back to local engine:', err.message);
        onProgress({ stage: 'fallback', message: '⚡ 使用本地分析引擎（API 暫時無法連線）' });
      }
    }

    // Fallback: local rule-based engine
    return await _analyzeLocal(inputs, onProgress);
  }

  async function _analyzeViaAPI(inputs, onProgress) {
    onProgress({ stage: 'connecting', message: '🔗 連線至 Claude AI 引擎…' });

    const res = await fetchWithTimeout(`${API_BASE}/analyze`, {
      method:  'POST',
      headers: {
        'Content-Type':   'application/json',
        'x-session-id':   SESSION_ID,
      },
      body: JSON.stringify({ inputs }),
    });

    if (!res.ok) {
      let errMsg = `HTTP ${res.status}`;
      try {
        const errBody = await res.json();
        errMsg = errBody.error || errMsg;
      } catch { /* ignore */ }

      // 503 = API key not set (dev environment without key)
      if (res.status === 503) {
        throw new Error('API_KEY_NOT_SET:' + errMsg);
      }
      throw new Error(errMsg);
    }

    onProgress({ stage: 'processing', message: '🧠 Claude 正在深度分析您的架構需求…' });

    const data = await res.json();

    if (!data.success) {
      throw new Error(data.error || 'Analysis failed');
    }

    onProgress({ stage: 'done', message: '✅ 分析完成' });

    // API always returns a structured result (server-side fallback builder guarantees it)
    if (data.result) {
      return _normaliseAPIResult(data.result, inputs);
    }

    // Should never reach here — API always returns result now.
    // If it somehow does, fall through to local engine (throw → caller catches → _analyzeLocal).
    throw new Error('API returned no result — switching to local engine');
  }

  async function _analyzeLocal(inputs, onProgress) {
    onProgress({ stage: 'local', message: '⚙️ 本地分析引擎啟動中…' });

    // Dynamic import — AnalyzeEngine must be loaded in the page
    if (typeof AnalyzeEngine === 'undefined') {
      throw new Error('AnalyzeEngine not loaded. Please include analyze-engine.js');
    }
    const result = await AnalyzeEngine.analyze(inputs);

    // Always override with FinOps calculator (input-aware, not bucket-based)
    const fc = _computeFinOpsCost(inputs, null);
    const sc = fc.scenarios || {};
    result.costEstimate = {
      ...(result.costEstimate || {}),
      low:          sc.conservative?.monthly_usd || result.costEstimate?.low  || 3000,
      mid:          sc.recommended?.monthly_usd  || result.costEstimate?.mid  || 5000,
      high:         sc.aggressive?.monthly_usd   || result.costEstimate?.high || 7000,
      annualLow:    (sc.conservative?.monthly_usd || 3000) * 12,
      annualHigh:   (sc.aggressive?.monthly_usd   || 7000) * 12,
      annual:       (sc.recommended?.monthly_usd  || 5000) * 12,
      roi3yr:       fc.roi_3yr || '',
      paybackMths:  fc.payback_months || 18,
      scenarios:    sc,
      drivers:      fc.cost_drivers.map(d => ({ name: d, pct: 0 })),
    };

    // Always inject sustainability
    result.sustainability = _computeSustainability(inputs, result.sustainability);

    return result;
  }

  // ── Carbon intensity data (client-side copy, always available) ────────────
  const CARBON_DATA_CLIENT = {
    aws:   {
      regions: {
        'ap-east-1':      { name:'Hong Kong',   intensity:799, renewable:5  },
        'ap-southeast-1': { name:'Singapore',   intensity:408, renewable:25 },
        'ap-northeast-1': { name:'Tokyo',       intensity:463, renewable:30 },
        'ap-south-1':     { name:'Mumbai',      intensity:708, renewable:20 },
        'eu-north-1':     { name:'Stockholm',   intensity:8,   renewable:99 },
        'eu-west-1':      { name:'Ireland',     intensity:316, renewable:72 },
        'us-east-1':      { name:'N. Virginia', intensity:415, renewable:65 },
        'us-west-2':      { name:'Oregon',      intensity:136, renewable:89 },
      },
      commitment: 'Net Zero by 2040, 100% renewable energy by 2025',
      tool: 'AWS Customer Carbon Footprint Tool',
    },
    azure: {
      regions: {
        'eastasia':      { name:'Hong Kong',  intensity:790, renewable:5  },
        'southeastasia': { name:'Singapore',  intensity:408, renewable:25 },
        'japaneast':     { name:'Tokyo',      intensity:463, renewable:30 },
        'swedencentral': { name:'Sweden',     intensity:8,   renewable:99 },
        'northeurope':   { name:'Ireland',    intensity:316, renewable:72 },
        'westeurope':    { name:'Netherlands',intensity:390, renewable:55 },
      },
      commitment: 'Carbon negative by 2030, remove all historical carbon by 2050',
      tool: 'Azure Emissions Impact Dashboard',
    },
    gcp: {
      regions: {
        'asia-east1':      { name:'Taiwan',    intensity:509, renewable:15 },
        'asia-east2':      { name:'Hong Kong', intensity:790, renewable:5  },
        'asia-northeast1': { name:'Tokyo',     intensity:463, renewable:30 },
        'asia-southeast1': { name:'Singapore', intensity:408, renewable:25 },
        'europe-north1':   { name:'Finland',   intensity:35,  renewable:97 },
        'europe-west1':    { name:'Belgium',   intensity:150, renewable:85 },
        'us-central1':     { name:'Iowa',      intensity:356, renewable:90 },
      },
      commitment: 'Carbon-free energy 24/7 by 2030, carbon neutral since 2007',
      tool: 'GCP Carbon Footprint',
    },
  };
  const ONPREM_INTENSITY_CLIENT = 509; // gCO2eq/kWh — Taiwan grid average
  const ANNUAL_KWH_PER_SERVER   = 8760;

  // ════════════════════════════════════════════════════════════════════════════
  // FinOps Engine v3 — Real Instance Pricing + DR Matrix + Storage Tiers (2026-Q1)
  // Mirrors server-side engine in functions/api/analyze.js
  // ════════════════════════════════════════════════════════════════════════════

  // ── VM Instance Catalog (On-Demand, Linux, Asia-Pacific, USD/month) ─────────
  const VM_CAT = {
    aws: {
      general: [
        { type: 't3.medium',   vcpu: 2,  ram: 4,   monthly: 34   },
        { type: 'm6i.large',   vcpu: 2,  ram: 8,   monthly: 79   },
        { type: 'm6i.xlarge',  vcpu: 4,  ram: 16,  monthly: 159  },
        { type: 'm6i.2xlarge', vcpu: 8,  ram: 32,  monthly: 318  },
        { type: 'm6i.4xlarge', vcpu: 16, ram: 64,  monthly: 636  },
        { type: 'm6i.8xlarge', vcpu: 32, ram: 128, monthly: 1271 },
      ],
      compute: [
        { type: 'c6i.xlarge',  vcpu: 4,  ram: 8,   monthly: 139  },
        { type: 'c6i.2xlarge', vcpu: 8,  ram: 16,  monthly: 278  },
        { type: 'c6i.4xlarge', vcpu: 16, ram: 32,  monthly: 556  },
      ],
      memory: [
        { type: 'r6i.large',   vcpu: 2,  ram: 16,  monthly: 110  },
        { type: 'r6i.xlarge',  vcpu: 4,  ram: 32,  monthly: 221  },
        { type: 'r6i.2xlarge', vcpu: 8,  ram: 64,  monthly: 441  },
      ],
      rds: [
        { type: 'db.t3.medium',    vcpu: 2,  ram: 4,   monthly: 115  },
        { type: 'db.m6g.large',    vcpu: 2,  ram: 8,   monthly: 245  },
        { type: 'db.m6g.xlarge',   vcpu: 4,  ram: 16,  monthly: 490  },
        { type: 'db.m6g.2xlarge',  vcpu: 8,  ram: 32,  monthly: 980  },
        { type: 'db.r6g.xlarge',   vcpu: 4,  ram: 32,  monthly: 588  },
      ],
    },
    azure: {
      general: [
        { type: 'B2ms',      vcpu: 2,  ram: 8,   monthly: 61   },
        { type: 'D2s_v5',   vcpu: 2,  ram: 8,   monthly: 70   },
        { type: 'D4s_v5',   vcpu: 4,  ram: 16,  monthly: 139  },
        { type: 'D8s_v5',   vcpu: 8,  ram: 32,  monthly: 278  },
        { type: 'D16s_v5',  vcpu: 16, ram: 64,  monthly: 555  },
        { type: 'D32s_v5',  vcpu: 32, ram: 128, monthly: 1109 },
      ],
      compute: [
        { type: 'F4s_v2',   vcpu: 4,  ram: 8,   monthly: 139  },
        { type: 'F8s_v2',   vcpu: 8,  ram: 16,  monthly: 278  },
        { type: 'F16s_v2',  vcpu: 16, ram: 32,  monthly: 555  },
      ],
      memory: [
        { type: 'E4s_v5',   vcpu: 4,  ram: 32,  monthly: 184  },
        { type: 'E8s_v5',   vcpu: 8,  ram: 64,  monthly: 369  },
        { type: 'E16s_v5',  vcpu: 16, ram: 128, monthly: 737  },
      ],
      rds: [
        { type: 'SQL GP 2vCore',   vcpu: 2,  ram: 10, monthly: 190  },
        { type: 'SQL GP 4vCore',   vcpu: 4,  ram: 21, monthly: 380  },
        { type: 'SQL GP 8vCore',   vcpu: 8,  ram: 41, monthly: 760  },
        { type: 'SQL GP 16vCore',  vcpu: 16, ram: 83, monthly: 1520 },
        { type: 'SQL BC 4vCore',   vcpu: 4,  ram: 21, monthly: 760  },
      ],
    },
    gcp: {
      general: [
        { type: 'e2-medium',       vcpu: 2,  ram: 4,   monthly: 28   },
        { type: 'n2-standard-2',   vcpu: 2,  ram: 8,   monthly: 80   },
        { type: 'n2-standard-4',   vcpu: 4,  ram: 16,  monthly: 161  },
        { type: 'n2-standard-8',   vcpu: 8,  ram: 32,  monthly: 322  },
        { type: 'n2-standard-16',  vcpu: 16, ram: 64,  monthly: 643  },
        { type: 'n2-standard-32',  vcpu: 32, ram: 128, monthly: 1286 },
      ],
      compute: [
        { type: 'c2-standard-4',   vcpu: 4,  ram: 16,  monthly: 165  },
        { type: 'c2-standard-8',   vcpu: 8,  ram: 32,  monthly: 330  },
        { type: 'c2-standard-16',  vcpu: 16, ram: 64,  monthly: 661  },
      ],
      memory: [
        { type: 'n2-highmem-4',    vcpu: 4,  ram: 32,  monthly: 206  },
        { type: 'n2-highmem-8',    vcpu: 8,  ram: 64,  monthly: 412  },
        { type: 'n2-highmem-16',   vcpu: 16, ram: 128, monthly: 824  },
      ],
      rds: [
        { type: 'db-n1-standard-1', vcpu: 1, ram: 3.75, monthly: 50  },
        { type: 'db-n1-standard-2', vcpu: 2, ram: 7.5,  monthly: 135 },
        { type: 'db-n1-standard-4', vcpu: 4, ram: 15,   monthly: 270 },
        { type: 'db-n1-standard-8', vcpu: 8, ram: 30,   monthly: 540 },
        { type: 'db-n1-highmem-4',  vcpu: 4, ram: 26,   monthly: 340 },
      ],
    },
  };

  const VM_RAM_TARGET = { small: 4, medium: 16, large: 32, enterprise: 64 };
  function _pickInstance(list, ramTarget) {
    return list.find(v => v.ram >= ramTarget) || list[list.length - 1];
  }

  // ── DR Tier Matrix (RTO/RPO → cost multiplier on compute+db) ─────────────
  const DR_MATRIX = {
    'none':   { label: 'No DR',           rto: 'N/A',   cost_pct: 0.00 },
    'rto24h': { label: 'Backup & Restore', rto: '24h',   cost_pct: 0.08 },
    'rto8h':  { label: 'Pilot Light',      rto: '8h',    cost_pct: 0.20 },
    'rto4h':  { label: 'Warm Standby',     rto: '4h',    cost_pct: 0.35 },
    'rto1h':  { label: 'Hot Standby',      rto: '1h',    cost_pct: 0.60 },
    'rto15m': { label: 'Active-Active',    rto: '15min', cost_pct: 1.00 },
  };

  // ── Storage Class ($/TB/month, tiered by access pattern) ─────────────────
  const STOR_CLASS = {
    aws:   { hot: 52, warm: 13, cool: 5,  archive: 1 },
    azure: { hot: 66, warm: 15, cool: 15, archive: 2 },
    gcp:   { hot: 55, warm: 10, cool: 4,  archive: 1 },
  };
  // Distribution by data classification (hot/warm/cool/archive)
  const STOR_DIST = {
    'public':             [0.20, 0.30, 0.30, 0.20],
    'internal':           [0.30, 0.35, 0.25, 0.10],
    'confidential':       [0.35, 0.35, 0.20, 0.10],
    'highly-confidential':[0.50, 0.30, 0.15, 0.05],
  };
  function _calcStorage(provider, classification, dataSize) {
    const tb   = { small: 2, medium: 10, large: 60, very_large: 250 }[dataSize] || 10;
    const c    = STOR_CLASS[provider] || STOR_CLASS.aws;
    const d    = STOR_DIST[classification] || STOR_DIST.confidential;
    return { tb, cost: Math.round(tb * (d[0]*c.hot + d[1]*c.warm + d[2]*c.cool + d[3]*c.archive)) };
  }

  // ── Tiered Egress Pricing ─────────────────────────────────────────────────
  const EGRESS_T = {
    aws:   [{ u: 10, r: 90 }, { u: 50,  r: 85 }, { u: 150, r: 70 }, { u: Infinity, r: 50 }],
    azure: [{ u: 10, r: 87 }, { u: 50,  r: 83 }, { u: 150, r: 67 }, { u: Infinity, r: 48 }],
    gcp:   [{ u: 10, r: 85 }, { u: 50,  r: 81 }, { u: 150, r: 60 }, { u: Infinity, r: 45 }],
  };
  function _calcEgress(tb, provider) {
    const tiers = EGRESS_T[provider] || EGRESS_T.aws;
    let cost = 0, rem = tb, prev = 0;
    for (const t of tiers) {
      if (rem <= 0) break;
      const slice = Math.min(rem, t.u - prev);
      cost += slice * t.r; rem -= slice; prev = t.u;
    }
    return Math.round(cost);
  }
  function _egressTB(inputs) {
    const gb = parseFloat(inputs.monthlyTrafficGB) || 0;
    if (gb > 0) return gb / 1000 * 0.45;
    const base = {
      small:      { low: 0.5, medium: 2,  high: 8,   very_high: 25  },
      medium:     { low: 2,   medium: 8,  high: 30,  very_high: 100 },
      large:      { low: 5,   medium: 20, high: 80,  very_high: 300 },
      enterprise: { low: 10,  medium: 50, high: 200, very_high: 800 },
    };
    return (base[inputs.companySize] || base.medium)[inputs.txVolume || 'medium'] || 8;
  }

  // ── Reserved / Committed-Use Discounts ───────────────────────────────────
  const DISC = {
    aws:   { one_yr: 0.37, three_yr: 0.57, spot: 0.70 },
    azure: { one_yr: 0.40, three_yr: 0.60, spot: 0.60 },
    gcp:   { one_yr: 0.37, three_yr: 0.60, spot: 0.60 },
  };

  /**
   * Always compute sustainability client-side from CARBON_DATA_CLIENT.
   * Called regardless of what the server returns.
   */
  function _computeSustainability(inputs, serverSustainability) {
    // If server already gave us good data, use it
    const s = serverSustainability;
    if (s && s.carbon_reduction_pct > 0 && s.recommended_region && !s.recommended_region.includes('string')) {
      return s;
    }

    // Compute from scratch
    const providerRaw = (inputs.targetCloud || inputs.target_cloud || 'AWS');
    const providerKey = providerRaw.toLowerCase().replace('-cloud','').replace('multi','aws');
    const provData    = CARBON_DATA_CLIENT[providerKey] || CARBON_DATA_CLIENT.aws;
    const serverCount = inputs.systemCount || inputs.system_count || 20;

    // Find lowest-carbon region
    const sorted = Object.entries(provData.regions).sort((a, b) => a[1].intensity - b[1].intensity);
    const [, lowestRegion] = sorted[0];

    const kwhPerYear   = serverCount * ANNUAL_KWH_PER_SERVER;
    const onpremCO2    = kwhPerYear * ONPREM_INTENSITY_CLIENT / 1e6;
    const cloudCO2     = kwhPerYear * lowestRegion.intensity   / 1e6;
    const reductionPct = Math.max(0, Math.round((onpremCO2 - cloudCO2) / onpremCO2 * 100));
    const reductionTon = Math.max(0, Math.round((onpremCO2 - cloudCO2) * 10) / 10);

    const esgMap = {
      tcfd: ['揭露氣候相關財務風險（TCFD框架）','建立情境分析（2°C / 4°C）','量化碳排基準數據（Scope 1/2/3）'],
      gri:  ['依 GRI 305-1/2/3 揭露溫室氣體排放','設定科學基礎目標（SBTi）','建立碳排監控 Dashboard'],
      sbti: ['提交 SBTi 承諾書','設定 1.5°C 對齊目標','建立年度減排路徑'],
      twse: ['依台灣 TWSE 永續報告書 GRI/SASB 規範揭露','建立董事會永續治理機制','量化 Scope 2 排放（市場基礎法）'],
    };
    const ef = (inputs.esgFramework || inputs.esg_framework || 'none').toLowerCase();

    return {
      carbon_reduction_pct:         reductionPct,
      annual_co2_reduction_tonnes:  reductionTon,
      recommended_region:           lowestRegion.name,
      recommended_region_intensity: lowestRegion.intensity,
      renewable_pct:                lowestRegion.renewable,
      rationale: `依台灣電網碳強度基準（${ONPREM_INTENSITY_CLIENT} gCO₂eq/kWh），遷移 ${serverCount} 台伺服器至 ${lowestRegion.name}（${lowestRegion.intensity} gCO₂eq/kWh，${lowestRegion.renewable}% 再生能源），預估每年減少碳排 ${reductionTon} 噸（降幅 ${reductionPct}%）。計算依據：${serverCount} 台 × ${ANNUAL_KWH_PER_SERVER.toLocaleString()} kWh/年 = ${Math.round(kwhPerYear/1000)} MWh/年。`,
      esg_guidance:      esgMap[ef] || ['建議選擇 GRI Standards 作為揭露框架','優先建立碳排基準數據（Scope 1/2）','評估加入 RE100 或 SBTi'],
      provider_commitment: provData.commitment,
      monitoring_tool:     provData.tool,
    };
  }

  /**
   * _computeFinOpsCost — Real FinOps TCO Engine v3
   * Uses: VM catalog lookup, DR tier matrix, storage class tiers, tiered egress pricing
   * All inputs from the form are wired through — no flat buckets.
   */
  function _computeFinOpsCost(inputs, serverCost) {
    // If server already sent verified numbers, pass them through
    const recM = serverCost?.scenarios?.recommended?.monthly_usd;
    if (recM && recM > 0) return serverCost;

    const provider = (inputs.targetCloud || 'AWS').toLowerCase().split('-')[0];
    const cat  = VM_CAT[provider] || VM_CAT.aws;
    const disc = DISC[provider]   || DISC.aws;
    const tier = inputs.companySize || 'medium';
    const n    = Math.max(1, parseInt(inputs.systemCount) || 20);

    // ── Workload profile → instance series ───────────────────────────────
    let profile = 'general';
    if (/media|gaming|batch|hpc/i.test(inputs.industry || '') ||
        inputs.migrationDriver === 'performance') profile = 'compute';
    if (inputs.dataClassification === 'highly-confidential' ||
        /financ|banking/i.test(inputs.industry || ''))       profile = 'memory';

    // ── VM instance: smallest that meets RAM target ───────────────────────
    const vmSpec = _pickInstance(cat[profile] || cat.general, VM_RAM_TARGET[tier] || 16);
    // txVolume drives how many VMs are actually busy (scale-out factor)
    const txMult = { low: 0.6, medium: 1.0, high: 1.7, very_high: 2.8 }[inputs.txVolume] || 1.0;
    const totalCompute = Math.round(vmSpec.monthly * n * txMult);

    // ── Database: per-instance price × count ─────────────────────────────
    const dbCount = { small: 1, medium: 2, large: 4, enterprise: 8 }[tier] || 2;
    const dbSpec  = _pickInstance(cat.rds, VM_RAM_TARGET[tier] || 16);
    const totalDB = Math.round(dbSpec.monthly * dbCount);

    // ── Storage: tiered by access pattern + classification ────────────────
    const stor = _calcStorage(provider, inputs.dataClassification || 'confidential', inputs.dataSize || 'medium');
    const totalStorage = stor.cost;

    // ── Network: tiered egress pricing (not flat $/TB) ────────────────────
    const egressTB   = _egressTB(inputs);
    const totalNetwork = _calcEgress(egressTB, provider);

    // ── DR: matrix lookup, not binary ─────────────────────────────────────
    const drTier = DR_MATRIX[inputs.drRequirements] || DR_MATRIX['rto4h'];
    const drCost = Math.round((totalCompute + totalDB) * drTier.cost_pct);

    // ── Compliance & security ─────────────────────────────────────────────
    const compMult = { low: 1.00, medium: 1.18, high: 1.55 }[inputs.complianceLevel] || 1.18;
    const secBase  = { small: 150, medium: 420, large: 1200, enterprise: 3000 }[tier] || 420;
    const hasFin   = inputs.hasFinancialData === 'yes' || inputs.dataClassification === 'highly-confidential';
    const totalSec = Math.round(secBase * compMult + (inputs.hasPersonalData === 'yes' ? 220 : 0) + (hasFin ? 550 : 0));

    // ── Managed services ─────────────────────────────────────────────────
    const managed = { small: 180, medium: 580, large: 1500, enterprise: 3400 }[tier] || 580;

    // ── Multi-environment ─────────────────────────────────────────────────
    const envCount = Math.max(1, parseInt(inputs.envCount) || 2);
    const envMult  = envCount >= 4 ? 1.30 : envCount >= 3 ? 1.15 : 1.00;

    // ── On-demand total ───────────────────────────────────────────────────
    const suppPct  = tier === 'enterprise' ? 0.15 : 0.10;
    const base     = (totalCompute + totalDB + totalStorage + totalNetwork + totalSec + drCost + managed) * envMult;
    const support  = Math.round(base * suppPct);
    const onDemand = Math.round(base + support);

    // ── IBM FinOps 3 scenarios ────────────────────────────────────────────
    const conservative_m = Math.round(onDemand * 1.20);

    const recommended_m  = Math.round((
      totalCompute * 0.6 * (1 - disc.one_yr)   + totalCompute * 0.4 +
      totalDB      * 0.7 * (1 - disc.one_yr)   + totalDB      * 0.3 +
      totalStorage + totalNetwork + totalSec + drCost + managed + support
    ) * envMult);

    const aggressive_m   = Math.round((
      totalCompute * 0.8 * (1 - disc.three_yr) + totalCompute * 0.2 * (1 - disc.spot) +
      totalDB      * 0.8 * (1 - disc.three_yr) +
      totalStorage * 0.70 + totalNetwork * 0.80 +
      totalSec + drCost * 0.60 + managed * 0.90 + support * 0.80
    ) * envMult);

    // ── Migration cost (team × hours × APAC rates) ────────────────────────
    const compFactor = compMult * (drTier.cost_pct > 0.3 ? 1.35 : 1.0) * (hasFin ? 1.25 : 1.0);
    const baseHours  = { small: 320, medium: 1000, large: 3200, enterprise: 7500 }[tier] || 1000;
    const migCost    = Math.round(baseHours * 175 * compFactor / 100) * 100;

    const saving3yr  = (onDemand * 1.8 - recommended_m) * 36 - migCost;
    const payback    = Math.max(1, Math.round(migCost / Math.max(1, onDemand * 1.8 - recommended_m)));
    const cloud      = inputs.targetCloud || 'AWS';

    return {
      scenarios: {
        conservative: {
          monthly_usd: conservative_m, annual_usd: conservative_m * 12,
          description: `On-Demand 定價 + 20% 容量緩衝（${cloud} ${vmSpec.type}, ${n} servers）`,
        },
        recommended: {
          monthly_usd: recommended_m,  annual_usd: recommended_m  * 12,
          description: `60% Reserved 1年期 + 右側配置（IBM FinOps 建議）`,
        },
        aggressive: {
          monthly_usd: aggressive_m,   annual_usd: aggressive_m   * 12,
          description: `80% Reserved 3年期 + Spot/Preemptible + PaaS 整合`,
        },
      },
      migration_cost_usd: migCost,
      roi_3yr:       saving3yr > 0 ? `3年節省 USD $${Math.round(saving3yr).toLocaleString()}` : '3年達損益平衡',
      payback_months: payback,
      cost_drivers: [
        `${cloud} ${vmSpec.type} (${vmSpec.vcpu}vCPU/${vmSpec.ram}GB) × ${n} servers × ${txMult}x: $${totalCompute}/月`,
        `資料庫 ${dbSpec.type} × ${dbCount}: $${totalDB}/月`,
        `儲存 ${stor.tb}TB（分層：hot/warm/cool/archive）: $${totalStorage}/月`,
        `網路出口 ${Math.round(egressTB * 10) / 10}TB（分級計價）: $${totalNetwork}/月`,
        `安全合規（${inputs.complianceLevel || 'medium'} 等級${hasFin ? '，金融資料' : ''}）: $${totalSec}/月`,
        `DR 備援: ${drTier.label} (RTO ${drTier.rto}, +${Math.round(drTier.cost_pct * 100)}%): $${drCost}/月`,
        ...(envCount >= 3 ? [`多環境 ${envCount} 套 × ${envMult}: +${Math.round((envMult - 1) * 100)}%`] : []),
      ],
    };
  }

  /**
   * Normalise the Claude API JSON result to match the shape expected by analyze.html
   * (which was built for the local engine's output format).
   *
   * Maps the clean API schema → local engine format so renderResult() needs no changes.
   */
  function _normaliseAPIResult(apiResult, inputs) {
    const r    = apiResult;
    const strat = r.strategy        || {};
    const lz    = r.landing_zone    || {};
    const cost  = r.cost            || {};
    const risk  = r.risk            || {};
    const exec  = r.executive_summary || {};
    const tech  = r.technical_roadmap || {};
    const reg   = r.regulatory_guidance || {};
    const next  = r.next_steps      || [];
    const meta  = r.meta            || {};

    const dims  = risk.dimensions   || {};
    const compRisk  = dims.compliance?.score   || 35;
    const techRisk  = dims.technology?.score   || 40;
    const opRisk    = dims.operational?.score  || 40;
    const tlRisk    = dims.timeline?.score     || 45;
    const dataRisk  = dims.data?.score         || 35;
    const bizRisk   = dims.business?.score     || 30;
    const overall   = risk.overall_score || Math.round((compRisk+techRisk+opRisk+tlRisk+dataRisk+bizRisk)/6);

    const scores = strat.scores || { rehost:20, replatform:30, refactor:20, retain:15, retire:5 };
    const sortedEntries = Object.entries(scores).sort((a,b)=>b[1]-a[1]);
    const primary   = strat.primary   || sortedEntries[0]?.[0] || 'replatform';
    const secondary = strat.secondary || sortedEntries[1]?.[0] || 'rehost';
    const confidence = Math.min(95, Math.max(40, scores[primary] ? 40 + scores[primary]*2 : 65));

    // Strategy 6R
    const strategy6R = {
      primary, secondary,
      scores,
      confidence,
      sorted: sortedEntries,
      rationale: strat.rationale || '',
      frameworks: strat.frameworks_applied || [],
    };

    // Landing Zone — map API accounts to local format
    const ACCOUNT_ICONS = {
      core: '🏛️', management: '🏛️', security: '🛡️',
      log: '📋', network: '🌐', service: '⚙️',
      workload: '🚀', dr: '☁️', compliance: '🔍',
      data: '📊', sandbox: '🔬', dev: '🔬', staging: '🧪', prod: '🚀',
    };
    const accounts = (lz.accounts || []).map(acc => ({
      name: acc.name,
      type: acc.type || 'workload',
      desc: acc.purpose || acc.description || '',
      icon: ACCOUNT_ICONS[acc.type] || ACCOUNT_ICONS[acc.name?.toLowerCase().split(' ')[0]] || '📦',
      scps: acc.scps || [],
    }));

    // If no accounts from API, generate standard set for the tier
    if (!accounts.length) {
      const tier = lz.tier || 'standard';
      accounts.push({ name: 'Management Account', type: 'core', desc: '根帳號，僅供治理與計費', icon: '🏛️', scps: [] });
      accounts.push({ name: 'Security Account', type: 'security', desc: '集中安全掃描、GuardDuty、Security Hub', icon: '🛡️', scps: [] });
      accounts.push({ name: 'Log Archive Account', type: 'security', desc: 'CloudTrail、Config 集中保存', icon: '📋', scps: [] });
      accounts.push({ name: 'Network Account', type: 'network', desc: 'Transit Gateway、共用 VPC', icon: '🌐', scps: [] });
      if (tier !== 'basic') {
        accounts.push({ name: 'Shared Services Account', type: 'service', desc: 'CI/CD、共用工具', icon: '⚙️', scps: [] });
        accounts.push({ name: 'Production Account', type: 'workload', desc: '正式環境，最小授權原則', icon: '🚀', scps: [] });
        accounts.push({ name: 'Sandbox / Dev Account', type: 'workload', desc: '開發測試環境', icon: '🔬', scps: [] });
      }
      if (tier === 'financial') {
        accounts.push({ name: 'DR Account', type: 'dr', desc: '異地備援、跨區域複寫', icon: '☁️', scps: [] });
        accounts.push({ name: 'Audit / Compliance Account', type: 'compliance', desc: '稽核存取、合規報告', icon: '🔍', scps: [] });
      }
    }

    // Guardrails — map string array → {name, status, risk} objects
    const rawGuardrails = lz.guardrails || [];
    const CRITICAL_KW = ['mfa', 'root', 's3 block', 'cloudtrail', 'fsbp', 'guardduty'];
    const guardrails = rawGuardrails.map(g => {
      const str = typeof g === 'string' ? g : g.name || '';
      const lower = str.toLowerCase();
      const riskLevel = CRITICAL_KW.some(k => lower.includes(k)) ? 'critical' : 'high';
      return typeof g === 'object' ? g : { name: str, status: 'required', risk: riskLevel };
    });

    // Maturity stage for the Landing Zone
    const tierMeta = {
      basic:     { name: '基礎治理模型', desc: '適合 1–2 個小型團隊，快速建立基線' },
      standard:  { name: '標準多帳號模型', desc: '適合 3–10 個工程團隊，完整環境隔離' },
      financial: { name: '金融級合規模型', desc: '高度合規要求，符合 MAS/HKMA/FCA 監管框架' },
    };
    const landingZone = {
      tier: lz.tier || 'standard',
      accounts,
      guardrails,
      maturityStage: tierMeta[lz.tier] || tierMeta.standard,
      scpSummary:    lz.compliance_controls?.join('、') || lz.identity || '',
    };

    // Cost — always use FinOps client computation as authoritative fallback
    const computedCost = _computeFinOpsCost(inputs, cost);
    const computedScenarios = computedCost.scenarios || {};
    const recCost  = computedScenarios.recommended  || {};
    const consCost = computedScenarios.conservative || {};
    const aggCost  = computedScenarios.aggressive   || {};
    const mid  = recCost.monthly_usd  || 5000;
    const low  = consCost.monthly_usd || Math.round(mid * 0.7);
    const high = aggCost.monthly_usd  || Math.round(mid * 1.4);
    const migBase = computedCost.migration_cost_usd || mid * 3;
    const costEstimate = {
      low, mid, high,
      annualLow:    low  * 12,
      annualHigh:   high * 12,
      annual:       mid  * 12,
      migrationLow:  Math.round(migBase * 0.8),
      migrationHigh: Math.round(migBase * 1.3),
      drivers: (computedCost.cost_drivers || cost.cost_drivers || ['Compute', 'Storage', 'Network']).map(d =>
        typeof d === 'string' ? { name: d, pct: 30 } : d),
      roi3yr:      computedCost.roi_3yr || cost.roi_3yr || '',
      paybackMths: computedCost.payback_months || cost.payback_months || 18,
      scenarios:   computedScenarios,
    };

    // Risk Radar
    const mitigations = [];
    if (dims.compliance?.mitigations?.length)  mitigations.push(...dims.compliance.mitigations.slice(0,2));
    if (dims.technology?.mitigations?.length)  mitigations.push(...dims.technology.mitigations.slice(0,1));
    if (dims.operational?.mitigations?.length) mitigations.push(...dims.operational.mitigations.slice(0,1));
    if (risk.key_risks?.length)                mitigations.push(...risk.key_risks.slice(0,2));
    if (!mitigations.length) mitigations.push('依建議策略逐步推進，定期進行 Well-Architected Review');
    const riskRadar = {
      compRisk, techRisk, opRisk,
      timelineRisk: tlRisk, dataRisk, bizRisk,
      overall, mitigations,
      dimensions: dims,
    };

    // KPI
    const readiness = exec.readiness_score || 65;
    const kpi = {
      compliance:  Math.min(98, Math.max(10, 100 - compRisk)),
      lzReadiness: Math.min(98, Math.max(10, readiness)),
      techDebt:    Math.min(98, Math.max(10, 100 - techRisk)),
      roi:         Math.min(98, Math.max(10, readiness + 5)),
      timeline:    Math.min(98, Math.max(10, 100 - tlRisk)),
    };

    // Executive Summary
    const stratName = { rehost:'直接遷移 (Rehost)', replatform:'平台調整 (Replatform)', refactor:'架構重構 (Refactor)', retain:'暫緩保留 (Retain)', retire:'下線退場 (Retire)', repurchase:'替換採購 (Repurchase)' };
    const executiveSummary = {
      title:         exec.headline || `${inputs.projectName || '本專案'} 雲端轉型評估報告`,
      strategyTitle: `建議採行策略：${stratName[primary] || primary}`,
      conclusion:    [
        exec.headline || '',
        exec.investment_summary || '',
        exec.roi_statement || '',
      ].filter(Boolean).join(' ') || `建議採行 ${stratName[primary] || primary}，整體雲端就緒分數 ${readiness}%。`,
      timing:        exec.recommended_timeline_quarters
        ? `建議時程：${exec.recommended_timeline_quarters} 個季度（約 ${exec.recommended_timeline_quarters * 3} 個月）`
        : '建議 3–6 個月完成基礎建置',
      riskLevel:     overall >= 70 ? '高度' : overall >= 50 ? '中等' : '相對可控',
      prerequisites: (exec.board_risks || []).map(br => br.mitigation || br.risk).slice(0, 5),
      outcomes:      exec.business_outcomes || [],
      regulatory:    reg.applicable_frameworks || [],
    };

    // Presentation slides — from tech phases
    const phases = tech.phases || [];
    const presentation = phases.length > 0
      ? phases.map((ph, i) => ({
          slide: i + 1,
          title: ph.name || `Phase ${i+1}`,
          points: [
            ...(ph.objectives || []).slice(0, 3),
            ...(ph.milestones || []).slice(0, 2),
          ],
          duration: ph.duration_weeks ? `${ph.duration_weeks} 週` : '',
          owners:   ph.owners || [],
        }))
      : [
          { slide: 1, title: '現況評估與業務痛點', points: ['系統現況盤點','業務需求分析','合規差距評估'] },
          { slide: 2, title: '雲端策略建議', points: [`主要策略：${stratName[primary]}`, `信心指數：${confidence}%`, strat.rationale || ''] },
          { slide: 3, title: 'Landing Zone 架構', points: [`${landingZone.tier} 治理模型`, `${accounts.length} 個帳號結構`, '安全基線 Guardrails'] },
          { slide: 4, title: '成本與風險', points: [`月成本：USD $${mid.toLocaleString()}`, `整體風險：${overall}%`, `ROI：${cost.roi_3yr || '正向'}`] },
          { slide: 5, title: '執行藍圖', points: (next.slice(0,5) || []).map(n => n.action || '') },
        ];

    // Tech PM
    const techPM = {
      phases: phases.map(ph => ({
        name:       ph.name,
        duration:   ph.duration_weeks ? `${ph.duration_weeks} 週` : '4 週',
        objectives: ph.objectives || [],
        milestones: ph.milestones || [],
        owners:     ph.owners || [],
      })),
      poc: tech.poc ? {
        scope:            tech.poc.scope || '',
        successCriteria:  tech.poc.success_criteria || [],
        duration:         `${tech.poc.duration_weeks || 4} 週`,
        workloads:        tech.poc.workloads || [],
      } : null,
      kpis: (tech.kpis || []).map(k => ({
        name:     k.metric,
        baseline: k.baseline,
        target:   k.target,
        cadence:  k.cadence,
      })),
      collaborators: (phases[0]?.owners || ['Cloud Architect', 'DevOps Lead', 'Security Lead', 'Compliance Officer']).map(o => ({ role: o })),
      dependencies: tech.critical_dependencies || [],
    };

    // Next Steps
    const nextSteps = next.map((n, i) => ({
      priority: n.priority || i + 1,
      action:   n.action   || '',
      owner:    n.owner    || '',
      timeline: n.timeline || '',
      effort:   n.effort   || 'medium',
    }));

    // Decisions
    const decisions = (exec.board_risks || []).map((br, i) => ({
      id: i + 1,
      question: br.risk || '',
      recommendation: br.mitigation || '',
      impact: 'high',
    }));

    return {
      id:        `api_${Date.now()}`,
      timestamp: new Date().toISOString(),
      source:    'claude-api',
      model:     meta.analysis_version || 'claude-opus-4-6',
      inputs,

      strategy6R,
      landingZone,
      costEstimate,
      riskRadar,
      kpi,
      executiveSummary,
      presentation,
      techPM,
      nextSteps,
      decisions,
      sustainability: _computeSustainability(inputs, r.sustainability),  // always computed, never blank

      // Extra API-only data available for enhanced rendering
      _api: {
        regulatory:  reg,
        meta,
        scenarios:   cost.scenarios || {},
        frameworks:  strat.frameworks_applied || [],
      },
    };
  }

  // ── Trends ─────────────────────────────────────────────────────────────────
  /**
   * Fetch curated international cloud trends.
   * @param {string} [category] - 'regulatory' | 'cloud' | 'financial' | 'emerging' | 'all'
   * @param {object} [filters]  - { region, impact }
   */
  async function getTrends(category = 'all', filters = {}) {
    if (!isAPIAvailable()) {
      // Return empty in file:// context
      return { items: [], version: 'local', count: 0 };
    }

    const params = new URLSearchParams({ category });
    if (filters.region) params.set('region', filters.region);
    if (filters.impact) params.set('impact', filters.impact);

    try {
      const res = await fetchWithTimeout(`${API_BASE}/trends?${params}`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
      }, 15_000);

      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.json();
    } catch (err) {
      console.warn('[APIClient] Trends fetch failed:', err.message);
      return { items: [], version: 'offline', count: 0, error: err.message };
    }
  }

  // ── Health Check ───────────────────────────────────────────────────────────
  async function healthCheck() {
    if (!isAPIAvailable()) return { available: false, reason: 'file:// protocol' };
    try {
      const res = await fetchWithTimeout(`${API_BASE}/trends?category=cloud`, {}, 5_000);
      return { available: res.ok, status: res.status };
    } catch {
      return { available: false, reason: 'network error' };
    }
  }

  // ── Public API ─────────────────────────────────────────────────────────────
  const APIClient = {
    analyze,
    getTrends,
    healthCheck,
    isAPIAvailable,
    SESSION_ID,
  };

  // Attach to global namespace
  global.APIClient = APIClient;

})(typeof window !== 'undefined' ? window : globalThis);
