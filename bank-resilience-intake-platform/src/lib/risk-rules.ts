import type { AssignedRole, RiskLevel, System, Vendor } from "@/data/demo-data";

export type RiskCategory = "hndl" | "data" | "external" | "vendor" | "crypto" | "contract" | "baseline";
export type RiskPriority = "P1" | "P2" | "P3";

export interface RiskRule {
  ruleId: string;
  name: string;
  description: string;
  sourceField: string;
  category: RiskCategory;
  scoreContribution: number;
  policySource: string;
  policyReference: string;
  riskStatement: string;
  recommendation: string;
  ownerRoles: AssignedRole[];
  priority: RiskPriority;
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
  priority: RiskPriority;
  recommendedOwners: AssignedRole[];
}

export interface RiskExplanation {
  riskLevel: RiskLevel;
  score: number;
  summary: string;
  reasons: string[];
  policySources: string[];
  triggeredRules: TriggeredRule[];
  priority: RiskPriority;
  recommendedOwners: AssignedRole[];
}

export interface IntakeRiskInput {
  dataRetentionYears: string;
  hasPersonalData: boolean | null;
  sensitiveDataTypes: string[];
  dataStillSensitiveAt10yr: boolean | null;
  leakageCausesHarm: boolean | null;
  hasExternalExchange: boolean | null;
  externalPartyTypes: string[];
  hasBatchFile: boolean | null;
  hasRealtimeApi: boolean | null;
  hasCrossBorder: boolean | null;
  usesHttps: boolean | null;
  hasDigitalSig: boolean | null;
  hasHsm: boolean | null;
  vendorProvidesEncryption: boolean | null;
  hasApiCertOrToken: boolean | null;
  hasVendor: boolean | null;
  contractExpiry: string;
  contractHasSecurityClause: boolean | null;
  vendorHasRoadmap: boolean | null;
  vendorCryptoAgility: boolean | null;
  businessCriticality: "" | RiskLevel;
  affectsCustomerTx: boolean | null;
  involvesRegulatory: boolean | null;
  techNotes: string;
  knownRisks: string;
}

export interface IntakeRiskRule {
  ruleId: string;
  title: string;
  sourceField: string;
  category: RiskCategory;
  scoreContribution: number;
  riskStatement: string;
  recommendation: string;
  ownerRoles: AssignedRole[];
  priority: RiskPriority;
  test: (form: IntakeRiskInput) => boolean;
}

export interface IntakeTriggeredReason {
  ruleId: string;
  title: string;
  sourceField: string;
  category: RiskCategory;
  scoreContribution: number;
  riskStatement: string;
  recommendation: string;
  ownerRoles: AssignedRole[];
  priority: RiskPriority;
}

export interface IntakeRiskEvaluation {
  riskLevel: Exclude<RiskLevel, "critical">;
  score: number;
  summary: string;
  priority: RiskPriority;
  recommendedOwners: AssignedRole[];
  triggeredReasons: IntakeTriggeredReason[];
}

const SENSITIVE_KEYWORDS = [
  "客戶身分",
  "身分",
  "個資",
  "交易",
  "授信",
  "房貸",
  "保單",
  "理賠",
  "醫療",
  "財務",
  "KYC",
  "長期有效",
];

const MEDIUM_SENSITIVE_KEYWORDS = ["客戶聯絡", "投資偏好", "行銷", "報表", "往來紀錄"];
const QUANTUM_VULNERABLE_CRYPTO = ["rsa", "ecc", "ecdsa", "ecdh"];
const UNKNOWN_CRYPTO_MARKERS = ["unknown crypto", "unknown crypto module", "legacy crypto", "憑證待確認", "金鑰待確認"];

function hasSensitiveData(values: string[]) {
  return values.some((value) => SENSITIVE_KEYWORDS.some((keyword) => value.toLowerCase().includes(keyword.toLowerCase())));
}

function hasMediumSensitiveData(values: string[]) {
  return values.some((value) => MEDIUM_SENSITIVE_KEYWORDS.some((keyword) => value.toLowerCase().includes(keyword.toLowerCase())));
}

function joinedSignals(sys: System) {
  return [...sys.cryptoSignals, ...sys.cmdbTags].join(" ").toLowerCase();
}

