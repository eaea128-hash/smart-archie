/**
 * risk-rules.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * 所有風險判斷規則的唯一來源（Single Source of Truth）。
 *
 * 設計原則：
 *  - 每條規則都有 ruleId、policySource、policyReference
 *  - evaluateRules() 回傳 triggered 規則清單，供 UI 完整顯示觸發原因
 *  - 不做黑箱判斷：所有評分都由此檔的規則加總產生
 */

import type { System, Vendor, RiskLevel } from "@/data/demo-data";

// ─── Types ─────────────────────────────────────────────────────────────────────

export interface RiskRule {
  ruleId: string;
  name: string;
  description: string;
  policySource: string;
  policyReference: string;
  category: "hndl" | "crypto" | "vendor" | "external" | "criticality";
  scoreContribution: number;
  test: (sys: System, vendor: Vendor | null) => boolean;
  triggerMessage: (sys: System, vendor: Vendor | null) => string;
}

export interface TriggeredRule {
  rule: RiskRule;
  message: string;
  contribution: number;
}

export interface RuleEvaluationResult {
  rawScore: number;
  finalScore: number;
  riskLevel: RiskLevel;
  triggeredRules: TriggeredRule[];
  criticalityMultiplier: number;
}

export interface RiskExplanation {
  riskLevel: RiskLevel;
  score: number;
  summary: string;
  reasons: string[];
  policySources: string[];
  triggeredRules: TriggeredRule[];
}

// ─── Rule definitions ──────────────────────────────────────────────────────────

