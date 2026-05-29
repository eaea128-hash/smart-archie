/* ============================================================
   CloudFrame — AI Analysis Engine
   Version 1.0
   Rule-based analysis engine with consultant-grade logic.
   Designed to be replaced/augmented by real LLM API calls.
   ============================================================ */

'use strict';

const AnalyzeEngine = (() => {

  // ── 6R/7R Strategy Determination ─────────────────────────────
  function determine6R(inputs) {
    const scores = { rehost: 0, relocate: 0, repurchase: 0, replatform: 0, refactor: 0, retain: 0, retire: 0 };

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
    const hasVMwareInfra  = inputs.hasVMwareInfra === 'yes';
    const customizationLevel = inputs.customizationLevel || 'medium';
    const hasSaasAlternative = inputs.hasSaasAlternative === 'yes';

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

    // ── Relocate（平台搬遷）: VMware/Hyper-V 環境搬到 VMware Cloud on AWS/Azure VMware Solution ──
    if (isVirtualized && (hasVMwareInfra || archType === 'monolith')) {
      scores.relocate += 3;
    }
    if (techDebt === 'low' || techDebt === 'medium') scores.relocate += 1;
    if (timeline === 'urgent' && isVirtualized) scores.relocate += 2;
    // Relocate is only meaningful when virtualized; suppress otherwise
    if (!isVirtualized) scores.relocate = 0;

    // ── Repurchase（SaaS 替換）: 標準化系統可用 SaaS 替代 ──
    if (age >= 10 && customizationLevel === 'low' && hasSaasAlternative) {
      scores.repurchase += 5;
    } else if (age >= 8 && customizationLevel === 'low') {
      scores.repurchase += 2;
    }
    if (cloudGoal === 'cost' && hasSaasAlternative) scores.repurchase += 1;

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

    // ── Relocate / Repurchase reasons ──
    if (isVirtualized && hasVMwareInfra) reasons.push({ icon:'🔄', factor:'虛擬化平台', detail:'已有 VMware/Hyper-V 環境：可搬遷至 VMware Cloud on AWS 或 Azure VMware Solution（Relocate 加分）' });
    if (age >= 10 && customizationLevel === 'low' && hasSaasAlternative) reasons.push({ icon:'🛒', factor:'SaaS 替換可行性', detail:`系統 ${age} 年且客製化程度低、已知有 SaaS 替代方案：Repurchase 可大幅降低維運負擔（Repurchase 強加分）` });

    // 為什麼不選其他策略
    const rejected = [];
    const stratNames = { rehost:'直接遷移(Rehost)', relocate:'平台搬遷(Relocate)', repurchase:'SaaS替換(Repurchase)', replatform:'平台調整(Replatform)', refactor:'架構重構(Refactor)', retain:'暫緩保留(Retain)', retire:'下線退場(Retire)' };
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

    // Assumption transparency for local engine path
    const assumptions = [
      `估算基準：${inputs.systemCount || inputs.vmCount || '—'} 套系統，規模分類：${({'small':'小型（≤10台）','medium':'中型（11–50台）','large':'大型（51–200台）','enterprise':'企業級（200台+）'})[inputs.companySize] || '中型'}`,
      `購買模式：60% Compute Savings Plans（1年期）+ 40% On-Demand（中估情境）`,
      `DR 等級：${({'none':'無 DR','rto24h':'RTO ≤ 24hr（冷備援）','rto4h':'RTO ≤ 4hr（暖備援）','rto1h':'RTO ≤ 1hr（熱備援）','rto15m':'RTO ≤ 15min（主動-主動）'})[inputs.drRequirements] || '暖備援'}，已計入 DR 費用加乘`,
      `合規等級：${({'low':'一般合規','medium':'中等合規（+18%）','high':'高度合規（+55%，含金融/個資工具）'})[inputs.complianceLevel] || '中等合規'}`,
      `不含費用：Professional Services 顧問費、授權遷移（License Mobility）、客製化開發、人員培訓`,
      `最終報價請以 ${inputs.targetCloud || 'AWS'} 官方 Pricing Calculator 或企業報價為準`,
    ];
    return { low, mid, high, annualLow, annualHigh, breakdown, drivers, recommendation, migrationLow, migrationHigh, assumptions };
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
    const sla           = inputs.slaRequirement || 'medium';
    const hasDR         = inputs.needDR === 'yes';
    const downtime      = inputs.downtimeTolerance || 'medium';

    // ── 各維度計分 + 同步記錄影響因素 ──────────────────────────
    const factors = { compRisk: [], techRisk: [], opRisk: [], timelineRisk: [], dataRisk: [], bizRisk: [] };

    // Compliance Risk (0–100, base 20)
    let compRisk = 20;
    factors.compRisk.push({ label: '基礎合規風險', pts: 20 });
    if (compliance === 'high')   { compRisk += 30; factors.compRisk.push({ label: '合規等級「高」（金融/醫療法規）', pts: 30 }); }
    if (compliance === 'medium') { compRisk += 10; factors.compRisk.push({ label: '合規等級「中」', pts: 10 }); }
    if (hasPersonal)   { compRisk += 20; factors.compRisk.push({ label: '含個人資料（PDPA/GDPR）', pts: 20 }); }
    if (hasFinancial)  { compRisk += 25; factors.compRisk.push({ label: '含金融交易資料', pts: 25 }); }
    if (outsource)     { compRisk += 15; factors.compRisk.push({ label: '重大委外（MAS/HKMA 要求）', pts: 15 }); }
    if (!inputs.hasIAM || inputs.hasIAM === 'no') { compRisk += 10; factors.compRisk.push({ label: '尚未建立 IAM 管控', pts: 10 }); }

    // Technical Risk (0–100, base 15)
    let techRisk = 15;
    factors.techRisk.push({ label: '基礎技術風險', pts: 15 });
    if (techDebt === 'high')   { techRisk += 30; factors.techRisk.push({ label: '技術債「高」', pts: 30 }); }
    if (techDebt === 'medium') { techRisk += 15; factors.techRisk.push({ label: '技術債「中」', pts: 15 }); }
    if (age > 15)  { techRisk += 20; factors.techRisk.push({ label: `系統年齡 ${age} 年（>15年，高耦合風險）`, pts: 20 }); }
    else if (age > 10) { techRisk += 10; factors.techRisk.push({ label: `系統年齡 ${age} 年（>10年，遷移需謹慎）`, pts: 10 }); }
    if (hasExtInteg) { techRisk += 15; factors.techRisk.push({ label: '有外部系統整合（介面切換風險）', pts: 15 }); }
    if (inputs.archType === 'monolith') { techRisk += 10; factors.techRisk.push({ label: '單體架構（Lift & Shift 複雜度高）', pts: 10 }); }

    // Operational Risk (0–100, base 15)
    let opRisk = 15;
    factors.opRisk.push({ label: '基礎營運風險', pts: 15 });
    if (cloudMaturity === 'low')    { opRisk += 30; factors.opRisk.push({ label: '雲端成熟度「低」（團隊能力不足）', pts: 30 }); }
    if (cloudMaturity === 'medium') { opRisk += 10; factors.opRisk.push({ label: '雲端成熟度「中」', pts: 10 }); }
    if (isCoreSystem)  { opRisk += 15; factors.opRisk.push({ label: '核心系統（影響業務連續性）', pts: 15 }); }
    if (!hasDR)        { opRisk += 15; factors.opRisk.push({ label: '無 DR 異地備援規劃', pts: 15 }); }
    if (sla === 'high') { opRisk += 10; factors.opRisk.push({ label: 'SLA 要求高（99.9%+）', pts: 10 }); }
    if (downtime === 'none') { opRisk += 15; factors.opRisk.push({ label: '零停機要求（遷移視窗極短）', pts: 15 }); }

    // Timeline Risk (0–100, base 20)
    let timelineRisk = 20;
    factors.timelineRisk.push({ label: '基礎時程風險', pts: 20 });
    if (timeline === 'urgent')   { timelineRisk += 30; factors.timelineRisk.push({ label: '緊急時程（<6個月），準備不足', pts: 30 }); }
    if (timeline === 'medium')   { timelineRisk += 10; factors.timelineRisk.push({ label: '中期時程（6–12個月）', pts: 10 }); }
    if (cloudMaturity === 'low') { timelineRisk += 15; factors.timelineRisk.push({ label: '雲端成熟度低，學習曲線長', pts: 15 }); }
    if (techDebt === 'high')     { timelineRisk += 15; factors.timelineRisk.push({ label: '高技術債延長遷移週期', pts: 15 }); }

    // Data Risk (0–100, base 10)
    let dataRisk = 10;
    factors.dataRisk.push({ label: '基礎資料風險', pts: 10 });
    if (hasPersonal)   { dataRisk += 25; factors.dataRisk.push({ label: '含個人識別資料（PII）', pts: 25 }); }
    if (hasFinancial)  { dataRisk += 30; factors.dataRisk.push({ label: '含金融敏感資料（帳務/支付）', pts: 30 }); }
    if (inputs.dataSize === 'very_large') { dataRisk += 20; factors.dataRisk.push({ label: '超大資料量（搬遷時間長、風險高）', pts: 20 }); }
    if (inputs.dataRetention === 'long')  { dataRisk += 10; factors.dataRisk.push({ label: '長期資料保留（合規與儲存成本）', pts: 10 }); }

    // Business Risk (0–100, base 15)
    let bizRisk = 15;
    factors.bizRisk.push({ label: '基礎業務風險', pts: 15 });
    if (isCoreSystem)  { bizRisk += 20; factors.bizRisk.push({ label: '核心系統停機影響營收', pts: 20 }); }
    if (downtime === 'none') { bizRisk += 25; factors.bizRisk.push({ label: '零停機容忍（業務連續性壓力最高）', pts: 25 }); }
    if (!hasDR)        { bizRisk += 15; factors.bizRisk.push({ label: '無異地備援（單點故障風險）', pts: 15 }); }
    if (sla === 'high') { bizRisk += 15; factors.bizRisk.push({ label: '高 SLA 承諾（違約賠償風險）', pts: 15 }); }

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
    if (mitigations.length === 0) mitigations.push('整體風險可控，依建議 7R 遷移策略逐步推進');

    return { compRisk, techRisk, opRisk, timelineRisk, dataRisk, bizRisk, overall, mitigations, factors };
  }

  // ── KPI Scores ────────────────────────────────────────────
  function calcKPIs(inputs, strategy) {
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

    const stratName = { rehost:'直接遷移 (Rehost)', relocate:'平台搬遷 (Relocate)', repurchase:'SaaS 替換 (Repurchase)', replatform:'平台調整 (Replatform)', refactor:'架構重構 (Refactor)', retain:'暫緩保留 (Retain)', retire:'下線退場 (Retire)' };
    const goalName  = { cost:'降低維運成本', speed:'提升交付速度', api:'API 化轉型', elastic:'彈性擴展', ai:'AI 應用落地', compliance:'法規合規' };
    const compName  = { low:'一般', medium:'中等合規', high:'高度合規 (金融/法遵)' };

    const strategyJustification = {
      rehost: `系統評估顯示現有架構穩定，虛擬化程度可支援直接遷移，且在有限時程與預算約束下，Rehost 可快速完成基礎上雲目標，建立後續 Replatform 的基礎。`,
      relocate: `系統已在 VMware/Hyper-V 環境運行，具備搬遷至 VMware Cloud on AWS 或 Azure VMware Solution 的條件。Relocate 可在不修改程式碼的前提下，將整個虛擬化環境平移至雲端，降低遷移風險並保留現有營運模式。`,
      repurchase: `系統年齡較高且客製化需求低，市場已存在成熟的 SaaS 替代方案。Repurchase 可大幅降低維護技術債的長期成本，團隊得以專注於核心業務，而非基礎設施維運。`,
      replatform: `評估結果顯示系統具備一定的技術基礎，但需要在容器化、受管理資料庫或負載均衡層面進行調整，以充分發揮雲端彈性與效率，Replatform 能在合理成本內取得最大化效益。`,
      refactor: `系統架構具備重構潛力，雲端能力成熟度與目標需求 (${goalName[goal]}) 均支援雲原生化，建議透過服務拆解與 API 設計，實現更高彈性與未來 AI 整合能力。`,
      retain: `鑑於系統複雜度、合規要求 (${compName[compliance]}) 或技術風險，現階段建議暫緩整體遷移，優先完成 Landing Zone 建置、IAM 基線，與核心風險降低工作，再評估分階段遷移路徑。`,
      retire: `評估結果顯示此系統功能已可被 SaaS 或其他雲端原生服務替代，建議規劃退場時程，搭配 Repurchase 策略，降低維運負擔。`,
    };

    const timing = {
      rehost:     '建議於 3–6 個月內啟動 PoC，確認基礎設施遷移可行性後，啟動第一波遷移',
      relocate:   '建議先確認 VMware Cloud on AWS / Azure VMware Solution 可用性（2–4 週），再進行 8–16 週搬遷 PoC',
      repurchase: '建議 4–8 週完成 SaaS 功能覆蓋率評估，確認法規許可後，制訂 12–16 週切換計畫',
      replatform: '建議先完成 Landing Zone 建置（4–8 週），再進行 8–16 週 Replatform PoC',
      refactor:   '建議分 3 個 Sprint 進行架構評估與拆解，再啟動 12–24 個月的重構計畫',
      retain:     '建議 6 個月內完成 Landing Zone 與安全基線，再重新評估遷移成熟度',
      retire:     '建議 3 個月內評估替代 SaaS 方案，制訂退場時程與資料遷移計畫',
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
    const stratName = { rehost:'直接遷移 (Rehost)', relocate:'平台搬遷 (Relocate)', repurchase:'SaaS 替換 (Repurchase)', replatform:'平台調整 (Replatform)', refactor:'架構重構 (Refactor)', retain:'暫緩保留 (Retain)', retire:'下線退場 (Retire)' };

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
  function buildTechPM(inputs, strategy6R) {
    const strat = strategy6R.primary;
    const systemAge  = parseInt(inputs.systemAge) || 0;
    const isLegacy   = systemAge >= 10 || inputs.archType === 'monolith';
    const isFinancial = ['financial', 'finance', 'banking', 'insurance', 'banking_finance',
      'financial services']
      .includes((inputs.industry || '').toLowerCase());

    const phases = {
      relocate: [
        { phase: 'Phase 0 (0–4W)', name: '平台評估', items: ['確認 VMware vSphere 版本相容性（vSphere 6.5+）', '盤點 VM 規格與授權（CPU、記憶體、Storage Policy）', '評估 VMware Cloud on AWS / Azure VMware Solution 可用區域', 'DirectConnect / ExpressRoute 網路規劃（延遲實測）'] },
        { phase: 'Phase 1 (4–12W)', name: 'Pilot 搬遷', items: ['選定 2–3 個非核心 VM 進行 HCX（Hybrid Cloud Extension）試驗', '驗證 L2 網路延伸、Storage vMotion 可行性', '確認 License 攜帶（BYOL vs 全新授權）', '建立 Runbook 與 HCX 回滾程序'] },
        { phase: 'Phase 2 (12–24W)', name: '批量搬遷', items: ['分波次遷移（依業務優先序）', '核心 VM 採計畫維護視窗切換', '驗證效能基線（vSAN / NFS 儲存 IOPS）', '移交雲端 VMware 維運並建立監控儀表板'] },
      ],
      repurchase: [
        { phase: 'Phase 0 (0–4W)', name: 'SaaS 評估', items: ['市場 SaaS 功能覆蓋率評估（需求 vs 功能矩陣）', 'TCO 比較：自建總擁有成本 vs SaaS 年費', '資料格式與遷移可行性評估（CSV/API Export）', '確認法規允許使用 SaaS（資料落地、個資條款）'] },
        { phase: 'Phase 1 (4–12W)', name: 'SaaS 導入', items: ['SaaS 供應商盡職調查（SOC 2 Type II / ISO 27001）', '簽署 DPA（資料處理協議）與 SLA 合約', '資料清洗、格式轉換與試遷移', 'UAT 與使用者培訓（至少 2 週）'] },
        { phase: 'Phase 2 (12–20W)', name: '切換退場', items: ['平行運行期（4 週）：新舊系統同時運作', '驗證資料完整性（雙向比對）', '切換 DNS / SSO 整合', '舊系統關機前資料封存'] },
      ],
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

    // pocScope = CANDIDATE SELECTION CRITERIA + ENTRY CONDITIONS + SUCCESS GATES
    // (NOT what to do — that belongs in phases)
    const pocScope = {
      relocate:
        '【候選系統條件】已在 vSphere 上運行的非核心 VM；無強依賴本地硬體（GPU/FPGA）；授權可攜帶。' +
        '\n【進入門檻】HCX 環境建置完成；DirectConnect / ExpressRoute 端對端實測延遲 < 30ms；vSAN 儲存政策確認。' +
        '\n【成功標準（Go/No-Go）】VM 搬遷後功能驗收 100%、效能 ≥ 原環境 95%、HCX 回滾時間 < 2 小時、0 個 Sev-1 問題。',
      repurchase:
        '【候選系統條件】SaaS 功能覆蓋率 > 80%；現有資料可依法規完整匯出；現行系統非交易核心。' +
        '\n【進入門檻】法規允許使用 SaaS（書面確認）；DPA 草案完成法務審查；資料分類報告確認可遷移欄位。' +
        '\n【成功標準（Go/No-Go）】資料遷移完整性驗證 100%；關鍵使用者 UAT 通過率 ≥ 95%；使用者培訓完成率 ≥ 90%；SaaS SLA ≥ 99.9%。',
      rehost:
        '【候選系統條件】批次作業或報表服務：無即時交易壓力、外部依賴少、授權明確可移轉。' +
        '\n【進入門檻】Landing Zone 建置驗收完成；DirectConnect / VPN 端對端連線延遲 < 30ms 實測通過。' +
        '\n【成功標準（Go/No-Go）】功能驗收 100%、效能回應時間 ≤ 原系統 110%、切換視窗 < 4 小時、回滾完成時間 < 30 分鐘、0 個 Sev-1 未解決問題。',
      replatform:
        '【候選系統條件】無重度 Stored Procedure 依賴的中介服務；可脫離 Oracle/SQL Server 授權的資料庫；容器化相依不超過 3 層。' +
        '\n【進入門檻】DB Schema 差異分析報告產出；應用程式相依套件版本清單確認；CI/CD 基礎 Pipeline 建置就緒。' +
        '\n【成功標準（Go/No-Go）】RDS 效能 ≥ 原本 95%、容器冷啟動 < 60 秒、CI/CD 部署成功率 > 95%、Auto Scaling 觸發驗證通過。',
      refactor:
        '【候選系統條件】業務邊界清晰的輔助功能（通知服務、報表服務、查詢 API），與核心交易系統無強依賴、資料模型獨立。' +
        '\n【進入門檻】Domain 邊界圖（Bounded Context Map）確認；API 版本策略與 Contract Testing 框架建置完成。' +
        '\n【成功標準（Go/No-Go）】API Contract Testing 通過率 100%、Blue/Green 零停機切換驗證通過、負載測試達到現有系統 TPS × 1.2、服務間延遲 < 50ms P95。',
      retain:
        '【候選範圍】Landing Zone 三核心帳號（Management / Security Tooling / Log Archive），不含工作負載遷移。' +
        '\n【進入門檻】IT 治理架構圖確認；帳號申請與審批流程 SOP 建立；IAM Identity Center 管理員設定完成。' +
        '\n【成功標準（Go/No-Go）】SCPs 策略 100% 套用且無例外；GuardDuty 啟用、0 個已知誤報未處理；CloudTrail 記錄完整驗收（含 S3 Event Logging）；Well-Architected 安全 Pillar 評分 ≥ 70。',
      retire:
        '【候選系統條件】SaaS 功能覆蓋率 > 80%（業務需求對照評估）；現有資料可依法規完整匯出並保存。' +
        '\n【進入門檻】法規允許使用 SaaS 確認（書面）；主要採購合約 / DPA 草案完成法務審查；資料分類報告確認可遷移欄位。' +
        '\n【成功標準（Go/No-Go）】SaaS 功能覆蓋率 ≥ 80%；資料遷移完整性驗證 100%；關鍵使用者 UAT 通過率 ≥ 95%；使用者培訓完成率 ≥ 90%。',
    };

    const collaborators = [
      '雲端架構師',
      'DevOps 工程師',
      isCoreSystemRole(inputs) ? '資安工程師 / 雲端資安顧問' : '資安工程師',
      '專案 PM',
    ];
    if (inputs.cloudMaturity === 'low') collaborators.push('雲端教練 / 培訓講師');
    if (inputs.isMajorOutsource === 'yes') collaborators.push('稽核窗口 / 委外廠商代表');
    collaborators.push('業務單位窗口');

    // dataNeeded = INPUT ARTIFACTS to collect BEFORE project kick-off
    // (documents, reports, data the team needs to hand over — NOT execution steps)
    const dataNeeded = [];
    dataNeeded.push('系統相依關係圖（Application Dependency Map）—含所有外部 API、DB、訊息佇列、檔案共享');
    dataNeeded.push('現有主機 / VM 規格清單（CPU、記憶體、磁碟 IO 基線、網路吞吐量實測值）');
    if (!inputs.txVolume) dataNeeded.push('過去 12 個月 TPS 高峰值、日活用戶數、批次執行時間視窗');
    dataNeeded.push('軟體授權清單（OS、DB、Middleware）及雲端 License Mobility 資格確認');
    dataNeeded.push('現有 IP / VLAN 網路架構圖（含防火牆規則、NAT、DNS 設定）');
    if (inputs.hasPersonalData === 'yes') dataNeeded.push('個資盤點報告（存儲位置、欄位清單、保存期限、境外傳輸規定）');
    if (inputs.hasExternalIntegration === 'yes') dataNeeded.push('外部系統整合 SLA 合約與 API 規格文件（包含錯誤處理與重試機制）');
    if (isLegacy) dataNeeded.push('技術債量化報告（程式碼年齡分布、已知缺陷 / 未修補漏洞清單、相依套件版本）');
    dataNeeded.push('現行 DR / BCP 計畫文件、RTO / RPO 需求及最近一次演練結果');

    // techValidation = PRE-MIGRATION TECHNICAL GATES (proof points before go-live commitment)
    // (validation tests / confirmations — NOT execution steps which belong in phases)
    const techValidation = [
      '【網路】Cloud Region 往返延遲實測（DirectConnect / VPN 建置後）< 30ms，符合應用 SLA',
      '【授權】商業軟體 License Mobility 確認（SQL Server / Oracle / SAP），避免遷移後授權費突增',
      '【安全】Well-Architected Review — 安全 Pillar 基線評分取得，作為遷移後改善對比基準',
      '【合規】GuardDuty + Security Hub + Config Rules 啟用，0 個 Critical 問題未處理',
    ];
    if (inputs.needDR === 'yes')
      techValidation.push('【可用性】DR Failover 實測：跨 Region 切換 RTO < 4 小時、RPO < 1 小時，含回切演練');
    if (inputs.archType === 'monolith')
      techValidation.push('【容器化】目標模組容器化 Spike：啟動時間 < 90 秒，相依性無衝突，記憶體用量在規格內');
    if (inputs.hasFinancialData === 'yes' || inputs.complianceLevel === 'high')
      techValidation.push('【法遵】PCI-DSS / ISO 27001 基線掃描通過，無 High / Critical 缺口未處理');

    // procurementRisks = advisory warnings for legacy system migration
    // Triggered when system is old, financial sector, or involves large-scale conversion
    const procurementRisks = [];
    if (isLegacy || isFinancial || strat === 'refactor') {
      procurementRisks.push({
        icon: '⚠️',
        title: '通用性限制：自動化遷移工具的技術覆蓋邊界',
        desc: '自動化轉換工具（含 COBOL / PL/I / Assembler 類型）通常高度聚焦特定技術棧，對混合語言或非主流 DB（VSAM、IMS）的支援有限。建議在 PoC 前確認工具技術覆蓋矩陣（Coverage Matrix），避免 PoC 後才發現關鍵模組不在支援範圍內。',
      });
      procurementRisks.push({
        icon: '⚠️',
        title: '黑盒子轉換風險：技術債轉移而非消除',
        desc: '自動轉換產出的程式碼往往保留原有邏輯結構，形成「新平台上的舊程式」，程式碼可讀性低、單元測試覆蓋率通常 < 30%、後期維護成本不低於原系統。建議合約中要求廠商提供：轉換後靜態分析報告、測試覆蓋率指標，並設定驗收門檻（建議可讀性評分 ≥ 60 / 測試覆蓋率 ≥ 50%）。',
      });
      procurementRisks.push({
        icon: '⚠️',
        title: 'DevOps 工具鏈衝突：現有流程整合成本',
        desc: '引入雲端遷移平台可能與現有 CI/CD（Jenkins / GitLab）、監控（Datadog / Splunk）、ITSM（ServiceNow）產生整合落差。應在採購前盤點工具鏈相容性，要求廠商提供標準 Webhook / Open API 整合文件，並在 PoC 中驗證端對端 Pipeline 是否能無縫接入，避免形成隱性供應商鎖定。',
      });
    }

    return {
      phases: phases[strat] || phases.rehost,
      pocScope: pocScope[strat] || '',
      collaborators,
      dataNeeded,
      techValidation,
      procurementRisks,
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

  // ── Readiness helper — risk-adjusted ─────────────────────
  // Readiness 必須反映風險：高風險策略不可能高度就緒
  // riskScore: 0–100；lzReadiness: 0–100
  function calcReadiness(lzReadiness, riskScore) {
    const penalty = riskScore >= 80 ? 42 : riskScore >= 65 ? 26 : riskScore >= 50 ? 14 : 0;
    const cap     = riskScore >= 80 ? 52 : riskScore >= 65 ? 70 : riskScore >= 50 ? 84 : 96;
    return Math.min(cap, Math.max(10, Math.round(lzReadiness - penalty)));
  }

  // ── What-If Scenario Engine ───────────────────────────────
  // Synchronous (instant, no API call) — for real-time slider updates

  const STRATEGY_META = {
    rehost: {
      label: '直接遷移 (Rehost)', icon: '🚚', color: '#3b82f6',
      costMult: 1.00, riskDelta: -5,  timelineMult: 0.6,
      advantage: '速度最快、初期投入最低，6 個月可見效',
      tradeoff:  '雲端最佳化效益有限，長期維護成本不減',
      roiNote:   '約 12–18 個月回本',
    },
    relocate: {
      label: '平台搬遷 (Relocate)', icon: '🔄', color: '#0ea5e9',
      costMult: 1.05, riskDelta: -8, timelineMult: 0.7,
      advantage: '保留 VMware 操作習慣，無需修改程式碼，搬遷風險低',
      tradeoff:  '需要 VMware Cloud 授權費用，長期 TCO 高於原生雲',
      roiNote:   '約 18–24 個月回本（含 VMware 授權調整）',
    },
    repurchase: {
      label: 'SaaS 替換 (Repurchase)', icon: '🛒', color: '#06b6d4',
      costMult: 0.70, riskDelta: -5, timelineMult: 0.5,
      advantage: '無基礎設施維護負擔，快速取得新功能，降低技術債',
      tradeoff:  '客製化能力受限，資料遷移需仔細規劃，SaaS 廠商鎖定風險',
      roiNote:   '約 12–24 個月回本（視現有系統維護成本）',
    },
    replatform: {
      label: '平台調整 (Replatform)', icon: '⚙️', color: '#10b981',
      costMult: 1.25, riskDelta: 0,  timelineMult: 1.0,
      advantage: '兼顧速度與最佳化，RDS/容器化後成本下降 20–35%',
      tradeoff:  '需要中等工程投入，部分模組需重新測試',
      roiNote:   '約 18–26 個月回本',
    },
    refactor: {
      label: '架構重構 (Refactor)', icon: '🔬', color: '#8b5cf6',
      costMult: 1.80, riskDelta: +18, timelineMult: 2.2,
      advantage: '長期 TCO 最低，雲原生彈性最高，AI/ML 整合最佳',
      tradeoff:  '時程最長（12–24 個月），短期成本最高，人力需求大',
      roiNote:   '約 36–48 個月回本',
    },
    retain: {
      label: '暫緩保留 (Retain)', icon: '⏸️', color: '#f59e0b',
      costMult: 0.50, riskDelta: -12, timelineMult: 0.3,
      advantage: '短期成本最低，遷移風險規避，可先建 Landing Zone',
      tradeoff:  '錯失上雲效益，技術債持續累積，市場競爭力下滑',
      roiNote:   '未計算（保留策略無遷移 ROI）',
    },
    retire: {
      label: '下線退場 (Retire)', icon: '🗑️', color: '#ef4444',
      costMult: 0.10, riskDelta: -15, timelineMult: 0.4,
      advantage: '徹底消除維護負擔，最佳化整體系統組合',
      tradeoff:  '需處理資料歸檔與使用者遷移，確認功能真的不再需要',
      roiNote:   '立即節省維護成本',
    },
  };

  // DB retention scenario — simulates hybrid architecture (DB on-premise + compute on cloud)
  function applyDbOnPremOverride(inputs) {
    return {
      ...inputs,
      hasExternalIntegration: 'yes',   // DB is now "external" system
      _dbOnPremPremium: 1800,           // USD/month for ExpressRoute/DirectConnect
      _dbOnPremNote: 'DB2 地端保留：混合架構需支付 ExpressRoute/DirectConnect 費用 +$1,800/月',
    };
  }

  // calcTimeline: sum phase weeks → total months
  function calcTimeline(phases) {
    const totalWeeks  = phases.reduce((sum, p) => {
      // parse "Phase X (0–4W)" → extract last number before W
      const m = (p.phase || '').match(/(\d+)W\)?$/);
      return sum + (m ? parseInt(m[1]) : (p.weeks || 4));
    }, 0);
    const totalMonths = Math.round(totalWeeks / 4.3);
    return {
      phases,
      totalWeeks,
      totalMonths,
      displayString: `約 ${totalMonths} 個月（${totalWeeks} 週）`,
    };
  }

  // Compute timeline estimate in weeks from inputs + strategy
  function estimateTimelineWeeks(inputs, strategy) {
    const base = { rehost: 24, relocate: 24, repurchase: 20, replatform: 32, refactor: 56, retain: 20, retire: 20 };
    let weeks = base[strategy] || 28;
    if (inputs.cloudMaturity === 'low')    weeks = Math.round(weeks * 1.3);
    if (inputs.cloudMaturity === 'high')   weeks = Math.round(weeks * 0.8);
    if (inputs.techDebt === 'high')        weeks = Math.round(weeks * 1.2);
    if (inputs.isCoreSystem === 'yes')     weeks = Math.round(weeks * 1.15);
    if (inputs.complianceLevel === 'high') weeks = Math.round(weeks * 1.25);
    return weeks;
  }

  // Synchronous runner — re-runs key functions with overridden inputs
  function runScenario(baseInputs, overrides) {
    const inputs    = { ...baseInputs, ...overrides };
    const strategy6R = determine6R(inputs);
    const cost      = estimateCost(inputs);
    const risk      = assessRisk(inputs);
    const kpi       = calcKPIs(inputs, strategy6R.primary);

    // Apply DB on-prem hybrid premium to cost
    const monthlyMid = cost.mid + (inputs._dbOnPremPremium || 0);

    return {
      strategy6R,
      cost: { ...cost, mid: monthlyMid, low: cost.low + (inputs._dbOnPremPremium || 0) * 0.85, high: cost.high + (inputs._dbOnPremPremium || 0) * 1.1 },
      risk,
      kpi,
      readiness:  calcReadiness(kpi.lzReadiness, risk.overall),
      riskScore:  risk.overall,
      timelineWks: estimateTimelineWeeks(inputs, strategy6R.primary),
      dbNote:     inputs._dbOnPremNote || null,
    };
  }

  // Compare all 4 strategies side-by-side given same base inputs
  function compareStrategies(baseInputs) {
    const base = runScenario(baseInputs, {});
    return Object.entries(STRATEGY_META).map(([strat, meta]) => {
      const kpi  = calcKPIs(baseInputs, strat);
      const cost = Math.round(base.cost.mid * meta.costMult);
      const risk = Math.min(95, Math.max(10, base.risk.overall + meta.riskDelta));
      const wks  = estimateTimelineWeeks(baseInputs, strat);
      return {
        strategy: strat, ...meta,
        monthlyCost: cost,
        riskScore:   risk,
        readiness:   calcReadiness(kpi.lzReadiness, risk),   // risk-adjusted!
        timelineWks: wks,
        isRecommended: strat === base.strategy6R.primary,
      };
    });
  }

  // ── Compliance Framework Filter ──────────────────────────
  const COMPLIANCE_MAP = {
    'tw-financial':  ['金管會雲端委外規範', '金融機構作業委託他人處理辦法', '金融資安規範', '個人資料保護法', 'ISO 27001', 'ISO 27017'],
    'tw-general':    ['個人資料保護法', 'ISO 27001'],
    'sg-financial':  ['MAS TRM', 'MAS TRMG', 'PDPA'],
    'hk-financial':  ['HKMA ORMIC', 'PDPO'],
    'eu-general':    ['GDPR', 'DORA（如為金融機構）'],
    'generic':       ['ISO 27001', 'SOC 2 Type II（供應商參考用）'],
  };

  function getComplianceFramework(inputs) {
    const region   = (inputs.region || '').toLowerCase();
    const industry = (inputs.industry || '').toLowerCase();
    const isFinancial = ['financial', 'banking', 'insurance', 'finance', '銀行', '金融', '保險'].some(k => industry.includes(k));
    const isTW = region.includes('tw') || region.includes('台灣') || region.includes('taiwan') || !region;
    const isSG = region.includes('sg') || region.includes('singapore') || region.includes('新加坡');
    const isHK = region.includes('hk') || region.includes('hong kong') || region.includes('香港');
    const isEU = region.includes('eu') || region.includes('europe') || region.includes('歐洲');

    if (isFinancial && isTW)  return { key: 'tw-financial',  frameworks: COMPLIANCE_MAP['tw-financial'],  crossBorderNote: null };
    if (isFinancial && isSG)  return { key: 'sg-financial',  frameworks: COMPLIANCE_MAP['sg-financial'],  crossBorderNote: null };
    if (isFinancial && isHK)  return { key: 'hk-financial',  frameworks: COMPLIANCE_MAP['hk-financial'],  crossBorderNote: null };
    if (isTW)                 return { key: 'tw-general',    frameworks: COMPLIANCE_MAP['tw-general'],    crossBorderNote: null };
    if (isEU)                 return { key: 'eu-general',    frameworks: COMPLIANCE_MAP['eu-general'],    crossBorderNote: null };
    return                           { key: 'generic',       frameworks: COMPLIANCE_MAP['generic'],       crossBorderNote: null };
  }

  // ── ESG / Carbon Region Recommendation ───────────────────
  function getEsgRecommendation(inputs) {
    const industry = (inputs.industry || '').toLowerCase();
    const isFinancial = ['financial', 'banking', 'insurance', 'finance', '銀行', '金融', '保險'].some(k => industry.includes(k));
    const isHighCompliance = inputs.complianceLevel === 'high';

    if (isFinancial || isHighCompliance) {
      return {
        crossRegionMigration: false,
        primaryApproach: '節能架構優先',
        recommendation: '優先使用企業核准之雲端區域，以節能架構（Rightsizing、Auto Scaling、儲存生命週期管理）降低碳排，不建議以跨國搬遷作為主要減碳手段',
        architectureActions: [
          'Rightsizing：定期分析 CPU/Memory 使用率，消除過度配置',
          'Auto Scaling：配合業務流量自動縮減，避免閒置資源浪費',
          '儲存生命週期管理：冷資料轉 S3 Glacier，降低儲存碳足跡',
          '服務整合：合併低使用率工作負載，提高資源密度',
        ],
        lowCarbonRegionNote: '低碳區域（如 eu-north-1 Stockholm）僅供非核心、非敏感工作負載參考，需確認資料落地與跨境傳輸規範後方可採用',
        carbonReductionEstimate: '10–25%（透過架構優化，不含跨境搬遷）',
      };
    }

    // General case — can recommend low-carbon regions
    return {
      crossRegionMigration: true,
      primaryApproach: '低碳區域 + 架構優化',
      recommendation: '建議優先選用低碳強度雲端區域，並搭配節能架構設計，達到最大化減碳效果',
      architectureActions: [
        '選用低碳強度 Region（eu-north-1 Stockholm: ~8 gCO₂/kWh）',
        'Rightsizing + Auto Scaling 消除閒置資源',
        '儲存生命週期管理降低冷資料碳足跡',
        '使用 Carbon Footprint Tool（AWS / Azure）定期監控',
      ],
      lowCarbonRegionNote: null,
      carbonReductionEstimate: '20–40%（低碳 Region + 架構優化）',
    };
  }

  // ── Domain Classifier + Bounded Context Templates ────────
  const DOMAIN_CONTEXTS = {
    banking:    ['Customer', 'Account', 'Ledger', 'Transaction', 'Payment', 'Settlement', 'Batch', 'Reporting', 'Interface', 'Risk', 'Auth', 'Audit'],
    insurance:  ['Policy', 'Claim', 'Premium', 'Underwriting', 'Customer', 'Agent', 'Reinsurance', 'Compliance'],
    healthcare: ['Patient', 'Appointment', 'EMR', 'Billing', 'Pharmacy', 'Lab', 'Compliance'],
    retail:     ['Order', 'Inventory', 'Price', 'Customer', 'CRM', 'Logistics', 'Payment'],
    generic:    ['AppCore', 'Auth', 'Notification', 'Reporting', 'DataStore', 'Integration', 'Admin'],
  };

  function classifyDomain(inputs) {
    const industry = (inputs.industry || '').toLowerCase();
    const sysName  = (inputs.systemName || inputs.projectName || '').toLowerCase();
    if (industry.includes('financial') || industry.includes('banking') || industry.includes('finance') ||
        sysName.includes('帳務') || sysName.includes('銀行') || sysName.includes('金融')) return 'banking';
    if (industry.includes('insurance') || sysName.includes('保險')) return 'insurance';
    if (industry.includes('healthcare') || industry.includes('medical') || sysName.includes('醫療') || sysName.includes('病歷')) return 'healthcare';
    if (industry.includes('retail') || industry.includes('ecommerce') || sysName.includes('零售') || sysName.includes('電商')) return 'retail';
    return 'generic';
  }

  // ── Report Validation ────────────────────────────────────
  function validateReport(result) {
    const issues = [];

    // 1. Primary strategy matches highest score
    const scoresEntries = Object.entries(result.strategy6R?.scores || {}).sort((a, b) => b[1] - a[1]);
    if (scoresEntries.length && result.strategy6R?.primary !== scoresEntries[0]?.[0]) {
      issues.push({ severity: 'error', code: 'STRAT-001', message: `Primary strategy (${result.strategy6R?.primary}) does not match highest score (${scoresEntries[0]?.[0]})`, section: 'strategy' });
    }

    // 2. All 7R present
    const REQUIRED_7R = ['rehost', 'relocate', 'repurchase', 'replatform', 'refactor', 'retain', 'retire'];
    REQUIRED_7R.forEach(k => {
      if (!(k in (result.strategy6R?.scores || {}))) {
        issues.push({ severity: 'warning', code: 'STRAT-002', message: `Missing strategy score: ${k}`, section: 'strategy' });
      }
    });

    // 3. Cost consistency — saving shown without baseline
    if (result.costEstimate?.monthlySavingMedian != null && !result.inputs?.currentMonthlyCost) {
      issues.push({ severity: 'error', code: 'COST-001', message: '月節省金額顯示時未輸入現行成本基準', section: 'cost' });
    }

    // 4. ROI without baseline
    if (result.costEstimate?.roiMonths != null && !result.inputs?.currentMonthlyCost) {
      issues.push({ severity: 'error', code: 'COST-002', message: 'ROI 回本月數計算時未輸入現行成本基準', section: 'cost' });
    }

    // 5. Timeline consistency
    if (result.techPM?.phases) {
      const weekSum = result.techPM.phases.reduce((s, p) => {
        const m = (p.phase || '').match(/(\d+)W\)?$/);
        return s + (m ? parseInt(m[1]) : 4);
      }, 0);
      const expectedMonths = Math.round(weekSum / 4.3);
      if (result.costEstimate && Math.abs(expectedMonths - Math.round(weekSum / 4.3)) > 1) {
        // self-consistent check — warn if displayed totalMonths differs
      }
      if (weekSum > 0) {
        const displayedMonths = result._timelineMonths || 0;
        if (displayedMonths > 0 && Math.abs(displayedMonths - expectedMonths) > 1) {
          issues.push({ severity: 'warning', code: 'TIME-001', message: `Timeline months (${displayedMonths}) inconsistent with phase week sum (${weekSum} wks ≈ ${expectedMonths} mo)`, section: 'timeline' });
        }
      }
    }

    // 6. ESG region check for banking
    const domain = result._domain || classifyDomain(result.inputs || {});
    if (result.sustainability?.recommended_region === 'eu-north-1' && domain === 'banking') {
      issues.push({ severity: 'error', code: 'ESG-001', message: 'Stockholm (eu-north-1) 被推薦給銀行系統 — 違反資料落地要求', section: 'esg' });
    }

    return issues;
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
    const domain     = classifyDomain(inputs);
    const boundedContexts = DOMAIN_CONTEXTS[domain] || DOMAIN_CONTEXTS.generic;
    const esgRec     = getEsgRecommendation(inputs);
    const complianceFramework = getComplianceFramework(inputs);

    // Build unified cost model — only show saving/ROI when baseline provided
    const currentMonthlyCost = parseFloat(inputs.currentMonthlyCost) || null;
    const monthlySavingMedian = currentMonthlyCost ? Math.round(currentMonthlyCost - cost.mid) : null;
    const oneTimeMedian = Math.round((cost.migrationLow + cost.migrationHigh) / 2);
    const roiMonths = (currentMonthlyCost && monthlySavingMedian > 0)
      ? Math.ceil(oneTimeMedian / monthlySavingMedian)
      : null;
    const costModel = {
      ...cost,
      monthlyCloudLow:    cost.low,
      monthlyCloudMedian: cost.mid,
      monthlyCloudHigh:   cost.high,
      oneTimeLow:         cost.migrationLow,
      oneTimeHigh:        cost.migrationHigh,
      oneTimeMedian,
      currentMonthlyCost,
      monthlySavingMedian,
      roiMonths,
      limitations: [
        'ROM 估算：±30–50% 精度，不適合作為正式採購預算',
        '不含授權費（OS/DB/中介軟體）、跨境網路費、合規工具',
        ...(currentMonthlyCost ? [] : ['未輸入現行成本：節省金額與 ROI 無法計算']),
      ],
    };

    // Build timeline from phases
    const timelineObj = calcTimeline(techPM.phases);

    const result = {
      id: `analysis_${Date.now()}`,
      timestamp: new Date().toISOString(),
      inputs,
      strategy6R,
      landingZone: lz,
      costEstimate: costModel,
      riskRadar: risk,
      kpi,
      executiveSummary: exec,
      presentation: slides,
      techPM: { ...techPM, timeline: timelineObj },
      nextSteps,
      decisions,
      domain,
      boundedContexts,
      esgRecommendation: esgRec,
      complianceFramework,
      _domain: domain,
      _timelineMonths: timelineObj.totalMonths,
    };

    // Validate and attach issues
    result._validationIssues = validateReport(result);

    return result;
  }

  // ── Compliance Checklist Engine ───────────────────────────────────────────
  /**
   * runComplianceCheck(inputs)
   * 逐條比對系統特徵與法規要求，回傳 checklist 陣列。
   * @param {object} inputs  - 分析表單輸入
   * @returns {Array<{id, framework, title, jurisdiction, status, reason, remedy, authority}>}
   */
  function runComplianceCheck(inputs) {
    const cf = getComplianceFramework(inputs);
    if (!cf || cf.key === 'generic') return [];

    // 從 RULES_CONFIG 取得適用規則池
    const allRules = (window.__RULES_CONFIG__ && window.__RULES_CONFIG__.compliance)
      ? Object.values(window.__RULES_CONFIG__.compliance).flat()
      : [];
    if (!allRules.length) return [];

    // jurisdiction → framework key 對應
    const JURISDICTION_KEY = {
      'MAS (新加坡金融管理局)':  'sg-financial',
      'HKMA (香港金融管理局)':   'hk-financial',
      '台灣 FSC 金管會':          'tw-financial',
      '台灣 FSC 銀行局':          'tw-financial',
      '台灣 FSC 保險局':          'tw-financial',
      '台灣 FSC 證期局':          'tw-financial',
      'APRA (澳洲審慎監理局)':   'apra-financial',
      'EU DORA（2025 生效）':     'eu-general',
    };

    // 篩選與目前 framework 相關的規則
    const applicableRules = allRules.filter(r => {
      const rKey = JURISDICTION_KEY[r.jurisdiction];
      if (!rKey) return false;
      // 同一 key 完全匹配，或同為 tw-financial 系列
      return rKey === cf.key || (cf.key === 'tw-financial' && rKey === 'tw-financial');
    });

    if (!applicableRules.length) return [];

    // 判斷每條規則的符合狀態
    const sla         = (inputs.slaLevel || '').toLowerCase();
    const rto         = parseFloat(inputs.rtoHours || '99');
    const outsource   = inputs.hasMajorOutsource === 'yes' || inputs.outsource === 'yes';
    const hasPII      = inputs.hasPersonalData === 'yes' || inputs.hasPII === 'yes';
    const isCore      = inputs.systemCriticality === 'high' || inputs.systemCriticality === 's1';
    const singleCSP   = !(inputs.multiCloud === 'yes');
    const crossBorder = inputs.crossBorderData === 'yes' || inputs.hasCrossBorderData === 'yes';
    const compLevel   = inputs.complianceLevel || 'medium';

    return applicableRules.map(rule => {
      let status = 'review';   // default: need confirmation
      let reason = '需人工確認是否已符合本項要求';

      switch (rule.id) {
        case 'HKMA-001':
        case 'MAS-001':
          if (isCore || sla === '24x7' || rto <= 4) {
            status = 'fail';
            reason = `系統重要性高（${isCore ? 'S1 核心' : `SLA ${sla}`}），需確認 RTO ≤ 4hr 及年度 DR 演練已規劃`;
          } else {
            status = 'review';
            reason = '系統重要性未明確，建議確認是否落入「重要系統」定義';
          }
          break;
        case 'HKMA-002':
        case 'MAS-002':
          if (outsource && singleCSP) {
            status = 'fail';
            reason = '存在重大委外且依賴單一 CSP，需建立 Exit Plan 並申報集中度風險';
          } else if (outsource) {
            status = 'review';
            reason = '存在重大委外，需確認是否已向監管機構申報';
          } else {
            status = 'pass';
            reason = '未偵測到需申報的重大委外情境';
          }
          break;
        case 'HKMA-003':
        case 'MAS-003':
          if (hasPII && crossBorder) {
            status = 'fail';
            reason = '系統含個資且存在跨境傳輸，需確認符合 PDPO/PDPA 跨境傳輸規定';
          } else if (hasPII) {
            status = 'review';
            reason = '系統含個資，建議確認資料儲存地點是否符合境內要求';
          } else {
            status = 'pass';
            reason = '未偵測到個人資料跨境傳輸情境';
          }
          break;
        case 'FSC-001':
        case 'FSC-BANK-001':
          if (compLevel === 'high') {
            status = 'fail';
            reason = '高度法遵等級，需確認資料主權（境內 Region）及委外稽核契約條款';
          } else {
            status = 'review';
            reason = '建議確認委外合約包含稽核權及資料主權條款';
          }
          break;
        case 'FSC-002':
          status = 'review';
          reason = 'CSP 的 SOC 2 Type II 及 ISO 27001 報告需納入年度 TPRM 評核';
          break;
        default:
          status = 'review';
          reason = '需人工確認是否已符合本項要求';
      }

      return {
        id:           rule.id,
        framework:    rule.jurisdiction,
        title:        rule.title,
        jurisdiction: rule.jurisdiction,
        severity:     rule.severity || 'high',
        status,
        reason,
        remedy:       rule.remedy,
        authority:    rule.authority,
      };
    });
  }

  return {
    analyze,
    determine6R, determineLandingZone, estimateCost, assessRisk, calcKPIs,
    // What-If scenario engine
    runScenario, compareStrategies, applyDbOnPremOverride, STRATEGY_META,
    // New 7R / compliance / ESG / domain
    getComplianceFramework, getEsgRecommendation, classifyDomain,
    DOMAIN_CONTEXTS, COMPLIANCE_MAP, calcTimeline, validateReport,
    // Compliance Checklist
    runComplianceCheck,
  };

})();

window.AnalyzeEngine = AnalyzeEngine;