function includesAny(source: string, keywords: string[]) {
  const text = source.toLowerCase();
  return keywords.some((keyword) => text.includes(keyword.toLowerCase()));
}

function parseRetentionYears(value: string) {
  if (value.includes("永久")) return 999;
  const parsed = Number.parseInt(value || "0", 10);
  return Number.isFinite(parsed) ? parsed : 0;
}

function contractWithinMonths(dateStr: string, months: number) {
  if (!dateStr) return false;
  const target = new Date(dateStr);
  if (Number.isNaN(target.getTime())) return false;
  const today = new Date();
  const threshold = new Date(today);
  threshold.setMonth(threshold.getMonth() + months);
  return target > today && target <= threshold;
}

function toPriority(score: number): RiskPriority {
  if (score >= 70) return "P1";
  if (score >= 40) return "P2";
  return "P3";
}

function toThreeLevelRisk(score: number): Exclude<RiskLevel, "critical"> {
  if (score >= 70) return "high";
  if (score >= 40) return "medium";
  return "low";
}

function toSystemRiskLevel(score: number): RiskLevel {
  if (score >= 85) return "critical";
  if (score >= 70) return "high";
  if (score >= 40) return "medium";
  return "low";
}

function uniqueOwners(items: Array<{ ownerRoles: AssignedRole[] }>): AssignedRole[] {
  return Array.from(new Set(items.flatMap((item) => item.ownerRoles)));
}