export const RISK_RULES: RiskRule[] = [
  // ── HNDL: Data Retention ──────────────────────────────────────────────────
  {
    ruleId: "RULE-HNDL-01",
    name: "長期保存敏感資料（≥ 10 年）",
    description: "資料保存年限超過 10 年的敏感系統，面臨 HNDL 攻擊風險最高。攻擊者可今日攔截加密傳輸，等 2030–2035 年量子電腦成熟後解密。",
    policySource: "CISA PQC Roadmap 2023",
    policyReference: "CISA Quantum Readiness — HNDL Threat Prioritization",
    category: "hndl",
    scoreContribution: 30,
    test: (sys) => {
      const yr = sys.dataRetentionYears;
      const sensitive = SENSITIVE_KW.some(kw => sys.dataTypes.some(dt => dt.includes(kw)));
      return (yr >= 10 || yr >= 99) && sensitive;
    },
    triggerMessage: (sys) =>
      `資料保存 ${sys.dataRetentionYears >= 99 ? "永久" : sys.dataRetentionYears + " 年"}，包含敏感資料（${sys.dataTypes.slice(0,2).join("、")}）— 超過 HNDL 高風險閾值`,
  },
  {
    ruleId: "RULE-HNDL-02",
    name: "中期保存敏感資料（5–9 年）",
    description: "5–9 年保存年限雖尚未達到最高風險，但量子威脅時間窗口重疊，需列入追蹤。",
    policySource: "CISA PQC Roadmap 2023",
    policyReference: "CISA Quantum Readiness — Data Classification for PQC Priority",
    category: "hndl",
    scoreContribution: 15,
    test: (sys) => {
      const yr = sys.dataRetentionYears;
      const sensitive = SENSITIVE_KW.some(kw => sys.dataTypes.some(dt => dt.includes(kw)));
      return yr >= 5 && yr < 10 && sensitive;
    },
    triggerMessage: (sys) =>
      `資料保存 ${sys.dataRetentionYears} 年，包含敏感資料，接近量子威脅時間窗（2030–2035）`,
  },

  // ── Crypto signals ────────────────────────────────────────────────────────
  {
    ruleId: "RULE-CRYPTO-01",
    name: "使用量子脆弱演算法（RSA / ECC）",
    description: "CMDB 或加密信號顯示系統使用 RSA 或 ECC。這兩個演算法在量子電腦下可被 Shor's algorithm 破解，是 PQC 遷移的主要對象。",
    policySource: "NIST SP 800-131A Rev.3",
    policyReference: "Transitioning the Use of Cryptographic Algorithms and Key Lengths",
    category: "crypto",
    scoreContribution: 20,
    test: (sys) => {
      const signals = [...sys.cryptoSignals, ...sys.cmdbTags].join(" ").toLowerCase();
      return signals.includes("rsa") || signals.includes("ecc");
    },
    triggerMessage: (sys) => {
      const found = sys.cryptoSignals.filter(s => /rsa|ecc/i.test(s));
      return `偵測到量子脆弱演算法：${found.join("、") || "RSA / ECC"}，需納入 PQC 遷移計畫`;
    },
  },
  {
    ruleId: "RULE-CRYPTO-02",
    name: "存在 Legacy TLS / Legacy 憑證",
    description: "CMDB 標記 legacy certificate 或系統使用 TLS 1.0/1.1，不符合 NIST 目前標準，且已屬量子威脅前線。",
    policySource: "NIST SP 800-131A Rev.3",
    policyReference: "Section 3.2 — TLS Protocol Versions",
    category: "crypto",
    scoreContribution: 15,
    test: (sys) => {
      const all = [...sys.cryptoSignals, ...sys.cmdbTags].join(" ").toLowerCase();
      return all.includes("legacy") || all.includes("tls 1.1") || all.includes("tls 1.0");
    },
    triggerMessage: (sys) => {
      const tags = sys.cmdbTags.filter(t => t.includes("legacy"));
      return `偵測到 legacy 加密標記：${tags.join("、") || "legacy TLS / certificate"}，需立即稽核`;
    },
  },
  {
    ruleId: "RULE-CRYPTO-03",
    name: "未確認加密模組（unknown crypto）",
    description: "CMDB 標記 unknown crypto module 代表系統加密依存未被盤點，無法評估完整遷移工作量。",
    policySource: "NIST SP 1800-38B",
    policyReference: "Cryptographic Discovery and Inventory — CBOM Requirements",
    category: "crypto",
    scoreContribution: 12,
    test: (sys) => {
      const all = [...sys.cryptoSignals, ...sys.cmdbTags].join(" ").toLowerCase();
      return all.includes("unknown");
    },
    triggerMessage: () => "存在未確認加密模組（unknown crypto module），CBOM 盤點不完整，遷移工作量無法估算",
  },
  {
    ruleId: "RULE-CRYPTO-04",
    name: "JWT RS256 / PKI / XML 簽章",
    description: "JWT RS256、PKI 簽章或 XML signature 均使用 RSA 演算法，需替換為後量子版本（Dilithium / FALCON）。",
    policySource: "NIST SP 1800-38B",
    policyReference: "Cryptographic Discovery and Inventory — Signature Algorithms",
    category: "crypto",
    scoreContribution: 8,
    test: (sys) => {
      const all = [...sys.cryptoSignals, ...sys.cmdbTags].join(" ").toLowerCase();
      return all.includes("jwt") || all.includes("pki") || all.includes("xml signature") || all.includes("xml sig");
    },
    triggerMessage: (sys) => {
      const found = sys.cryptoSignals.filter(s => /jwt|pki|xml/i.test(s));
      return `使用 ${found.join("、") || "JWT / PKI / XML Signature"}，簽章演算法需替換為後量子版本`;
    },
  },

  // ── External exposure ─────────────────────────────────────────────────────
  {
    ruleId: "RULE-EXT-01",
    name: "具外部 API 串接",
    description: "與外部機構或第三方 API 串接的系統，傳輸資料更可能被攔截，是 HNDL 攻擊的主要目標。",
    policySource: "Internal API-SEC-STD Rev.1.5",
    policyReference: "Section 4 — External API Exposure Classification",
    category: "external",
    scoreContribution: 10,
    test: (sys) => sys.hasExternalApi,
    triggerMessage: (sys) =>
      `具 ${sys.externalParties.length || "多個"} 個外部 API 串接對象（${sys.externalParties.slice(0,2).join("、") || "待補件"}），傳輸加密強度待確認`,
  },
  {
    ruleId: "RULE-EXT-02",
    name: "外部串接對象未填寫（缺口）",
    description: "系統標記有外部 API 但未列出串接對象，資安無法評估每個串接點的加密強度。",
    policySource: "FSC 金融資安韌性修訂草案 2026",
    policyReference: "Section 6.1 — 跨機構 API 串接點揭露要求",
    category: "external",
    scoreContribution: 5,
    test: (sys) => sys.hasExternalApi && sys.externalParties.length === 0,
    triggerMessage: () => "系統標記有外部 API，但未填寫任何外部串接對象 — 需補件（FSC 草案要求逐點列明）",
  },

  // ── Vendor ────────────────────────────────────────────────────────────────
  {
    ruleId: "RULE-VENDOR-01",
    name: "供應商未提供 PQC 遷移計畫",
    description: "若供應商無 PQC 遷移計畫，代表其尚未規劃後量子遷移，本系統的遷移計畫將受阻。",
    policySource: "FSC 科技外包要點",
    policyReference: "Section 5.3 — Vendor Technology Resilience Assessment",
    category: "vendor",
    scoreContribution: 12,
    test: (sys, vendor) => !!sys.vendorId && !!vendor && vendor.pqcRoadmapStatus === "未提供",
    triggerMessage: (_, vendor) =>
      `供應商 ${vendor?.vendorName ?? ""} 尚未提供 PQC 遷移計畫，是本系統遷移計畫的主要阻礙`,
  },
  {
    ruleId: "RULE-VENDOR-02",
    name: "供應商加密調整能力不支援或未確認",
    description: "不支援加密調整能力的供應商無法在不中斷服務下替換演算法，遷移時需停機或大規模改版，成本與風險倍增。",
    policySource: "NIST SP 1800-38B",
    policyReference: "Section 4.3 — Crypto-Agility Assessment Framework",
    category: "vendor",
    scoreContribution: 8,
    test: (sys, vendor) =>
      !!sys.vendorId && !!vendor &&
      (vendor.cryptoAgilityStatus === "不支援" || vendor.cryptoAgilityStatus === "未確認"),
    triggerMessage: (_, vendor) =>
      `供應商 ${vendor?.vendorName ?? ""} 的加密調整能力狀態為「${vendor?.cryptoAgilityStatus}」，遷移時可能需要停機改版`,
  },
  {
    ruleId: "RULE-VENDOR-03",
    name: "供應商合約無技術升級條款",
    description: "缺乏加密升級條款的合約無法強制供應商執行 PQC 遷移，形成治理空白。",
    policySource: "Internal PROC-TECH-CLAUSE Rev.1.2",
    policyReference: "Section 7 — Cryptographic Migration Rights",
    category: "vendor",
    scoreContribution: 6,
    test: (sys, vendor) => !!sys.vendorId && !!vendor && vendor.contractUpgradeClause === "無",
    triggerMessage: (_, vendor) =>
      `供應商 ${vendor?.vendorName ?? ""} 合約缺乏加密技術升級義務條款，需在下次合約更新時補入`,
  },
];

