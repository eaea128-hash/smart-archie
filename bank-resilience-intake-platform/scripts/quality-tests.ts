import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { systems, vendors, tasks, complianceLineage, type System, type Vendor } from "@/data/demo-data";
import { evaluateIntakeRisk, explainRiskForSystem, type IntakeRiskInput } from "@/lib/risk-rules";
import { runGuardrails } from "@/lib/guardrails";
import { generateIntakeTasks } from "@/rules/taskGenerationRules";
import { buildEvidenceSnapshotMeta } from "@/lib/evidence";
import type { IntakeFormSnapshot } from "@/lib/storage";

type TestCase = {
  name: string;
  run: () => void;
};

const root = process.cwd();
const tests: TestCase[] = [];

function test(name: string, run: () => void) {
  tests.push({ name, run });
}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function getSystem(name: string) {
  const system = systems.find((item) => item.systemName === name);
  assert(system, `找不到示範系統：${name}`);
  return system;
}

function getVendor(system: System) {
  return system.vendorId ? vendors.find((vendor) => vendor.vendorId === system.vendorId) ?? null : null;
}

function cloneSystem(base: System, patch: Partial<System>): System {
  return {
    ...base,
    cmdbTags: [...base.cmdbTags],
    cryptoSignals: [...base.cryptoSignals],
    dataTypes: [...base.dataTypes],
    externalParties: [...base.externalParties],
    ...patch,
  };
}

function cloneVendor(base: Vendor, patch: Partial<Vendor>): Vendor {
  return { ...base, ...patch };
}

function addMonths(date: Date, months: number) {
  const next = new Date(date);
  next.setMonth(next.getMonth() + months);
  return next.toISOString().slice(0, 10);
}

function allSourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const full = path.join(dir, entry);
    if (["node_modules", "dist", ".tmp-quality"].includes(entry)) return [];
    const stat = statSync(full);
    if (stat.isDirectory()) return allSourceFiles(full);
    return /\.(ts|tsx|md)$/.test(entry) ? [full] : [];
  });
}

test("示範資料包含必要的 12 個系統與治理資料", () => {
  const requiredSystems = [
    "房貸授信系統",
    "保單理賠系統",
    "財富管理客戶系統",
    "外匯清算介接系統",
    "聯徵查詢系統",
    "信用卡交易授權系統",
    "企業網銀系統",
    "行動銀行 API Gateway",
    "客服知識庫系統",
    "內部報表系統",
    "醫療理賠資料交換系統",
    "供應商文件交換平台",
  ];

  assert(systems.length >= 12, "系統清單少於 12 筆");
  for (const name of requiredSystems) {
    assert(systems.some((system) => system.systemName === name), `缺少系統：${name}`);
  }
  assert(vendors.length >= 6, "供應商資料不足");
  assert(tasks.length > 0, "跨部門待辦資料不可為空");
  assert(complianceLineage.length > 0, "合規軌跡資料不可為空");
});

test("高風險系統可取得可解釋的風險依據與政策來源", () => {
  for (const name of ["房貸授信系統", "保單理賠系統", "醫療理賠資料交換系統"]) {
    const system = getSystem(name);
    const explanation = explainRiskForSystem(system, getVendor(system));
    assert(["critical", "high"].includes(explanation.riskLevel), `${name} 應為高風險以上`);
    assert(explanation.score > 0, `${name} 應有風險分數`);
    assert(explanation.reasons.length > 0, `${name} 應列出風險原因`);
    assert(explanation.triggeredRules.length > 0, `${name} 應列出觸發規則`);
    for (const triggered of explanation.triggeredRules) {
      assert(triggered.rule.ruleId, `${name} 的觸發規則缺少 ruleId`);
      assert(triggered.rule.policySource, `${name} 的觸發規則缺少政策來源`);
      assert(triggered.rule.policyReference, `${name} 的觸發規則缺少政策參考`);
      assert(triggered.message, `${name} 的觸發規則缺少原因說明`);
    }
  }
});