export const RISK_RULES: RiskRule[] = [
  {
    ruleId: "RULE-HIGH-RETENTION-SENSITIVE",
    name: "長期敏感資料保存",
    description: "資料保存年限超過 10 年，且涉及客戶身分、交易、授信、保單、醫療或其他長期有效資料。",
    sourceField: "System.dataRetentionYears / System.dataTypes",
    category: "hndl",
    scoreContribution: 30,
    policySource: "CISA Quantum Readiness Roadmap",
    policyReference: "Prioritize long-lived sensitive data for PQC migration planning",
    riskStatement: "保存期間長且未來仍可能具敏感性的資料，較容易形成 HNDL（長期資料解密風險）。",
    recommendation: "列入第一批 PQC 前期盤點，確認資料保存依據、加密保護方式與未來遷移時程。",
    ownerRoles: ["業務", "系統Owner", "資安"],
    priority: "P1",
    test: (sys) => (sys.dataRetentionYears > 10 || sys.dataRetentionYears >= 99) && hasSensitiveData(sys.dataTypes),
    triggerMessage: (sys) => `資料保存年限為 ${sys.dataRetentionYears >= 99 ? "永久保存" : `${sys.dataRetentionYears} 年`}，且包含 ${sys.dataTypes.filter((type) => SENSITIVE_KEYWORDS.some((keyword) => type.includes(keyword))).slice(0, 3).join("、") || "長期敏感資料"}。`,
  },
  {
    ruleId: "RULE-HIGH-EXTERNAL-OR-VENDOR",
    name: "外部 API 或第三方介接",
    description: "系統有外部 API、跨機構資料交換或第三方供應商介接。",
    sourceField: "System.hasExternalApi / System.externalParties / System.vendorId",
    category: "external",
    scoreContribution: 15,
    policySource: "Internal API Security Standard",
    policyReference: "External connection and partner exchange inventory",
    riskStatement: "外部介接會提高資料攔截、憑證管理與供應商協作風險。",
    recommendation: "補齊外部對象、資料交換型態、TLS 版本、API token、憑證與簽章使用情境。",
    ownerRoles: ["系統Owner", "資安", "架構"],
    priority: "P1",
    test: (sys) => sys.hasExternalApi || !!sys.vendorId,
    triggerMessage: (sys) => sys.hasExternalApi
      ? `系統涉及外部 API 或資料交換：${sys.externalParties.join("、") || "外部對象待補"}。`
      : "系統由第三方供應商提供或維護，需確認供應商介接與加密責任。",
  },
  {
    ruleId: "RULE-HIGH-SENSITIVE-EXTERNAL-EXCHANGE",
    name: "長期敏感資料對外交換",
    description: "系統同時涉及敏感資料與外部 API、跨機構交換或供應商介接。",
    sourceField: "System.dataTypes / System.hasExternalApi / System.externalParties / System.vendorId",
    category: "external",
    scoreContribution: 12,
    policySource: "FSC 金融資安韌性發展藍圖",
    policyReference: "跨機構資料交換與新興科技風險治理",
    riskStatement: "長期敏感資料若透過外部 API、檔案交換或供應商通道流動，需優先確認傳輸、憑證、簽章與責任邊界。",
    recommendation: "由業務補齊外部交換情境，資安與架構確認 TLS、憑證、簽章、API token 與資料加密方式。",
    ownerRoles: ["業務", "系統Owner", "資安", "架構"],
    priority: "P1",
    test: (sys) => hasSensitiveData(sys.dataTypes) && (sys.hasExternalApi || !!sys.vendorId),
    triggerMessage: (sys) => `系統同時包含敏感資料（${sys.dataTypes.filter((type) => SENSITIVE_KEYWORDS.some((keyword) => type.includes(keyword))).slice(0, 3).join("、") || "長期敏感資料"}）與外部或供應商介接。`,
  },
  {
    ruleId: "RULE-HIGH-VENDOR-NO-ROADMAP",
    name: "供應商尚未提供 PQC Roadmap",
    description: "系統有供應商，但供應商尚未提供 PQC 遷移計畫。",
    sourceField: "Vendor.pqcRoadmapStatus",
    category: "vendor",
    scoreContribution: 18,
    policySource: "FSC 金融資安韌性發展藍圖",
    policyReference: "供應商科技韌性與新興科技風險治理",
    riskStatement: "供應商未提供遷移計畫時，銀行無法評估升級責任、時程與相依系統影響。",
    recommendation: "由採購與供應商補件，要求提供 PQC roadmap、加密調整能力與系統特定相依清單。",
    ownerRoles: ["採購", "供應商", "資安"],
    priority: "P1",
    test: (sys, vendor) => !!sys.vendorId && !!vendor && vendor.pqcRoadmapStatus === "未提供",
    triggerMessage: (_, vendor) => `供應商 ${vendor?.vendorName ?? "待確認"} 尚未提供 PQC Roadmap。`,
  },
  {
    ruleId: "RULE-HIGH-RSA-ECC",
    name: "使用 RSA / ECC / ECDSA / ECDH",
    description: "系統技術標籤或加密訊號出現 RSA、ECC、ECDSA、ECDH 等可能受量子威脅影響的密碼技術。",
    sourceField: "System.cryptoSignals / System.cmdbTags",
    category: "crypto",
    scoreContribution: 18,
    policySource: "NIST NCCoE Migration to Post-Quantum Cryptography",
    policyReference: "Cryptographic discovery and migration prioritization",
    riskStatement: "RSA、ECC、ECDSA、ECDH 屬於 PQC 遷移需要優先盤點的公鑰密碼相依性。",
    recommendation: "建立密碼資產清單，確認演算法、金鑰長度、憑證用途、到期日與替換方案。",
    ownerRoles: ["資安", "架構", "系統Owner"],
    priority: "P1",
    test: (sys) => includesAny(joinedSignals(sys), QUANTUM_VULNERABLE_CRYPTO),
    triggerMessage: (sys) => `技術標籤或加密訊號出現 ${[...sys.cryptoSignals, ...sys.cmdbTags].filter((item) => includesAny(item, QUANTUM_VULNERABLE_CRYPTO)).join("、") || "RSA / ECC 相關技術"}。`,
  },
  {
    ruleId: "RULE-HIGH-CRYPTO-INVENTORY-MISSING",
    name: "憑證、金鑰或加密演算法資訊尚未盤點",
    description: "系統存在未知加密模組、舊型加密標籤，或缺少加密訊號。",
    sourceField: "System.cryptoSignals / System.cmdbTags",
    category: "crypto",
    scoreContribution: 16,
    policySource: "NIST SP 1800-38B",
    policyReference: "Cryptographic Discovery and Inventory",
    riskStatement: "加密資產資訊不完整會讓 PQC 遷移影響範圍無法估算。",
    recommendation: "先完成憑證、金鑰、演算法、HSM、API token 與批次檔加密方式盤點。",
    ownerRoles: ["資安", "架構"],
    priority: "P1",
    test: (sys) => sys.cryptoSignals.length === 0 || includesAny(joinedSignals(sys), UNKNOWN_CRYPTO_MARKERS),
    triggerMessage: (sys) => sys.cryptoSignals.length === 0
      ? "尚未盤點憑證、金鑰或加密演算法資訊。"
      : `技術標籤顯示加密資訊待確認：${[...sys.cryptoSignals, ...sys.cmdbTags].filter((item) => includesAny(item, UNKNOWN_CRYPTO_MARKERS)).join("、") || "unknown crypto"}。`,
  },
  {
    ruleId: "RULE-MED-EXTERNAL-SHORT-RETENTION",
    name: "外部介接但保存年限未超過 10 年",
    description: "系統有外部介接，但資料保存年限未超過 10 年。",
    sourceField: "System.hasExternalApi / System.dataRetentionYears",
    category: "external",
    scoreContribution: 10,
    policySource: "Internal API Security Standard",
    policyReference: "External data exchange control",
    riskStatement: "外部介接仍需確認傳輸保護與憑證管理，即使 HNDL 風險較低。",
    recommendation: "列入年度盤點，確認外部對象、傳輸加密、API token 與憑證簽章。",
    ownerRoles: ["系統Owner", "資安"],
    priority: "P2",
    test: (sys) => sys.hasExternalApi && sys.dataRetentionYears > 0 && sys.dataRetentionYears <= 10,
    triggerMessage: (sys) => `系統有外部介接，但資料保存年限為 ${sys.dataRetentionYears} 年，需確認傳輸與憑證控管。`,
  },
  {
    ruleId: "RULE-MED-VENDOR-UNKNOWN",
    name: "供應商準備度未知或部分提供",
    description: "供應商 PQC readiness 或加密調整能力尚未完整確認。",
    sourceField: "Vendor.pqcRoadmapStatus / Vendor.cryptoAgilityStatus",
    category: "vendor",
    scoreContribution: 10,
    policySource: "FSC 金融資安韌性發展藍圖",
    policyReference: "供應商科技韌性追蹤",
    riskStatement: "供應商準備度未知會影響後續遷移排程與合約責任判斷。",
    recommendation: "向供應商補件，取得 roadmap、crypto-agility 說明與升級支援範圍。",
    ownerRoles: ["採購", "供應商"],
    priority: "P2",
    test: (sys, vendor) => !!sys.vendorId && !!vendor && (vendor.pqcRoadmapStatus === "部分提供" || vendor.cryptoAgilityStatus === "未確認" || vendor.cryptoAgilityStatus === "部分支援"),
    triggerMessage: (_, vendor) => `供應商準備度尚未完整：PQC Roadmap 為 ${vendor?.pqcRoadmapStatus ?? "未確認"}，加密調整能力為 ${vendor?.cryptoAgilityStatus ?? "未確認"}。`,
  },
  {
    ruleId: "RULE-MED-SENSITIVE-DATA",
    name: "資料敏感度中等",
    description: "系統涉及客戶聯絡、投資偏好、報表或往來紀錄等中等敏感資料。",
    sourceField: "System.dataTypes",
    category: "data",
    scoreContribution: 8,
    policySource: "Internal Data Classification Policy",
    policyReference: "Sensitive data classification for technology resilience intake",
    riskStatement: "中等敏感資料雖非最高風險，仍需確認保存年限與外部交換情境。",
    recommendation: "由業務與系統 Owner 補齊資料保存依據、外部交換目的與資料欄位範圍。",
    ownerRoles: ["業務", "系統Owner"],
    priority: "P2",
    test: (sys) => !hasSensitiveData(sys.dataTypes) && hasMediumSensitiveData(sys.dataTypes),
    triggerMessage: (sys) => `系統包含中等敏感資料：${sys.dataTypes.filter((type) => MEDIUM_SENSITIVE_KEYWORDS.some((keyword) => type.includes(keyword))).join("、") || "客戶或業務資料"}。`,
  },
];