// ─── Sensitive keywords (same as hndl-risk.ts) ────────────────────────────────

const SENSITIVE_KW = ["個資", "客戶", "KYC", "保單", "醫療", "病歷", "授信", "財務", "交易", "信用", "資產", "投資", "帳務", "持卡", "受益人", "健康"];

// ─── Evaluation engine ────────────────────────────────────────────────────────

/**
 * evaluateRules() — 完全透明的風險評估
 *
 * 每個觸發的規則都有：ruleId、name、policySource、contribution、message
 * 最終分數 = rawScore × criticalityMultiplier，上限 100
 */
export function evaluateRules(sys: System, vendor: Vendor | null): RuleEvaluationResult {
  const triggered: TriggeredRule[] = [];

  for (const rule of RISK_RULES) {
    if (rule.test(sys, vendor)) {
      triggered.push({
        rule,
        message: rule.triggerMessage(sys, vendor),
        contribution: rule.scoreContribution,
      });
    }
  }

  const rawScore = triggered.reduce((sum, t) => sum + t.contribution, 0);
  const multiplier = sys.businessCriticality === "critical" ? 1.15 :
                     sys.businessCriticality === "high"     ? 1.05 : 1.0;
  const finalScore = Math.min(100, Math.round(rawScore * multiplier));

  return {
    rawScore,
    finalScore,
    riskLevel: toRiskLevel(finalScore),
    triggeredRules: triggered,
    criticalityMultiplier: multiplier,
  };
}

function toRiskLevel(score: number): RiskLevel {
  if (score >= 80) return "critical";
  if (score >= 55) return "high";
  if (score >= 35) return "medium";
  return "low";
}

/** 根據 ruleId 取得規則（供 UI 顯示時使用） */
export function getRuleById(ruleId: string): RiskRule | undefined {
  return RISK_RULES.find(r => r.ruleId === ruleId);
}

/** 所有規則按 category 分組 */
export function getRulesByCategory(): Record<RiskRule["category"], RiskRule[]> {
  const result = {} as Record<RiskRule["category"], RiskRule[]>;
  for (const rule of RISK_RULES) {
    (result[rule.category] ||= []).push(rule);
  }
  return result;
}

/** UI helper：顯示某系統為何被判定為高 / 中 / 低風險 */
export function explainRiskForSystem(sys: System, vendor: Vendor | null): RiskExplanation {
  const evaluation = evaluateRules(sys, vendor);
  const reasons = evaluation.triggeredRules.map((triggered) => triggered.message);
  const policySources = Array.from(new Set(evaluation.triggeredRules.map((triggered) => triggered.rule.policySource)));
  const levelText = evaluation.riskLevel === "critical"
    ? "重大風險"
    : evaluation.riskLevel === "high"
      ? "高風險"
      : evaluation.riskLevel === "medium"
        ? "中風險"
        : "低風險";

  return {
    riskLevel: evaluation.riskLevel,
    score: evaluation.finalScore,
    summary: reasons.length
      ? `${levelText}，由 ${evaluation.triggeredRules.length} 條明確規則觸發，總分 ${evaluation.finalScore}。`
      : `${levelText}，目前未觸發主要 PQC / HNDL 風險規則；仍需確認資料是否完整。`,
    reasons: reasons.length ? reasons : ["未觸發主要風險規則，請確認資料保存年限、外部串接與供應商資訊是否完整。"],
    policySources,
    triggeredRules: evaluation.triggeredRules,
  };
}