test("防呆規則能抓出缺漏、矛盾與供應商補件問題", () => {
  const base = getSystem("房貸授信系統");
  const vendor = getVendor(base);
  assert(vendor, "房貸授信系統應有供應商");

  const missingRetention = cloneSystem(base, {
    systemId: "QA-GRD-01",
    dataRetentionYears: 0,
    dataTypes: ["授信資料", "個資"],
  });
  assert(runGuardrails([missingRetention], vendors).some((alert) => alert.guardrailId === "GRD-01"), "敏感資料缺保存年限應觸發 GRD-01");

  const missingExternalParty = cloneSystem(base, {
    systemId: "QA-GRD-02",
    hasExternalApi: true,
    externalParties: [],
  });
  assert(runGuardrails([missingExternalParty], vendors).some((alert) => alert.guardrailId === "GRD-02"), "外部 API 缺外部對象應觸發 GRD-02");

  const legacyButLow = cloneSystem(base, {
    systemId: "QA-GRD-04",
    hndlRiskScore: 20,
    cmdbTags: ["legacy crypto", "TLS 1.1"],
    cryptoSignals: [],
  });
  assert(runGuardrails([legacyButLow], vendors).some((alert) => alert.guardrailId === "GRD-04"), "legacy crypto 但低風險應觸發 GRD-04");

  const missingRoadmapVendor = cloneVendor(vendor, {
    vendorId: "QA-VENDOR-ROADMAP",
    pqcRoadmapStatus: "未提供",
  });
  const missingRoadmapSystem = cloneSystem(base, {
    systemId: "QA-GRD-03",
    vendorId: missingRoadmapVendor.vendorId,
  });
  assert(runGuardrails([missingRoadmapSystem], [missingRoadmapVendor]).some((alert) => alert.guardrailId === "GRD-03"), "供應商未提供 PQC 遷移計畫應觸發 GRD-03");

  const expiringVendor = cloneVendor(vendor, {
    vendorId: "QA-VENDOR-EXPIRY",
    nextFollowUpDate: addMonths(new Date(), 2),
  });
  const expiringSystem = cloneSystem(base, {
    systemId: "QA-GRD-05",
    vendorId: expiringVendor.vendorId,
  });
  assert(runGuardrails([expiringSystem], [expiringVendor]).some((alert) => alert.guardrailId === "GRD-05"), "供應商追蹤期限接近應觸發 GRD-05");
});

test("前期盤點送出後可產生跨部門待辦", () => {
  const form: IntakeFormSnapshot = {
    systemName: "測試理賠交換系統",
    businessUnit: "示範業務單位",
    systemOwner: "System Owner",
    systemType: "Partner Exchange",
    businessCriticality: "high",
    affectsCustomerTx: true,
    involvesRegulatory: true,
    dataRetentionYears: "30",
    hasPersonalData: true,
    sensitiveDataTypes: ["保單資料", "醫療資料"],
    dataStillSensitiveAt10yr: true,
    leakageCausesHarm: true,
    hasExternalExchange: true,
    externalPartyTypes: ["醫療院所", "保險公司"],
    hasBatchFile: true,
    hasRealtimeApi: true,
    hasCrossBorder: false,
    usesHttps: null,
    hasDigitalSig: null,
    hasHsm: true,
    vendorProvidesEncryption: true,
    hasApiCertOrToken: null,
    hasVendor: true,
    vendorName: "Demo Vendor",
    contractActive: true,
    contractExpiry: addMonths(new Date(), 3),
    contractHasSecurityClause: false,
    vendorHasRoadmap: false,
    vendorCryptoAgility: null,
    businessNotes: "",
    techNotes: "",
    knownRisks: "",
    securityRequests: "",
  };

  const generated = generateIntakeTasks(form, 92);
  assert(generated.length >= 6, "高風險盤點應產生多個跨部門待辦");
  assert(generated.some((task) => task.role === "資安"), "應產生資安待辦");
  assert(generated.some((task) => task.role === "採購"), "應產生採購待辦");
  assert(generated.some((task) => task.role === "供應商"), "應產生供應商待辦");
  assert(generated.some((task) => task.reason.includes("PQC")), "待辦需包含 PQC 觸發原因");
});

test("主要頁面已接上風險說明、防呆與證據包能力", () => {
  const dashboard = readFileSync(path.join(root, "src/pages/Dashboard.tsx"), "utf8");
  const hndl = readFileSync(path.join(root, "src/pages/HndlAnalysis.tsx"), "utf8");
  const report = readFileSync(path.join(root, "src/pages/IntakeReport.tsx"), "utf8");
  const tasksPage = readFileSync(path.join(root, "src/pages/CrossFunctionalTasks.tsx"), "utf8");
  const lineage = readFileSync(path.join(root, "src/pages/ComplianceLineage.tsx"), "utf8");

  assert(dashboard.includes("RiskExplanationPanel"), "Dashboard 應呈現風險說明");
  assert(dashboard.includes("DataQualityIssues"), "Dashboard 應呈現盤點資料品質警示");
  assert(hndl.includes("RiskExplanationPanel"), "HNDL Analysis 應呈現風險說明");
  assert(report.includes("RiskExplanationPanel"), "Intake Report 應呈現完整風險依據");
  assert(report.includes("Snapshot") && report.includes("Guardrail Alerts") && report.includes("Known Limits"), "Evidence Pack 區塊不完整");
  assert(report.includes("完整性指紋") && report.includes("evidencePackId") && report.includes("integrityDigest"), "Evidence Pack 應包含證據包 ID 與完整性指紋");
  assert(report.includes("window.print"), "Evidence Pack 應支援列印存 PDF");
  assert(tasksPage.includes("explainRiskForSystem"), "Cross-functional Tasks 應顯示觸發來源");
  assert(lineage.includes("檢核方向") && lineage.includes("補件待辦任務"), "Compliance Lineage 應呈現檢核方向變更模擬");
});