export const INTAKE_RISK_RULES: IntakeRiskRule[] = [
  {
    ruleId: "INTAKE-HIGH-RETENTION-SENSITIVE",
    title: "客戶資料保存年限超過 10 年",
    sourceField: "dataRetentionYears / sensitiveDataTypes",
    category: "hndl",
    scoreContribution: 30,
    riskStatement: "長期保存且涉及客戶身分、交易、授信、保單、醫療或長期有效資料，會形成 HNDL（長期資料解密風險）。",
    recommendation: "列入第一批 PQC 前期盤點，確認保存依據、加密保護方式與未來遷移時程。",
    ownerRoles: ["業務", "系統Owner", "資安"],
    priority: "P1",
    test: (form) => parseRetentionYears(form.dataRetentionYears) > 10 && (form.hasPersonalData === true || hasSensitiveData(form.sensitiveDataTypes) || form.dataStillSensitiveAt10yr === true),
  },
  {
    ruleId: "INTAKE-HIGH-LONG-TERM-IMPACT",
    title: "涉及長期有效性的交易或身分驗證資料",
    sourceField: "affectsCustomerTx / dataStillSensitiveAt10yr / leakageCausesHarm",
    category: "data",
    scoreContribution: 15,
    riskStatement: "資料在 10 年後仍具價值，或外洩會造成客戶損害、法律責任或監理風險。",
    recommendation: "由業務補充資料使用情境，資安確認是否需優先納入 PQC 遷移影響評估。",
    ownerRoles: ["業務", "資安"],
    priority: "P1",
    test: (form) => form.dataStillSensitiveAt10yr === true || form.leakageCausesHarm === true || form.affectsCustomerTx === true,
  },
  {
    ruleId: "INTAKE-HIGH-EXTERNAL",
    title: "系統與外部 API 或第三方供應商介接",
    sourceField: "hasExternalExchange / hasRealtimeApi / hasBatchFile / hasVendor",
    category: "external",
    scoreContribution: 15,
    riskStatement: "外部介接增加傳輸、憑證、簽章、API token 與供應商協作風險。",
    recommendation: "補齊外部對象、資料交換方式、憑證或簽章使用情境，並交由資安與架構確認。",
    ownerRoles: ["系統Owner", "資安", "架構"],
    priority: "P1",
    test: (form) => form.hasExternalExchange === true || form.hasRealtimeApi === true || form.hasBatchFile === true || form.hasVendor === true,
  },
  {
    ruleId: "INTAKE-HIGH-VENDOR-NO-ROADMAP",
    title: "供應商尚未提供 PQC Roadmap",
    sourceField: "vendorHasRoadmap",
    category: "vendor",
    scoreContribution: 18,
    riskStatement: "供應商未提供 PQC Roadmap 時，銀行無法評估升級責任、時程與相依系統影響。",
    recommendation: "由採購與供應商補件，要求提供 PQC Roadmap、加密調整能力與系統相依清單。",
    ownerRoles: ["採購", "供應商", "資安"],
    priority: "P1",
    test: (form) => form.hasVendor === true && form.vendorHasRoadmap !== true,
  },
  {
    ruleId: "INTAKE-HIGH-RSA-ECC",
    title: "可能使用 RSA、ECC、ECDSA、ECDH",
    sourceField: "techNotes / knownRisks / hasDigitalSig / hasApiCertOrToken",
    category: "crypto",
    scoreContribution: 18,
    riskStatement: "RSA、ECC、ECDSA、ECDH 屬於 PQC 遷移需要優先盤點的公鑰密碼相依性。",
    recommendation: "建立密碼資產清單，確認演算法、金鑰長度、憑證用途、到期日與替換方案。",
    ownerRoles: ["資安", "架構"],
    priority: "P1",
    test: (form) => includesAny(`${form.techNotes} ${form.knownRisks}`, QUANTUM_VULNERABLE_CRYPTO) || form.hasDigitalSig === true || form.hasApiCertOrToken === true,
  },
  {
    ruleId: "INTAKE-HIGH-CRYPTO-MISSING",
    title: "憑證、金鑰或加密演算法資訊尚未盤點",
    sourceField: "usesHttps / hasDigitalSig / hasApiCertOrToken / hasHsm / techNotes",
    category: "crypto",
    scoreContribution: 14,
    riskStatement: "加密資產資訊不完整時，PQC 遷移影響範圍無法估算。",
    recommendation: "由資安與架構盤點 TLS、憑證、簽章、HSM、API token、批次檔加密與演算法資訊。",
    ownerRoles: ["資安", "架構"],
    priority: "P1",
    test: (form) => form.usesHttps === null || form.hasDigitalSig === null || form.hasApiCertOrToken === null || form.hasHsm === null || !form.techNotes.trim(),
  },
  {
    ruleId: "INTAKE-MED-EXTERNAL-SHORT-RETENTION",
    title: "有外部介接，但資料保存年限未超過 10 年",
    sourceField: "hasExternalExchange / hasRealtimeApi / hasBatchFile / dataRetentionYears",
    category: "external",
    scoreContribution: 10,
    riskStatement: "外部介接仍需確認傳輸保護與憑證管理，即使資料保存期較短。",
    recommendation: "列入年度盤點，確認外部對象、傳輸加密、API token 與憑證簽章。",
    ownerRoles: ["系統Owner", "資安"],
    priority: "P2",
    test: (form) => (form.hasExternalExchange === true || form.hasRealtimeApi === true || form.hasBatchFile === true) && parseRetentionYears(form.dataRetentionYears) > 0 && parseRetentionYears(form.dataRetentionYears) <= 10,
  },
  {
    ruleId: "INTAKE-MED-VENDOR-UNKNOWN",
    title: "供應商準備度未知",
    sourceField: "vendorHasRoadmap / vendorCryptoAgility",
    category: "vendor",
    scoreContribution: 10,
    riskStatement: "供應商準備度未知會影響後續遷移排程與合約責任判斷。",
    recommendation: "要求供應商補件，取得 PQC Roadmap、crypto-agility 與升級支援範圍。",
    ownerRoles: ["採購", "供應商"],
    priority: "P2",
    test: (form) => form.hasVendor === true && (form.vendorHasRoadmap === null || form.vendorCryptoAgility === null),
  },
  {
    ruleId: "INTAKE-MED-SENSITIVE",
    title: "系統資料敏感度中等",
    sourceField: "hasPersonalData / sensitiveDataTypes",
    category: "data",
    scoreContribution: 8,
    riskStatement: "中等敏感資料仍需確認保存年限、外部交換目的與資料欄位範圍。",
    recommendation: "由業務與系統 Owner 補齊資料保存依據與資料交換情境。",
    ownerRoles: ["業務", "系統Owner"],
    priority: "P2",
    test: (form) => form.hasPersonalData === true || hasMediumSensitiveData(form.sensitiveDataTypes),
  },
  {
    ruleId: "INTAKE-MED-RSA-ECC-UNKNOWN",
    title: "尚未確認是否使用 RSA / ECC",
    sourceField: "techNotes / securityRequests",
    category: "crypto",
    scoreContribution: 8,
    riskStatement: "尚未確認公鑰密碼相依性時，無法判斷 PQC 遷移影響範圍。",
    recommendation: "由資安確認是否使用 RSA、ECC、ECDSA、ECDH、憑證登入、簽章或 HSM。",
    ownerRoles: ["資安", "架構"],
    priority: "P2",
    test: (form) => !includesAny(`${form.techNotes} ${form.knownRisks}`, QUANTUM_VULNERABLE_CRYPTO) && (form.hasDigitalSig === null || form.hasApiCertOrToken === null || form.vendorProvidesEncryption === null),
  },
  {
    ruleId: "INTAKE-MED-CONTRACT-EXPIRING",
    title: "合約到期日接近，但尚未完成供應商確認",
    sourceField: "contractExpiry / vendorHasRoadmap / vendorCryptoAgility",
    category: "contract",
    scoreContribution: 8,
    riskStatement: "合約即將到期是納入 PQC Roadmap、加密調整能力與資安升級責任條款的關鍵窗口。",
    recommendation: "由採購於續約或新約中納入 PQC Roadmap、crypto-agility 與資安升級責任。",
    ownerRoles: ["採購", "供應商"],
    priority: "P2",
    test: (form) => form.hasVendor === true && contractWithinMonths(form.contractExpiry, 6) && (form.vendorHasRoadmap !== true || form.vendorCryptoAgility !== true),
  },
];

