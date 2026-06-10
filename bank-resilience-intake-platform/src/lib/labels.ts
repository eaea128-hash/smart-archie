import type {
  AssignedRole,
  ContractUpgradeClause,
  CryptoAgilityStatus,
  PqcRoadmapStatus,
  RiskLevel,
  SystemStatus,
  TaskStatus
} from "@/data/demo-data";

export const riskLevelLabel: Record<RiskLevel, string> = {
  critical: "重大",
  high: "高",
  medium: "中",
  low: "低"
};

export const systemStatusLabel: Record<SystemStatus, string> = {
  not_started: "尚未開始",
  in_progress: "盤點中",
  security_review: "資安審查",
  procurement_followup: "採購追蹤",
  completed: "已完成"
};

export const pqcRoadmapLabel: Record<PqcRoadmapStatus, string> = {
  已提供: "已提供",
  部分提供: "部分提供",
  未提供: "未提供",
  不適用: "不適用"
};

export const cryptoAgilityLabel: Record<CryptoAgilityStatus, string> = {
  已支援: "已支援",
  部分支援: "部分支援",
  未確認: "未確認",
  不支援: "不支援"
};

export const contractClauseLabel: Record<ContractUpgradeClause, string> = {
  有: "有",
  無: "無",
  待確認: "待確認"
};

export const assignedRoleLabel: Record<AssignedRole, string> = {
  業務: "業務",
  系統Owner: "系統Owner",
  資安: "資安",
  架構: "架構",
  採購: "採購",
  供應商: "供應商"
};

export const taskStatusLabel: Record<TaskStatus, string> = {
  open: "待處理",
  in_progress: "處理中",
  waiting_vendor: "等待供應商",
  waiting_internal: "等待內部確認",
  completed: "已完成"
};

export const vendorReadinessScore = (
  roadmap: PqcRoadmapStatus,
  agility: CryptoAgilityStatus,
  contract: ContractUpgradeClause
): number => {
  const r = roadmap === "已提供" ? 40 : roadmap === "部分提供" ? 25 : roadmap === "不適用" ? 30 : 0;
  const a = agility === "已支援" ? 35 : agility === "部分支援" ? 20 : agility === "未確認" ? 5 : 0;
  const c = contract === "有" ? 25 : contract === "待確認" ? 10 : 0;
  return r + a + c;
};
