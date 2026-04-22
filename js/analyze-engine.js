/* ============================================================
   CloudFrame — AI Analysis Engine
   Version 1.0
   Rule-based analysis engine with consultant-grade logic.
   Designed to be replaced/augmented by real LLM API calls.
   ============================================================ */

'use strict';

const AnalyzeEngine = (() => {

  // ── 6R Strategy Determination ─────────────────────────────
  function determine6R(inputs) {
    const scores = { rehost: 0, replatform: 0, refactor: 0, retain: 0, retire: 0 };

    const age = parseInt(inputs.systemAge) || 5;
    const isCoreSystem    = inputs.isCoreSystem === 'yes';
    const archType        = inputs.archType || 'monolith';
    const techDebt        = inputs.techDebt || 'medium';
    const cloudMaturity   = inputs.cloudMaturity || 'low';
    const complianceLevel = inputs.complianceLevel || 'medium';
    const timeline        = inputs.timeline || 'medium';
    const budget          = inputs.budget || 'medium';
    const hasPersonalData = inputs.hasPersonalData === 'yes';
    const hasFinancialData = inputs.hasFinancialData === 'yes';
    const isVirtualized   = inputs.isVirtualized === 'yes';
    const downtimeTolerance = inputs.downtimeTolerance || 'medium';
    const cloudGoal       = inputs.cloudGoal || 'cost';
    const hasLandingZone  = inputs.hasLandingZone === 'yes';

    // ── Age scoring ──
    if (age > 15)      { scores.retain += 3; scores.rehost += 1; }
    else if (age > 10) { scores.rehost += 2; scores.retain += 1; }
    else if (age > 5)  { scores.replatform += 2; scores.rehost += 1; }
    else               { scores.refactor += 3; scores.replatform += 1; }

    // ── Architecture type ──
    if (archType === 'monolith')     { scores.rehost += 2; scores.retain += 1; }
    if (archType === 'threelayer')   { scores.replatform += 2; scores.rehost += 1; }
    if (archType === 'api')          { scores.replatform += 2; scores.refactor += 2; }
    if (archType === 'microservices'){ scores.refactor += 3; scores.replatform += 1; }

    // ── Technical debt ──
    if (techDebt === 'high')   { scores.retain += 2; scores.refactor += 2; scores.rehost -= 1; }
    if (techDebt === 'medium') { scores.replatform += 2; scores.rehost += 1; }
    if (techDebt === 'low')    { scores.rehost += 2; scores.replatform += 1; }

    // ── Cloud maturity ──
    if (cloudMaturity === 'low')    { scores.rehost += 2; scores.retain += 2; }
    if (cloudMaturity === 'medium') { scores.replatform += 2; scores.rehost += 1; }
    if (cloudMaturity === 'high')   { scores.refactor += 3; scores.replatform += 2; }

    // ── Compliance ──
    if (complianceLevel === 'high') {
      scores.retain += 3; scores.rehost += 1;
      if (!hasLandingZone) scores.retain += 2;
    }
    if (complianceLevel === 'medium') { scores.rehost += 1; scores.replatform += 1; }
    if (complianceLevel === 'low')    { scores.refactor += 1; }

    // ── Timeline ──
    if (timeline === 'urgent')   { scores.rehost += 3; scores.retain -= 1; }
    if (timeline === 'medium')   { scores.replatform += 1; }
    if (timeline === 'flexible') { scores.refactor += 2; scores.replatform += 1; }

    // ── Budget ──
    if (budget === 'tight')  { scores.rehost += 2; scores.retain += 1; scores.refactor -= 2; }
    if (budget === 'medium') { scores.replatform += 1; }
    if (budget === 'ample')  { scores.refactor += 2; scores.replatform += 1; }

    // ── Sensitive data ──
    if (hasPersonalData || hasFinancialData) { scores.retain += 1; scores.rehost += 1; }

    // ── Core system ──
    if (isCoreSystem) { scores.retain += 2; scores.rehost += 1; scores.refactor -= 1; }

    // ── Virtualized ──
    if (isVirtualized) { scores.rehost += 2; }

    // ── Cloud goal ──
    if (cloudGoal === 'cost')     { scores.rehost += 1; }
    if (cloudGoal === 'speed')    { scores.replatform += 2; scores.refactor += 1; }
    if (cloudGoal === 'api')      { scores.refactor += 3; scores.replatform += 1; }
    if (cloudGoal === 'elastic')  { scores.replatform += 2; scores.refactor += 2; }
    if (cloudGoal === 'ai')       { scores.refactor += 3; scores.replatform += 1; }
    if (cloudGoal === 'compliance'){ scores.rehost += 2; scores.retain += 1; }

    // ── Downtime tolerance ──
    if (downtimeTolerance === 'none')    { scores.retain += 2; scores.rehost += 1; }
    if (downtimeTolerance === 'low')     { scores.rehost += 1; }
    if (downtimeTolerance === 'high')    { scores.refactor += 1; }

    // Normalize (min 0)
    Object.keys(scores).forEach(k => { if (scores[k] < 0) scores[k] = 0; });

    const sorted = Object.entries(scores).sort((a, b) => b[1] - a[1]);
    const primary = sorted[0][0];
    const secondary = sorted[1][0];
    const confidence = Math.min(95, 40 + (sorted[0][1] - sorted[1][1]) * 5);

    // ── 產生決策依據說明 ────────────────────────────────────────
    const reasons = [];
    const archLabels = { monolith:'單體式架構', threelayer:'三層式架構', api:'API化架構', microservices:'微服務架構' };
    const goalLabels = { cost:'降低成本', speed:'提升交付速度', api:'API化轉型', elastic:'彈性擴展', ai:'AI應用落地', compliance:'法規合規' };

    // 系統年齡
    if (age > 15)      reasons.push({ icon:'📅', factor:'系統年齡', detail:`系統已 ${age} 年，高度耦合，建議暫緩遷移（Retain 加分）` });
    else if (age > 10) reasons.push({ icon:'📅', factor:'系統年齡', detail:`系統 ${age} 年，直接遷移風險相對可控（Rehost 加分）` });
    else if (age > 5)  reasons.push({ icon:'📅', factor:'系統年齡', detail:`系統 ${age} 年，適合平台升級同步現代化（Replatform 加分）` });
    else               reasons.push({ icon:'📅', factor:'系統年齡', detail:`系統僅 ${age} 年，架構新，具備重構條件（Refactor 加分）` });

    // 架構類型
    const archLabel = archLabels[archType] || archType;
    if (archType === 'monolith')      reasons.push({ icon:'🏗️', factor:'架構類型', detail:`${archLabel}：模組耦合高，直接遷移最穩健（Rehost 加分）` });
    if (archType === 'threelayer')    reasons.push({ icon:'🏗️', factor:'架構類型', detail:`${archLabel}：可逐層替換托管服務，適合平台調整（Replatform 加分）` });
    if (archType === 'api')           reasons.push({ icon:'🏗️', factor:'架構類型', detail:`${archLabel}：已具備解耦基礎，重構或Replatform皆可行` });
    if (archType === 'microservices') reasons.push({ icon:'🏗️', factor:'架構類型', detail:`${archLabel}：容器化部署就緒，建議直接重構上雲（Refactor 加分）` });

    // 技術債
    if (techDebt === 'high')   reasons.push({ icon:'⚠️', factor:'技術債', detail:'技術債高：重構風險大，暫緩或直接遷移更安全（Retain/Refactor 加分）' });
    if (techDebt === 'medium') reasons.push({ icon:'⚠️', factor:'技術債', detail:'技術債中等：適合邊遷移邊改善（Replatform 加分）' });
    if (techDebt === 'low')    reasons.push({ icon:'✅', factor:'技術債', detail:'技術債低：系統健康，直接遷移風險小（Rehost 加分）' });

    // 合規
    if (complianceLevel === 'high')   reasons.push({ icon:'🛡️', factor:'合規等級', detail:'高度法遵（金融/醫療）：需先建 Landing Zone 再遷移，貿然行動風險高（Retain 加分）' });
    if (complianceLevel === 'medium') reasons.push({ icon:'🛡️', factor:'合規等級', detail:'中等合規：需基本 IAM 與稽核設定，Rehost/Replatform 皆可支援' });
    if (complianceLevel === 'low')    reasons.push({ icon:'🛡️', factor:'合規等級', detail:'一般合規：無重大法規限制，可採較激進策略（Refactor 加分）' });

    // 時程
    if (timeline === 'urgent')   reasons.push({ icon:'⏰', factor:'時程壓力', detail:'緊急（<6個月）：時間不足做重構，直接遷移為優先（Rehost 加分）' });
    if (timeline === 'medium')   reasons.push({ icon:'⏰', factor:'時程壓力', detail:'中期（6-12個月）：時間足夠做平台調整與部分優化' });
    if (timeline === 'flexible') reasons.push({ icon:'⏰', factor:'時程壓力', detail:'彈性時程（12個月+）：有空間做完整重構（Refactor 加分）' });

    // 預算
    if (budget === 'tight')  reasons.push({ icon:'💰', factor:'預算條件', detail:'預算有限：避免高成本重構，直接遷移 CP 值最高（Rehost 加分）' });
    if (budget === 'medium') reasons.push({ icon:'💰', factor:'預算條件', detail:'合理預算：支持 Replatform 所需的托管服務費用' });
    if (budget === 'ample')  reasons.push({ icon:'💰', factor:'預算條件', detail:'充足預算：有條件做完整現代化重構（Refactor 加分）' });

    // 上雲目標
    const goalLabel = goalLabels[cloudGoal] || cloudGoal;
    if (cloudGoal === 'cost')       reasons.push({ icon:'🎯', factor:'上雲目標', detail:`目標：${goalLabel} — 直接遷移快速見效（Rehost 加分）` });
    if (cloudGoal === 'speed')      reasons.push({ icon:'🎯', factor:'上雲目標', detail:`目標：${goalLabel} — 平台托管服務加速交付（Replatform 加分）` });
    if (cloudGoal === 'api')        reasons.push({ icon:'🎯', factor:'上雲目標', detail:`目標：${goalLabel} — 需要架構拆解與API閘道（Refactor 強加分）` });
    if (cloudGoal === 'elastic')    reasons.push({ icon:'🎯', factor:'上雲目標', detail:`目標：${goalLabel} — 需容器化或無服務器支援（Replatform/Refactor 加分）` });
    if (cloudGoal === 'ai')         reasons.push({ icon:'🎯', factor:'上雲目標', detail:`目標：${goalLabel} — 需現代化架構對接 ML Pipeline（Refactor 強加分）` });
    if (cloudGoal === 'compliance') reasons.push({ icon:'🎯', factor:'上雲目標', detail:`目標：${goalLabel} — 穩健遷移優先，不冒重構風險（Rehost 加分）` });

    // 核心系統
    if (isCoreSystem) reasons.push({ icon:'💎', factor:'核心系統', detail:'核心系統：停機成本高，遷移策略需保守，避免激進重構（Retain/Rehost 加分）' });

    // 虛擬化
    if (isVirtualized) reasons.push({ icon:'📦', factor:'已虛擬化', detail:'已虛擬化：VM 可直接 Lift & Shift，降低 Rehost 風險（Rehost 加分）' });

    // 為什麼不選其他策略
    const rejected = [];
    const stratNames = { rehost:'直接遷移(Rehost)', replatform:'平台調整(Replatform)', refactor:'架構重構(Refactor)', retain:'暫緩保留(Retain)', retire:'下線退場(Retire)' };
    sorted.slice(1, 4).forEach(([s, score]) => {
      if (score < sorted[0][1] - 2) {
        const gap = sorted[0][1] - score;
        rejected.push(`${stratNames[s]}：綜合得分低 ${gap} 分`);
      }
    });

    return { primary, secondary, scores, confidence, sorted, reasons, rejected };
  }

  // ── Landing Zone Recommendation ───────────────────────────
  function determineLandingZone(inputs) {
    const compliance    = inputs.complianceLevel || 'medium';
    const multiAccount  = inputs.hasMultiAccount === 'yes';
    const hasLZ         = inputs.hasLandingZone === 'yes';
    const hasIAM        = inputs.hasIAM === 'yes';
    const cloudMaturity = inputs.cloudMaturity || 'low';
    const outsource     = inputs.isMajorOutsource === 'yes';
    const hasDR         = inputs.needDR === 'yes';
    const envCount      = parseInt(inputs.envCount) || 2;

    let tier = 'basic';
    if (compliance === 'high' || outsource || multiAccount) tier = 'financial';
    else if (compliance === 'medium' || cloudMaturity === 'medium' || envCount > 2) tier = 'standard';

    const accounts = [];

    // Management Account (always)
    accounts.push({ name: 'Management Account', type: 'core', desc: '根帳號，僅供治理與計費，不部署工作負載', icon: '🏛️' });
    // Security Account (always)
    accounts.push({ name: 'Security Account', type: 'security', desc: '集中安全掃描、GuardDuty、Security Hub', icon: '🛡️' });
    // Log Archive (always)
    accounts.push({ name: 'Log Archive Account', type: 'security', desc: 'CloudTrail、Config、VPC Flow Logs 集中保存', icon: '📋' });
    // Network Account
    accounts.push({ name: 'Network Account', type: 'network', desc: 'Transit Gateway、Direct Connect、共用 VPC', icon: '🌐' });

    if (tier === 'standard' || tier === 'financial') {
      accounts.push({ name: 'Shared Services Account', type: 'service', desc: 'CI/CD Pipeline、ECR、Artifact、共用工具', icon: '⚙️' });
    }
    if (envCount >= 3 || tier === 'financial') {
      accounts.push({ name: 'Sandbox / Dev Account', type: 'workload', desc: '開發測試環境，限制資源配額，獨立爆炸半徑', icon: '🔬' });
      accounts.push({ name: 'Pre-Prod / Staging Account', type: 'workload', desc: 'UAT、壓力測試、效能驗證環境', icon: '🧪' });
    }
    accounts.push({ name: 'Production Account', type: 'workload', desc: '正式環境，高度管控，最小授權原則', icon: '🚀' });

    if (hasDR || tier === 'financial') {
      accounts.push({ name: 'DR Account', type: 'dr', desc: '異地備援、跨區域複寫、BCP 測試專用', icon: '☁️' });
    }
    if (outsource || tier === 'financial') {
      accounts.push({ name: 'Audit / Compliance Account', type: 'compliance', desc: '委外稽核存取、合規報告、RBAC 稽核軌跡', icon: '🔍' });
    }

    const guardrails = [];
    guardrails.push({ name: 'Root MFA 強制啟用', status: 'required', risk: 'critical' });
    guardrails.push({ name: 'S3 Block Public Access', status: 'required', risk: 'critical' });
    guardrails.push({ name: 'CloudTrail 全區域啟用', status: 'required', risk: 'high' });
    guardrails.push({ name: 'Config Rules 合規基線', status: 'required', risk: 'high' });
    guardrails.push({ name: 'GuardDuty 威脅偵測', status: 'required', risk: 'high' });
    guardrails.push({ name: 'VPC 未加密流量禁止', status: 'recommended', risk: 'high' });
    if (tier === 'standard' || tier === 'financial') {
      guardrails.push({ name: 'AWS SSO / IAM Identity Center', status: 'required', risk: 'high' });
      guardrails.push({ name: 'Service Control Policies (SCPs)', status: 'required', risk: 'medium' });
    }
    if (tier === 'financial') {
      guardrails.push({ name: 'AWS FSBP (Foundational Security Best Practice)', status: 'required', risk: 'critical' });
      guardrails.push({ name: 'Security Hub 集中化儀表板', status: 'required', risk: 'high' });
      guardrails.push({ name: 'Macie 個資掃描', status: 'required', risk: 'high' });
      guardrails.push({ name: 'KMS 加密金鑰管理', status: 'required', risk: 'high' });
      guardrails.push({ name: '備份政策 (AWS Backup)', status: 'required', risk: 'medium' });
    }

    const maturityStage = {
      basic:     { level: 1, name: '基礎治理期', desc: '建立帳號隔離與基本稽核機制' },
      standard:  { level: 2, name: '標準成熟期', desc: '引入 SCP、SSO、多環境治理' },
      financial: { level: 3, name: '金融合規期', desc: '全面安全基線、稽核可追溯、FSBP 達標' },
    };

    return { tier, accounts, guardrails, maturityStage: maturityStage[tier], hasLZ, hasIAM };
  }

  // ── Cost Estimation ──────────────────────────────────────
  function estimateCost(inputs) {
    const budget     = inputs.budget || 'medium';
    const systemSize = inputs.systemSize || 'medium';
    const hasDR      = inputs.needDR === 'yes';
    const txVolume   = inputs.txVolume || 'medium';
    const dataSize   = inputs.dataSize || 'medium';
    const multiEnv   = (parseInt(inputs.envCount) || 2) >= 3;

    // Base monthly cost (USD) by system size
    const base = { small: 3000, medium: 12000, large: 45000, enterprise: 150000 };
    let monthly = base[systemSize] || base.medium;

    // DR multiplier
    if (hasDR) monthly *= 1.4;

    // Traffic factor
    if (txVolume === 'high') monthly *= 1.5;
    if (txVolume === 'very_high') monthly *= 2.2;

    // Data size
    if (dataSize === 'large') monthly *= 1.3;
    if (dataSize === 'very_large') monthly *= 1.7;

    // Multi-env factor
    if (multiEnv) monthly *= 1.2;

    // Budget adjustment (loose signal)
    if (budget === 'tight') monthly *= 0.8;
    if (budget === 'ample') monthly *= 1.2;

    const low  = Math.round(monthly * 0.7 / 100) * 100;
    const high = Math.round(monthly * 1.4 / 100) * 100;
    const mid  = Math.round(monthly / 100) * 100;

    // Breakdown (approx proportions)
    const breakdown = {
      compute: Math.round(mid * 0.38),
      storage: Math.round(mid * 0.15),
      network: Math.round(mid * 0.12),
      database: Math.round(mid * 0.18),
      dr_backup: hasDR ? Math.round(mid * 0.10) : Math.round(mid * 0.04),
      security: Math.round(mid * 0.08),
      mgmt: Math.round(mid * 0.05),
    };

    // One-time migration cost (3–6x monthly)
    const migrationLow  = Math.round(mid * 3 / 1000) * 1000;
    const migrationHigh = Math.round(mid * 6 / 1000) * 1000;

    // Annual
    const annualLow  = low * 12;
    const annualHigh = high * 12;

    const drivers = [];
    if (hasDR) drivers.push({ name: '異地備援 (DR)', impact: 'high', note: '增加約 40% 整體雲端成本' });
    if (txVolume === 'high' || txVolume === 'very_high') drivers.push({ name: '高流量 / 高 TPS', impact: 'high', note: '運算資源彈性擴充需求高' });
    if (dataSize === 'large' || dataSize === 'very_large') drivers.push({ name: '大量資料儲存', impact: 'medium', note: 'S3 / RDS 儲存成本較高' });
    if (multiEnv) drivers.push({ name: '多環境治理', impact: 'medium', note: '開發 / 測試 / 正式環境分開計費' });
    drivers.push({ name: '網路傳輸', impact: 'medium', note: '跨區 / 跨帳號流量費用需仔細估算' });

    const recommendation = mid > 50000
      ? '建議優先進行 PoC / MVP 試驗，透過 Savings Plans 或 Reserved Instances 降低長期成本。'
      : '建議採用 On-Demand 起步，第一季後根據使用率採購 Compute Savings Plans。';

    return { low, mid, high, annualLow, annualHigh, breakdown, drivers, recommendation, migrationLow, migrationHigh };
  }

  // ── Risk Radar ────────────────────────────────────────────
  function assessRisk(inputs) {
    const compliance    = inputs.complianceLevel || 'medium';
    const hasPersonal   = inputs.hasPersonalData === 'yes';
    const hasFinancial  = inputs.hasFinancialData === 'yes';
    const outsource     = inputs.isMajorOutsource === 'yes';
    const cloudMaturity = inputs.cloudMaturity || 'low';
    const techDebt      = inputs.techDebt || 'medium';
    const age           = parseInt(inputs.systemAge) || 5;
    const hasExtInteg   = inputs.hasExternalIntegration === 'yes';
    const isCoreSystem  = inputs.isCoreSystem === 'yes';
    const timeline      = inputs.timeline || 'medium';
    const needDR        = inputs.needDR === 'yes';
    const sla           = inputs.slaRequirement || 'medium';
    const hasDR         = inputs.needDR === 'yes';
    const downtime      = inputs.downtimeTolerance || 'medium';

    // Compliance Risk (0–100)
    let compRisk = 20;
    if (compliance === 'high')   compRisk += 30;
    if (compliance === 'medium') compRisk += 10;
    if (hasPersonal)   compRisk += 20;
    if (hasFinancial)  compRisk += 25;
    if (outsource)     compRisk += 15;
    if (!inputs.hasIAM || inputs.hasIAM === 'no') compRisk += 10;

    // Technical Risk (0–100)
    let techRisk = 15;
    if (techDebt === 'high')   techRisk += 30;
    if (techDebt === 'medium') techRisk += 15;
    if (age > 15)  techRisk += 20;
    if (age > 10)  techRisk += 10;
    if (hasExtInteg) techRisk += 15;
    if (inputs.archType === 'monolith') techRisk += 10;

    // Operational Risk (0–100)
    let opRisk = 15;
    if (cloudMaturity === 'low')    opRisk += 30;
    if (cloudMaturity === 'medium') opRisk += 10;
    if (isCoreSystem)  opRisk += 15;
    if (!hasDR)        opRisk += 15;
    if (sla === 'high') opRisk += 10;
    if (downtime === 'none') opRisk += 15;

    // Timeline Risk (0–100)
    let timelineRisk = 20;
    if (timeline === 'urgent')   timelineRisk += 30;
    if (timeline === 'medium')   timelineRisk += 10;
    if (cloudMaturity === 'low') timelineRisk += 15;
    if (techDebt === 'high')     timelineRisk += 15;

    // Data Risk (0–100)
    let dataRisk = 10;
    if (hasPersonal)   dataRisk += 25;
    if (hasFinancial)  dataRisk += 30;
    if (inputs.dataSize === 'very_large') dataRisk += 20;
    if (inputs.dataRetention === 'long')  dataRisk += 10;

    // Business Risk (0–100)
    let bizRisk = 15;
    if (isCoreSystem)  bizRisk += 20;
    if (downtime === 'none') bizRisk += 25;
    if (!hasDR)        bizRisk += 15;
    if (sla === 'high') bizRisk += 15;

    // Cap at 95
    const cap = v => Math.min(95, v);
    compRisk = cap(compRisk);
    techRisk = cap(techRisk);
    opRisk   = cap(opRisk);
    timelineRisk = cap(timelineRisk);
    dataRisk = cap(dataRisk);
    bizRisk  = cap(bizRisk);

    const overall = Math.round((compRisk + techRisk + opRisk + timelineRisk + dataRisk + bizRisk) / 6);

    const mitigations = [];
    if (compRisk > 60)     mitigations.push('優先建立 Landing Zone 與 IAM 基線，確保合規基礎到位');
    if (techRisk > 60)     mitigations.push('建議先做技術債盤點，選定低技術債子系統作為 PoC 範圍');
    if (opRisk > 60)       mitigations.push('強烈建議雲端人員能力培訓，先建立 COE (Cloud Center of Excellence)');
    if (timelineRisk > 60) mitigations.push('時程壓力大，建議縮小 MVP 範圍，採取 Rehost 快速遷移策略');
    if (dataRisk > 60)     mitigations.push('個資 / 金流系統須完成 DLP 策略與加密設計再行遷移');
    if (bizRisk > 60)      mitigations.push('核心系統需要完整 BCP 計畫，DR 與 Runbook 須在遷移前就緒');
    if (mitigations.length === 0) mitigations.push('整體風險可控，依建議 6R 策略逐步推進');

    return { compRisk, techRisk, opRisk, timelineRisk, dataRisk, bizRisk, overall, mitigations };
  }

  // ── KPI Scores ────────────────────────────────────────────
  function calcKPIs(inputs, strategy, risk) {
    const compliance    = inputs.complianceLevel || 'medium';
    const cloudMaturity = inputs.cloudMaturity || 'low';
    const hasLZ         = inputs.hasLandingZone === 'yes';
    const hasIAM        = inputs.hasIAM === 'yes';
    const techDebt      = inputs.techDebt || 'medium';
    const timeline      = inputs.timeline || 'medium';
    const budget        = inputs.budget || 'medium';

    // Compliance Readiness
    let compScore = 50;
    if (compliance === 'high')   compScore = 45;
    if (compliance === 'medium') compScore = 65;
    if (compliance === 'low')    compScore = 80;
    if (hasLZ)  compScore += 15;
    if (hasIAM) compScore += 10;

    // LZ Readiness
    let lzScore = 30;
    if (hasLZ)  lzScore += 40;
    if (hasIAM) lzScore += 20;
    if (cloudMaturity === 'medium') lzScore += 10;
    if (cloudMaturity === 'high')   lzScore += 20;
    if (inputs.hasMultiAccount === 'yes') lzScore += 10;

    // Technical Debt Score (inverted - low debt = high score)
    let debtScore = techDebt === 'low' ? 80 : techDebt === 'medium' ? 55 : 30;
    const age = parseInt(inputs.systemAge) || 5;
    if (age < 5)  debtScore += 10;
    if (age > 10) debtScore -= 15;
    if (age > 15) debtScore -= 20;

    // ROI Potential
    let roiScore = 50;
    const goalRoi = { cost: 70, speed: 75, api: 80, elastic: 75, ai: 85, compliance: 55 };
    roiScore = goalRoi[inputs.cloudGoal] || 60;
    if (budget === 'ample')  roiScore += 10;
    if (budget === 'tight')  roiScore -= 10;
    if (strategy === 'refactor')  roiScore += 10;
    if (strategy === 'replatform') roiScore += 5;

    // Timeline Feasibility
    let timeScore = 60;
    if (timeline === 'flexible') timeScore = 80;
    if (timeline === 'medium')   timeScore = 60;
    if (timeline === 'urgent')   timeScore = 35;
    if (cloudMaturity === 'high') timeScore += 10;
    if (techDebt === 'high')     timeScore -= 15;

    const cap = v => Math.max(10, Math.min(98, v));
    return {
      compliance:  cap(compScore),
      lzReadiness: cap(lzScore),
      techDebt:    cap(debtScore),
      roi:         cap(roiScore),
      timeline:    cap(timeScore),
    };
  }

  // ── Executive Summary ────────────────────────────────────
  function buildExecutiveSummary(inputs, strategy6R, risk, kpi) {
    const pName    = inputs.projectName || '本專案';
    const goal     = inputs.cloudGoal || 'cost';
    const strat    = strategy6R.primary;
    const compliance = inputs.complianceLevel || 'medium';
    const isCoreSystem = inputs.isCoreSystem === 'yes';

    const stratName = { rehost:'直接遷移 (Rehost)', replatform:'平台調整 (Replatform)', refactor:'架構重構 (Refactor)', retain:'暫緩保留 (Retain)', retire:'下線退場 (Retire)' };
    const goalName  = { cost:'降低維運成本', speed:'提升交付速度', api:'API 化轉型', elastic:'彈性擴展', ai:'AI 應用落地', compliance:'法規合規' };
    const compName  = { low:'一般', medium:'中等合規', high:'高度合規 (金融/法遵)' };

    const strategyJustification = {
      rehost: `系統評估顯示現有架構穩定，虛擬化程度可支援直接遷移，且在有限時程與預算約束下，Rehost 可快速完成基礎上雲目標，建立後續 Replatform 的基礎。`,
      replatform: `評估結果顯示系統具備一定的技術基礎，但需要在容器化、受管理資料庫或負載均衡層面進行調整，以充分發揮雲端彈性與效率，Replatform 能在合理成本內取得最大化效益。`,
      refactor: `系統架構具備重構潛力，雲端能力成熟度與目標需求 (${goalName[goal]}) 均支援雲原生化，建議透過服務拆解與 API 設計，實現更高彈性與未來 AI 整合能力。`,
      retain: `鑑於系統複雜度、合規要求 (${compName[compliance]}) 或技術風險，現階段建議暫緩整體遷移，優先完成 Landing Zone 建置、IAM 基線，與核心風險降低工作，再評估分階段遷移路徑。`,
      retire: `評估結果顯示此系統功能已可被 SaaS 或其他雲端原生服務替代，建議規劃退場時程，搭配 Repurchase 策略，降低維運負擔。`,
    };

    const timing = {
      rehost:    '建議於 3–6 個月內啟動 PoC，確認基礎設施遷移可行性後，啟動第一波遷移',
      replatform:'建議先完成 Landing Zone 建置（4–8 週），再進行 8–16 週 Replatform PoC',
      refactor:  '建議分 3 個 Sprint 進行架構評估與拆解，再啟動 12–24 個月的重構計畫',
      retain:    '建議 6 個月內完成 Landing Zone 與安全基線，再重新評估遷移成熟度',
      retire:    '建議 3 個月內評估替代 SaaS 方案，制訂退場時程與資料遷移計畫',
    };

    const riskLevel = risk.overall >= 70 ? '高度' : risk.overall >= 50 ? '中等' : '相對可控';

    const prerequisites = [];
    if (!inputs.hasLandingZone || inputs.hasLandingZone === 'no') prerequisites.push('建立 Landing Zone 與帳號結構');
    if (!inputs.hasIAM || inputs.hasIAM === 'no') prerequisites.push('部署 IAM Identity Center 與基本 RBAC');
    if (inputs.cloudMaturity === 'low') prerequisites.push('啟動雲端人員培訓計畫 (至少 2 名 Cloud Engineer)');
    if (risk.compRisk > 60) prerequisites.push('完成合規差距分析 (Compliance Gap Assessment)');
    if (isCoreSystem) prerequisites.push('制訂核心系統 BCP / Runbook 與回滾計畫');
    if (prerequisites.length === 0) prerequisites.push('目前基礎條件已具備，可直接規劃執行路徑');

    return {
      title: `${pName} 雲端轉型評估報告`,
      strategyTitle: `建議採行策略：${stratName[strat] || strat}`,
      conclusion: `本次評估涵蓋系統架構、合規需求、組織成熟度與財務可行性，綜合評估結論為：採行 **${stratName[strat] || strat}** 策略，以實現 ${goalName[goal]} 為首要目標。整體風險等級 ${riskLevel}，KPI 就緒分數 ${Math.round((kpi.compliance + kpi.lzReadiness + kpi.roi) / 3)}%。`,
      justification: strategyJustification[strat] || '',
      timing: timing[strat] || '',
      riskLevel,
      prerequisites,
    };
  }

  // ── Presentation Outline ─────────────────────────────────
  function buildPresentation(inputs, strategy6R, lz, cost, risk) {
    const pName = inputs.projectName || '雲端轉型專案';
    const strat = strategy6R.primary;
    const stratName = { rehost:'直接遷移 (Rehost)', replatform:'平台調整 (Replatform)', refactor:'架構重構 (Refactor)', retain:'暫緩保留 (Retain)', retire:'下線退場 (Retire)' };

    return [
      {
        slide: 1, title: '專案背景與業務痛點',
        points: [
          `專案名稱：${pName}`,
          `核心痛點：${inputs.painPoints || '現有系統維運成本高、彈性不足'}`,
          `上雲目標：${inputs.cloudGoal ? {cost:'降低維運成本',speed:'提升交付速度',api:'API 化轉型',elastic:'彈性擴展',ai:'AI 應用落地',compliance:'法規合規'}[inputs.cloudGoal] : '提升業務靈活性'}`,
          `系統現況：${inputs.archType ? {monolith:'單體式架構',threelayer:'三層式架構',api:'API 化架構',microservices:'微服務架構'}[inputs.archType] : '現有架構'}，系統年齡約 ${inputs.systemAge || '?'} 年`,
          `合規等級：${inputs.complianceLevel === 'high' ? '高度法遵（含個資/金流）' : inputs.complianceLevel === 'medium' ? '中等合規需求' : '一般合規要求'}`,
        ]
      },
      {
        slide: 2, title: '雲端策略判斷與建議',
        points: [
          `建議策略：${stratName[strat] || strat}（信心指數 ${strategy6R.confidence}%）`,
          `判斷依據：系統年齡、技術債、合規等級、雲端成熟度綜合評估`,
          `次選策略：${stratName[strategy6R.secondary] || strategy6R.secondary}（可作為後期演進方向）`,
          `優先範圍：建議先選擇非核心且技術債低的子系統作為 PoC`,
          `預期效益：降低維運成本 20–40%，提升系統彈性與可擴展性`,
        ]
      },
      {
        slide: 3, title: 'Landing Zone 與治理架構',
        points: [
          `治理模型：${lz.maturityStage.name}（${lz.maturityStage.desc}）`,
          `帳號結構：建議設立 ${lz.accounts.length} 個獨立帳號，實現工作負載隔離`,
          `核心帳號：Management / Security / Log Archive / Network Account`,
          `安全基線：${lz.guardrails.filter(g => g.status === 'required').length} 項必要 Guardrails，包含 MFA、CloudTrail、GuardDuty`,
          `IAM 治理：建議採用 AWS IAM Identity Center，集中身份管理`,
        ]
      },
      {
        slide: 4, title: '成本估算與風險摘要',
        points: [
          `月成本估算：USD $${cost.low.toLocaleString()} – $${cost.high.toLocaleString()}（中估值 $${cost.mid.toLocaleString()}）`,
          `年度預算區間：USD $${cost.annualLow.toLocaleString()} – $${cost.annualHigh.toLocaleString()}`,
          `遷移一次性費用：USD $${cost.migrationLow.toLocaleString()} – $${cost.migrationHigh.toLocaleString()}`,
          `最大成本驅動因子：${cost.drivers.slice(0,2).map(d => d.name).join('、')}`,
          `整體風險等級：${risk.overall >= 70 ? '高' : risk.overall >= 50 ? '中' : '低'}（合規風險 ${risk.compRisk}%、技術風險 ${risk.techRisk}%、營運風險 ${risk.opRisk}%）`,
        ]
      },
      {
        slide: 5, title: '建議決策與下一步行動',
        points: [
          `Step 1（0–4 週）：完成現況盤點與 Gap Analysis`,
          `Step 2（4–8 週）：建立 Landing Zone 基礎架構`,
          `Step 3（8–16 週）：選定 PoC 範圍，啟動試驗遷移`,
          `Step 4（16–24 週）：根據 PoC 結果調整策略，啟動第一波遷移`,
          `Step 5（持續）：建立雲端治理 COE，定期進行 Well-Architected Review`,
        ]
      },
    ];
  }

  // ── Tech PM Recommendations ──────────────────────────────
  function buildTechPM(inputs, strategy6R, lz, risk) {
    const strat = strategy6R.primary;
    const techDebt = inputs.techDebt || 'medium';
    const cloudMaturity = inputs.cloudMaturity || 'low';

    const phases = {
      rehost: [
        { phase: 'Phase 0 (0–4W)', name: '環境準備', items: ['開通 AWS 帳號與 Landing Zone（CT + SCP）', '規劃 VPC 架構（CIDR / Subnet / AZ）', '確認 DirectConnect 或 VPN 連線方案', '盤點所有 VM 規格與依賴關係（Application Dependency Mapping）'] },
        { phase: 'Phase 1 (4–12W)', name: 'PoC 遷移', items: ['選定 2–3 個非核心服務做 Lift & Shift 驗證', '使用 AWS Application Migration Service (MGN)', '驗證效能基線與連線正確性', '建立 Runbook 與回滾程序'] },
        { phase: 'Phase 2 (12–24W)', name: '批量遷移', items: ['依優先序分波遷移（Wave Planning）', '核心系統使用 Blue/Green 或 Canary 切換', '執行壓力測試與 DR 演練', '移交維運並建立監控儀表板'] },
      ],
      replatform: [
        { phase: 'Phase 0 (0–4W)', name: '技術評估', items: ['資料庫遷移評估（自建 DB → RDS / Aurora）', '容器化可行性評估（ECS / EKS 適合度）', '應用程式相依套件盤點與版本升級', 'CI/CD Pipeline 設計規劃'] },
        { phase: 'Phase 1 (4–16W)', name: 'Replatform PoC', items: ['選定 1–2 個微模組容器化試驗', 'DB 遷移到 RDS with Multi-AZ', '建立 CI/CD Pipeline (CodePipeline / GitLab)', '驗證 Auto Scaling 與 Load Balancer 設定'] },
        { phase: 'Phase 2 (16–30W)', name: '全面推行', items: ['系統性容器化或遷移受管服務', '建立統一 Observability (CloudWatch + X-Ray)', '實施 Cost Allocation Tags', '完成 Security 稽核與 Well-Architected Review'] },
      ],
      refactor: [
        { phase: 'Phase 0 (0–6W)', name: '架構設計', items: ['微服務拆解圖 (Domain Driven Design)', 'API Gateway 設計與版本策略', '事件驅動架構規劃（EventBridge / SQS / SNS）', '資料模型重設計（多資料庫策略）'] },
        { phase: 'Phase 1 (6–20W)', name: '核心重構', items: ['選定 Strangler Fig 或 Parallel Run 策略', '依 DDD Bounded Context 逐步拆解', '建立 API Contract Testing', '實施 Blue/Green Deployment'] },
        { phase: 'Phase 2 (20–52W)', name: '規模化', items: ['全面微服務化與 API 閘道整合', '引入 Service Mesh (App Mesh / Istio)', '建立 FinOps 成本治理機制', 'AI/ML 服務整合規劃'] },
      ],
      retain: [
        { phase: 'Phase 0 (0–8W)', name: 'Gap Analysis', items: ['執行雲端成熟度評估（CMF Assessment）', '法遵 / 合規差距分析', '系統健康度盤點（MTBF / 技術債量化）', 'Landing Zone 設計確認'] },
        { phase: 'Phase 1 (8–20W)', name: '基礎建設', items: ['建立 Landing Zone 與帳號架構', '部署 IAM Identity Center', '啟用全套安全工具（GuardDuty, Config, CloudTrail）', '建立雲端 COE 與培訓計畫'] },
        { phase: 'Phase 2 (20W+)', name: '分階段遷移', items: ['重新評估各系統遷移優先序', '先選低風險系統做 PoC', '核心系統等待合規基線完成後再行評估', '每季進行一次遷移成熟度 Review'] },
      ],
      retire: [
        { phase: 'Phase 0 (0–4W)', name: '替代評估', items: ['市場 SaaS 調研（功能覆蓋率評估）', 'TCO 比較（自建 vs SaaS）', '資料格式與遷移可行性評估', '法規允許使用 SaaS 的確認'] },
        { phase: 'Phase 1 (4–12W)', name: '遷移準備', items: ['資料清洗與格式轉換', 'SaaS 整合測試', '舊系統資料保存策略', 'User 培訓與 Change Management'] },
        { phase: 'Phase 2 (12–20W)', name: '切換退場', items: ['平行運行期（4–6 週）', '逐步降低舊系統流量', '確認資料完整性後正式退場', '歸檔舊系統資料'] },
      ],
    };

    const pocScope = {
      rehost:    '建議選擇批次作業系統或報表查詢模組作為首個 PoC，技術風險低且驗證效益明顯',
      replatform:'建議以資料庫遷移（RDS 化）+ 容器化作為 PoC 核心，驗證效能不降反升',
      refactor:  '建議從 1 個 Bounded Context（如通知服務 / 報表服務）開始重構，驗證 API Contract',
      retain:    '建議以 Landing Zone 建置為 PoC，驗證帳號結構與安全合規可行性',
      retire:    '建議先 PoC 驗證 SaaS 功能是否能覆蓋 80% 核心使用案例',
    };

    const collaborators = [
      '雲端架構師 (Cloud Architect)',
      'DevOps / Platform Engineer',
      isCoreSystemRole(inputs) ? '資安合規顧問 (Cloud Security Specialist)' : '資安工程師',
    ];
    if (inputs.cloudMaturity === 'low') collaborators.push('雲端教練 / 培訓講師');
    if (inputs.isMajorOutsource === 'yes') collaborators.push('稽核窗口 / 委外廠商代表');
    collaborators.push('業務單位 PM / 需求窗口');

    const dataNeeded = [];
    if (!inputs.systemAge) dataNeeded.push('系統上線日期 / 版本記錄');
    if (!inputs.txVolume)  dataNeeded.push('實際 TPS / 日活用戶數（運監數據）');
    dataNeeded.push('完整的系統相依關係圖（Application Dependency Map）');
    dataNeeded.push('現有 IP / DNS / VLAN 網路架構');
    if (inputs.hasPersonalData === 'yes') dataNeeded.push('個資存儲位置與欄位清單');
    if (inputs.hasExternalIntegration === 'yes') dataNeeded.push('外部系統 API 規格與 SLA 合約');

    const techValidation = [
      '網路延遲基線測試（現地 vs AWS Region）',
      '授權確認（License Mobility for SQL Server / Oracle 等）',
      'Well-Architected Review Pillar 評分',
    ];
    if (inputs.needDR === 'yes') techValidation.push('DR 演練驗證（RPO / RTO 實測）');
    if (inputs.archType === 'monolith') techValidation.push('Container 化可行性 Spike');

    return {
      phases: phases[strat] || phases.rehost,
      pocScope: pocScope[strat] || '',
      collaborators,
      dataNeeded,
      techValidation,
    };
  }

  function isCoreSystemRole(inputs) {
    return inputs.isCoreSystem === 'yes' || inputs.hasFinancialData === 'yes' || inputs.hasPersonalData === 'yes';
  }

  // ── Next Steps ────────────────────────────────────────────
  function buildNextSteps(inputs, strategy6R, risk) {
    return [
      {
        step: 1,
        title: '完成現況盤點 (As-Is Assessment)',
        desc: '執行完整的系統清單盤點、Application Dependency Mapping、技術債量化',
        owner: 'IT 架構師 + 業務單位',
        timeline: '0–4 週',
        priority: 'critical',
      },
      {
        step: 2,
        title: '確認資料分級與法遵需求',
        desc: '完成個資影響評估 (PIA)、資料分類 (Classification)、法遵缺口分析',
        owner: '資安合規 + 法務',
        timeline: '2–6 週',
        priority: risk.compRisk > 60 ? 'critical' : 'high',
      },
      {
        step: 3,
        title: '建立 Landing Zone Baseline',
        desc: `依 ${strategy6R.primary === 'retain' ? '立即' : '第一波遷移前'} 完成 AWS Control Tower 部署、帳號架構、SCPs`,
        owner: '雲端架構師',
        timeline: '4–8 週',
        priority: 'high',
      },
      {
        step: 4,
        title: '選定 MVP 遷移範圍',
        desc: '依系統重要性、技術債與風險矩陣，選出 1–3 個子系統作為第一波遷移目標',
        owner: 'PM + 架構師',
        timeline: '4–6 週',
        priority: 'high',
      },
      {
        step: 5,
        title: 'PoC 驗證與成本校準',
        desc: '執行 PoC / Spike，驗證技術可行性，並以實際使用量修正成本估算模型',
        owner: 'DevOps + 架構師',
        timeline: '8–16 週',
        priority: 'medium',
      },
    ];
  }

  // ── Decision Points ───────────────────────────────────────
  function buildDecisionPoints(inputs, strategy6R, cost, risk) {
    const notActingCost = [];
    notActingCost.push('現有系統維護成本持續上升，資深工程師技術傳承風險');
    notActingCost.push('競爭對手雲原生化後，業務靈活性與交付速度差距擴大');
    if (inputs.complianceLevel === 'high') notActingCost.push('法規稽查風險提高，未建立稽核軌跡可能導致合規罰鍰');
    if (inputs.needDR !== 'yes') notActingCost.push('缺乏 DR 機制，業務中斷風險高，潛在 RTO/RPO 無法達標');
    notActingCost.push(`延遲上雲每季估算機會成本：USD $${Math.round(cost.mid * 3 * 0.15 / 1000) * 1000} – $${Math.round(cost.mid * 3 * 0.3 / 1000) * 1000}`);

    const coreDecisions = [];
    coreDecisions.push(`採行 ${SA?.STRATEGY_LABELS?.[strategy6R.primary] || strategy6R.primary}，信心度 ${strategy6R.confidence}%`);
    coreDecisions.push('Landing Zone 建置優先於工作負載遷移（治理先行）');
    if (risk.overall >= 60) coreDecisions.push('高風險因子需在 PoC 前解決（合規、DR、人員能力）');
    coreDecisions.push('以 MVP/PoC 驗證技術可行性後，再決定全面推行規模');
    coreDecisions.push(`預算區間確認：月費 USD $${cost.low.toLocaleString()} – $${cost.high.toLocaleString()}，需取得 IT + 財務共識`);

    const mvpMust = [];
    mvpMust.push('AWS Landing Zone + Control Tower 部署');
    mvpMust.push('IAM Identity Center + 最小授權 RBAC 設計');
    mvpMust.push('CloudTrail + Config + GuardDuty 基礎安全啟用');
    mvpMust.push('1 個非核心系統完整遷移驗證');
    if (inputs.needDR === 'yes') mvpMust.push('跨區域 DR 架構驗證（RTO/RPO 實測）');
    mvpMust.push('成本監控與預算告警機制建立');

    return { notActingCost, coreDecisions, mvpMust };
  }

  // ── Main Analysis Entry Point ─────────────────────────────
  async function analyze(inputs) {
    // Simulate AI processing delay
    await new Promise(r => setTimeout(r, 2200 + Math.random() * 1200));

    const strategy6R = determine6R(inputs);
    const lz         = determineLandingZone(inputs);
    const cost       = estimateCost(inputs);
    const risk       = assessRisk(inputs);
    const kpi        = calcKPIs(inputs, strategy6R.primary, risk);
    const exec       = buildExecutiveSummary(inputs, strategy6R, risk, kpi);
    const slides     = buildPresentation(inputs, strategy6R, lz, cost, risk);
    const techPM     = buildTechPM(inputs, strategy6R, lz, risk);
    const nextSteps  = buildNextSteps(inputs, strategy6R, risk);
    const decisions  = buildDecisionPoints(inputs, strategy6R, cost, risk);

    const result = {
      id: `analysis_${Date.now()}`,
      timestamp: new Date().toISOString(),
      inputs,
      strategy6R,
      landingZone: lz,
      costEstimate: cost,
      riskRadar: risk,
      kpi,
      executiveSummary: exec,
      presentation: slides,
      techPM,
      nextSteps,
      decisions,
    };

    return result;
  }

  return { analyze, determine6R, determineLandingZone, estimateCost, assessRisk, calcKPIs };

})();

window.AnalyzeEngine = AnalyzeEngine;