export function evaluateRules(sys: System, vendor: Vendor | null): RuleEvaluationResult {
  const triggered = RISK_RULES
    .filter((rule) => rule.test(sys, vendor))
    .map((rule) => ({
      rule,
      message: rule.triggerMessage(sys, vendor),
      contribution: rule.scoreContribution,
    }));

  const rawScore = triggered.reduce((sum, item) => sum + item.contribution, 0);
  const multiplier = sys.businessCriticality === "critical" ? 1.15 : sys.businessCriticality === "high" ? 1.05 : 1;
  const finalScore = Math.min(100, Math.round(rawScore * multiplier));

  return {
    rawScore,
    finalScore,
    riskLevel: toSystemRiskLevel(finalScore),
    triggeredRules: triggered,
    criticalityMultiplier: multiplier,
    priority: toPriority(finalScore),
    recommendedOwners: uniqueOwners(triggered.map((item) => item.rule)),
  };
}

export function evaluateIntakeRisk(form: IntakeRiskInput): IntakeRiskEvaluation {
  const triggeredReasons = INTAKE_RISK_RULES
    .filter((rule) => rule.test(form))
    .map((rule) => ({
      ruleId: rule.ruleId,
      title: rule.title,
      sourceField: rule.sourceField,
      category: rule.category,
      scoreContribution: rule.scoreContribution,
      riskStatement: rule.riskStatement,
      recommendation: rule.recommendation,
      ownerRoles: rule.ownerRoles,
      priority: rule.priority,
    }));

  const baseScore = triggeredReasons.reduce((sum, item) => sum + item.scoreContribution, 0);
  const multiplier = form.businessCriticality === "critical" ? 1.15 : form.businessCriticality === "high" ? 1.05 : 1;
  const score = Math.min(100, Math.round(baseScore * multiplier));
  const riskLevel = toThreeLevelRisk(score);
  const priority = toPriority(score);
  const recommendedOwners = uniqueOwners(triggeredReasons);

  const fallbackReasons: IntakeTriggeredReason[] = triggeredReasons.length
    ? triggeredReasons
    : [{
        ruleId: "INTAKE-LOW-BASELINE",
        title: "低風險基準條件",
        sourceField: "整體填寫內容",
        category: "baseline",
        scoreContribution: 0,
        riskStatement: "目前填寫內容顯示系統偏內部使用、無明確外部 API 或第三方介接、資料保存期短，且未出現長期敏感資料或待盤點加密訊號。",
        recommendation: "維持年度複查；若後續新增外部介接、供應商維護或長期保存資料，需重新評級。",
        ownerRoles: ["系統Owner"],
        priority: "P3",
      }];

  return {
    riskLevel,
    score,
    summary: `本系統被評為「${riskLevel === "high" ? "高" : riskLevel === "medium" ? "中" : "低"}風險」，共觸發 ${triggeredReasons.length} 條規則，風險分數 ${score} 分。`,
    priority,
    recommendedOwners: recommendedOwners.length ? recommendedOwners : ["系統Owner"],
    triggeredReasons: fallbackReasons,
  };
}