test("證據包 metadata 可固定版本、時間點與完整性指紋", () => {
  const meta = buildEvidenceSnapshotMeta({
    systemId: "SYS-001",
    snapshotAt: "2026-06-22T10:00:00.000Z",
    dataVersion: "demo-local-v1",
    ruleEngineVersion: "1.2.0",
    ruleEngineUpdated: "2026-06",
    payload: { b: 2, a: 1 },
  });

  assert(meta.evidencePackId === "EP-SYS-001-20260622", "證據包 ID 應由系統與時間點組成");
  assert(meta.integrityDigest.startsWith("DEMO-"), "完整性指紋應有 Demo 前綴");
  assert(meta.dataVersion === "demo-local-v1", "資料版本應被保留");
  assert(meta.ruleEngineVersion === "1.2.0", "規則版本應被保留");
});

test("列印版式與中文導航已納入 POC 驗收", () => {
  const css = readFileSync(path.join(root, "src/index.css"), "utf8");
  const navigation = readFileSync(path.join(root, "src/components/layout/navigation.ts"), "utf8");

  assert(css.includes("@media print") && css.includes("@page") && css.includes("size: A4"), "列印版式應支援 A4 print-friendly PDF");
  for (const label of ["平台總覽", "全行風險總覽", "PQC 前期盤點", "盤點證據包"]) {
    assert(navigation.includes(label), `導航應使用高層可讀中文：${label}`);
  }
});

test("可見文案避免不當定位與亂碼", () => {
  const files = [
    ...allSourceFiles(path.join(root, "src")),
    path.join(root, "README.md"),
  ];
  const prohibited = ["問卷工具", "黑箱 AI", "AI 亂", "這不是", "對齊金管會"];
  const mojibakePatterns = ["�", "嚗", "蝟", "靘", "撠", "憸", "銝"];

  for (const file of files) {
    const relative = path.relative(root, file);
    const text = readFileSync(file, "utf8");
    for (const word of prohibited) {
      assert(!text.includes(word), `${relative} 不應出現「${word}」`);
    }
    for (const marker of mojibakePatterns) {
      assert(!text.includes(marker), `${relative} 疑似含有亂碼片段「${marker}」`);
    }
  }
});

test("Intake risk rating outputs level, score, reasons, priority, and owners", () => {
  const base: IntakeRiskInput = {
    dataRetentionYears: "3",
    hasPersonalData: false,
    sensitiveDataTypes: [],
    dataStillSensitiveAt10yr: false,
    leakageCausesHarm: false,
    hasExternalExchange: false,
    externalPartyTypes: [],
    hasBatchFile: false,
    hasRealtimeApi: false,
    hasCrossBorder: false,
    usesHttps: true,
    hasDigitalSig: false,
    hasHsm: false,
    vendorProvidesEncryption: false,
    hasApiCertOrToken: false,
    hasVendor: false,
    contractExpiry: "",
    contractHasSecurityClause: true,
    vendorHasRoadmap: true,
    vendorCryptoAgility: true,
    businessCriticality: "low",
    affectsCustomerTx: false,
    involvesRegulatory: false,
    techNotes: "內部報表，未使用公鑰簽章",
    knownRisks: "",
  };

  const low = evaluateIntakeRisk(base);
  assert(low.riskLevel === "low", "low-risk intake should be low");
  assert(low.triggeredReasons.length > 0, "low-risk intake should still explain why");
  assert(low.priority === "P3", "low-risk intake should be P3");

  const high = evaluateIntakeRisk({
    ...base,
    dataRetentionYears: "30",
    hasPersonalData: true,
    sensitiveDataTypes: ["客戶身分資料", "交易資料", "授信資料"],
    dataStillSensitiveAt10yr: true,
    leakageCausesHarm: true,
    hasExternalExchange: true,
    externalPartyTypes: ["聯徵", "第三方 API"],
    hasRealtimeApi: true,
    hasApiCertOrToken: null,
    hasDigitalSig: true,
    hasVendor: true,
    vendorHasRoadmap: false,
    vendorCryptoAgility: null,
    businessCriticality: "high",
    affectsCustomerTx: true,
    techNotes: "使用 RSA-2048 憑證與 ECDSA 簽章",
  });

  assert(high.riskLevel === "high", "long-lived sensitive external vendor system should be high risk");
  assert(high.score >= 70, "high risk should meet score threshold");
  assert(high.triggeredReasons.some((reason) => reason.sourceField.includes("vendorHasRoadmap")), "vendor roadmap reason should be listed");
  assert(high.triggeredReasons.every((reason) => reason.sourceField && reason.riskStatement && reason.recommendation), "every reason should include field, statement, and recommendation");
  assert(high.recommendedOwners.includes("資安") && high.recommendedOwners.includes("採購"), "high risk should recommend security and procurement owners");
});

const failures: string[] = [];
for (const item of tests) {
  try {
    item.run();
    console.log(`PASS ${item.name}`);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    failures.push(`${item.name}: ${message}`);
    console.error(`FAIL ${item.name}`);
    console.error(`  ${message}`);
  }
}

if (failures.length > 0) {
  console.error(`\n${failures.length} quality check(s) failed.`);
  process.exit(1);
}

console.log(`\n${tests.length} quality checks passed.`);
