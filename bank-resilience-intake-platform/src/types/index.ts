/**
 * types/index.ts
 * 集中匯出所有跨頁面使用的型別。
 * 頁面元件和 lib 模組應從此處引用型別，避免直接依賴 demo-data。
 */

export type {
  RiskLevel,
  SystemStatus,
  PqcRoadmapStatus,
  CryptoAgilityStatus,
  ContractUpgradeClause,
  AssignedRole,
  TaskStatus,
  SourceType,
  System,
  Vendor,
  Task,
  ComplianceLineage,
} from "@/data/demo-data";

export type { GuardrailAlert, GuardrailSeverity } from "@/lib/guardrails";
export type { RiskRule, TriggeredRule, RuleEvaluationResult, RiskExplanation } from "@/lib/risk-rules";
export type { IntakeSubmission } from "@/lib/storage";

export interface ValidationIssue {
  issueId: string;
  severity: "error" | "warning" | "info";
  field: string;
  message: string;
  suggestedAction: string;
}

export interface IntakeReport {
  reportId: string;
  generatedAt: string;
  systemId: string;
  executiveSummary: string[];
  riskReasons: string[];
  complianceGaps: string[];
}