export function getRuleById(ruleId: string): RiskRule | undefined {
  return RISK_RULES.find((rule) => rule.ruleId === ruleId);
}

export function getRulesByCategory(): Record<RiskCategory, RiskRule[]> {
  const result = {} as Record<RiskCategory, RiskRule[]>;
  for (const rule of RISK_RULES) {
    (result[rule.category] ||= []).push(rule);
  }
  return result;
}

export function explainRiskForSystem(sys: System, vendor: Vendor | null): RiskExplanation {
  const evaluation = evaluateRules(sys, vendor);
  const levelText = evaluation.riskLevel === "critical" || evaluation.riskLevel === "high"
    ? "高風險"
    : evaluation.riskLevel === "medium"
      ? "中風險"
      : "低風險";

  return {
    riskLevel: evaluation.riskLevel,
    score: evaluation.finalScore,
    summary: evaluation.triggeredRules.length
      ? `${levelText}，由 ${evaluation.triggeredRules.length} 條明確規則觸發，總分 ${evaluation.finalScore}。`
      : `${levelText}，目前未觸發主要 PQC / HNDL 風險規則，建議維持年度複查。`,
    reasons: evaluation.triggeredRules.length
      ? evaluation.triggeredRules.map((triggered) => triggered.message)
      : ["僅內部使用、資料保存期短、未出現長期敏感資料或待盤點加密訊號。"],
    policySources: Array.from(new Set(evaluation.triggeredRules.map((triggered) => triggered.rule.policySource))),
    triggeredRules: evaluation.triggeredRules,
    priority: evaluation.priority,
    recommendedOwners: evaluation.recommendedOwners.length ? evaluation.recommendedOwners : ["系統Owner"],
  };
}
