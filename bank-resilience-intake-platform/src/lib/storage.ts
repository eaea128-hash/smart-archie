import type { AssignedRole, DemoData, RiskLevel, System, Task } from "@/data/demo-data";
import { demoData } from "@/data/demo-data";

export type { DemoData };

const STORAGE_KEY = "bank-resilience-intake-demo-v4";
const INTAKE_SUBMISSIONS_KEY = "bank-resilience-intake-submissions-v1";
const LEGACY_STORAGE_KEYS = ["cloudframe_demo_data"];
const LEGACY_INTAKE_SUBMISSIONS_KEYS = ["cloudframe_intake_submissions"];

export interface IntakeFormSnapshot {
  systemName: string;
  businessUnit: string;
  systemOwner: string;
  systemType: string;
  businessCriticality: "" | RiskLevel;
  affectsCustomerTx: boolean | null;
  involvesRegulatory: boolean | null;
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
  vendorName: string;
  contractActive: boolean | null;
  contractExpiry: string;
  contractHasSecurityClause: boolean | null;
  vendorHasRoadmap: boolean | null;
  vendorCryptoAgility: boolean | null;
  businessNotes: string;
  techNotes: string;
  knownRisks: string;
  securityRequests: string;
}

export interface IntakeGeneratedTaskSnapshot {
  role: string;
  priority: "P1" | "P2" | "P3";
  title: string;
  reason: string;
}

export interface IntakeSubmission {
  id: string;
  systemId: string;
  submittedAt: string;
  hndlScore: number;
  riskLevel: RiskLevel;
  form: IntakeFormSnapshot;
  tasks: IntakeGeneratedTaskSnapshot[];
}

export function loadDemoData(): DemoData {
  if (typeof window === "undefined") {
    return demoData;
  }

  const saved = localStorage.getItem(STORAGE_KEY) ?? readFirstLegacyValue(LEGACY_STORAGE_KEYS);
  if (!saved) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(demoData));
    return demoData;
  }
  try {
    const parsed = JSON.parse(saved) as DemoData;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(parsed));
    return parsed;
  } catch {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(demoData));
    return demoData;
  }
}

export function saveDemoData(data: DemoData) {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  window.dispatchEvent(new CustomEvent("bank-resilience-demo-data-updated"));
}

export function loadIntakeSubmissions(): IntakeSubmission[] {
  if (typeof window === "undefined") return [];

  try {
    const saved = localStorage.getItem(INTAKE_SUBMISSIONS_KEY) ?? readFirstLegacyValue(LEGACY_INTAKE_SUBMISSIONS_KEYS) ?? "[]";
    const parsed = JSON.parse(saved) as IntakeSubmission[];
    localStorage.setItem(INTAKE_SUBMISSIONS_KEY, JSON.stringify(parsed));
    return parsed;
  } catch {
    localStorage.setItem(INTAKE_SUBMISSIONS_KEY, "[]");
    return [];
  }
}

