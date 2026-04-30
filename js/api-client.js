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

    // If API returned a structured result, use it
    if (data.result) {
      return _normaliseAPIResult(data.result, inputs);
    }

    // Raw text fallback — shouldn't happen but handle gracefully
    throw new Error('Unexpected response format from API');
  }

  async function _analyzeLocal(inputs, onProgress) {
    onProgress({ stage: 'local', message: '⚙️ 本地分析引擎啟動中…' });

    // Dynamic import — AnalyzeEngine must be loaded in the page
    if (typeof AnalyzeEngine === 'undefined') {
      throw new Error('AnalyzeEngine not loaded. Please include analyze-engine.js');
    }
    return await AnalyzeEngine.analyze(inputs);
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

    // Cost — map API scenarios to local format
    const recCost  = cost.scenarios?.recommended || {};
    const consCost = cost.scenarios?.conservative || {};
    const aggCost  = cost.scenarios?.aggressive   || {};
    const mid      = recCost.monthly_usd   != null && recCost.monthly_usd   > 0 ? recCost.monthly_usd   : 5000;
    const low      = consCost.monthly_usd  != null && consCost.monthly_usd  > 0 ? consCost.monthly_usd  : Math.round(mid * 0.7);
    const high     = aggCost.monthly_usd   != null && aggCost.monthly_usd   > 0 ? aggCost.monthly_usd   : Math.round(mid * 1.4);
    const migBase  = cost.migration_cost_usd > 0 ? cost.migration_cost_usd : mid * 3;
    const costEstimate = {
      low, mid, high,
      annualLow:    low  * 12,
      annualHigh:   high * 12,
      annual:       mid  * 12,
      migrationLow:  Math.round(migBase * 0.8),
      migrationHigh: Math.round(migBase * 1.3),
      drivers: (cost.cost_drivers || ['Compute', 'Storage', 'Network']).map(d =>
        typeof d === 'string' ? { name: d, pct: 30 } : d),
      roi3yr:      cost.roi_3yr || '',
      paybackMths: cost.payback_months || 18,
      scenarios:   cost.scenarios || {},
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
      sustainability: r.sustainability || null,  // ← was missing, causing blank section

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