export function saveIntakeSubmission(
  form: IntakeFormSnapshot,
  hndlScore: number,
  generatedTasks: IntakeGeneratedTaskSnapshot[]
): IntakeSubmission {
  const current = loadDemoData();
  const submissions = loadIntakeSubmissions();
  const systemId = `INTAKE-${String(submissions.length + 1).padStart(3, "0")}`;
  const submittedAt = new Date().toISOString();
  const riskLevel = scoreToRiskLevel(hndlScore);
  const submission: IntakeSubmission = {
    id: `NI-${Date.now()}`,
    systemId,
    submittedAt,
    hndlScore,
    riskLevel,
    form,
    tasks: generatedTasks,
  };

  const nextSystem: System = {
    systemId,
    systemName: form.systemName || "未命名盤點系統",
    businessUnit: form.businessUnit || "待補單位",
    systemType: form.systemType || "待分類",
    businessCriticality: form.businessCriticality || riskLevel,
    dataTypes: normalizeDataTypes(form),
    dataRetentionYears: Number.parseInt(form.dataRetentionYears || "0", 10) || 0,
    hasExternalApi: Boolean(form.hasExternalExchange || form.hasRealtimeApi || form.hasBatchFile),
    externalParties: form.externalPartyTypes,
    vendorId: null,
    owner: form.systemOwner || "待指派",
    status: hndlScore >= 70 ? "security_review" : "in_progress",
    cmdbTags: buildCmdbTags(form),
    cryptoSignals: buildCryptoSignals(form),
    hndlRiskScore: hndlScore,
    lastUpdated: submittedAt.slice(0, 10),
  };

  const nextTasks: Task[] = generatedTasks.map((task, index) => ({
    taskId: `NI-TSK-${systemId}-${index + 1}`,
    relatedSystemId: systemId,
    assignedRole: normalizeRole(task.role),
    taskTitle: task.title,
    taskDescription: task.reason,
    priority: task.priority,
    dueDate: buildDueDate(index, task.priority),
    status: task.role === "供應商" || task.role === "採購" ? "waiting_vendor" : "open",
    reason: task.reason,
  }));

  const nextData: DemoData = {
    ...current,
    systems: [...current.systems.filter((system) => system.systemId !== systemId), nextSystem],
    tasks: [...current.tasks, ...nextTasks],
  };

  if (typeof window !== "undefined") {
    localStorage.setItem(INTAKE_SUBMISSIONS_KEY, JSON.stringify([...submissions, submission]));
  }
  saveDemoData(nextData);

  return submission;
}

export const activeDemoData = loadDemoData();
export const { systems, vendors, tasks, complianceLineage } = activeDemoData;

function scoreToRiskLevel(score: number): RiskLevel {
  if (score >= 80) return "critical";
  if (score >= 60) return "high";
  if (score >= 40) return "medium";
  return "low";
}

function normalizeDataTypes(form: IntakeFormSnapshot) {
  const dataTypes = [...form.sensitiveDataTypes];
  if (form.hasPersonalData && !dataTypes.includes("個資")) dataTypes.unshift("個資");
  return dataTypes.length ? dataTypes : ["待補資料分類"];
}

function buildCmdbTags(form: IntakeFormSnapshot) {
  return [
    form.hasPersonalData ? "PII" : null,
    Number.parseInt(form.dataRetentionYears || "0", 10) >= 10 ? "HNDL" : null,
    form.hasRealtimeApi ? "external API" : null,
    form.hasBatchFile ? "batch exchange" : null,
    form.hasDigitalSig ? "certificate" : null,
    form.hasHsm ? "HSM" : null,
  ].filter(Boolean) as string[];
}

function buildCryptoSignals(form: IntakeFormSnapshot) {
  return [
    form.usesHttps ? "HTTPS / TLS 待確認" : null,
    form.hasDigitalSig ? "digital signature / certificate" : null,
    form.hasHsm ? "HSM key custody" : null,
    form.hasApiCertOrToken ? "API token / key / file encryption" : null,
    form.vendorProvidesEncryption ? "vendor-managed crypto module" : null,
  ].filter(Boolean) as string[];
}

function normalizeRole(role: string): AssignedRole {
  if (role === "業務" || role === "系統Owner" || role === "資安" || role === "架構" || role === "採購" || role === "供應商") {
    return role;
  }
  return "系統Owner";
}

function buildDueDate(index: number, priority: "P1" | "P2" | "P3") {
  const days = priority === "P1" ? 7 : priority === "P2" ? 14 : 30;
  const date = new Date();
  date.setDate(date.getDate() + days + index);
  return date.toISOString().slice(0, 10);
}

function readFirstLegacyValue(keys: string[]) {
  for (const key of keys) {
    const value = localStorage.getItem(key);
    if (value) return value;
  }
  return null;
}
