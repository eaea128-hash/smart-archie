/**
 * export-utils.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * 統一的匯出工具函式。所有頁面的 JSON / CSV / Markdown 匯出都應使用此模組，
 * 避免各頁面各自實作造成格式不一致。
 */

import type { System, Vendor, Task } from "@/data/demo-data";
import type { RuleEvaluationResult } from "@/lib/risk-rules";

// ─── Core download utility ────────────────────────────────────────────────────

export function downloadFile(filename: string, content: string, mimeType: string): void {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

// ─── Format helpers ───────────────────────────────────────────────────────────

const RISK_ZH: Record<string, string> = {
  critical: "重大", high: "高", medium: "中", low: "低",
};

const STATUS_ZH: Record<string, string> = {
  not_started: "尚未開始", in_progress: "盤點中", security_review: "資安審查",
  procurement_followup: "採購追蹤", completed: "已完成",
};

const TASK_STATUS_ZH: Record<string, string> = {
  open: "待處理", in_progress: "處理中", waiting_vendor: "等待供應商",
  waiting_internal: "等待內部確認", completed: "已完成",
};

function csvEscape(value: unknown): string {
  const str = value === null || value === undefined ? "" : String(value);
  return `"${str.replace(/"/g, '""')}"`;
}

function formatDate(): string {
  return new Date().toLocaleDateString("zh-TW", {
    year: "numeric", month: "long", day: "numeric",
  });
}

// ─── System report exports ────────────────────────────────────────────────────

export interface SystemReportPayload {
  system: System;
  vendor: Vendor | null;
  tasks: Task[];
  evaluation?: RuleEvaluationResult;
}

export function exportSystemJson(payload: SystemReportPayload): void {
  const { system, vendor, tasks, evaluation } = payload;
  const data = {
    meta: {
      reportType: "PQC Intake Evidence Pack",
      reportId: `RPT-${system.systemId}-${Date.now()}`,
      generatedAt: new Date().toISOString(),
      classification: "機密 — 限定資安管理使用（本報告為模擬資料）",
    },
    system,
    vendor: vendor ?? null,
    riskEvaluation: evaluation ?? null,
    tasks: tasks.filter(t => t.status !== "completed"),
    completedTasks: tasks.filter(t => t.status === "completed"),
  };
  downloadFile(
    `${system.systemId}-pqc-evidence-pack.json`,
    JSON.stringify(data, null, 2),
    "application/json;charset=utf-8",
  );
}

export function exportSystemCsv(payload: SystemReportPayload): void {
  const { system, vendor, tasks, evaluation } = payload;
  const rows: [string, string][] = [
    ["報告類型", "PQC Intake Evidence Pack"],
    ["產生日期", formatDate()],
    ["系統 ID", system.systemId],
    ["系統名稱", system.systemName],
    ["所屬單位", system.businessUnit],
    ["系統類型", system.systemType],
    ["業務重要性", RISK_ZH[system.businessCriticality] ?? system.businessCriticality],
    ["HNDL 風險評分", String(system.hndlRiskScore)],
    ["資料保存年限（年）", system.dataRetentionYears >= 99 ? "永久" : String(system.dataRetentionYears)],
    ["敏感資料類型", system.dataTypes.join("、")],
    ["有外部 API", system.hasExternalApi ? "是" : "否"],
    ["外部串接對象", system.externalParties.join("、") || "（未填）"],
    ["加密信號", system.cryptoSignals.join("、")],
    ["CMDB 標籤", system.cmdbTags.join("、")],
    ["盤點狀態", STATUS_ZH[system.status] ?? system.status],
    ["供應商 ID", system.vendorId ?? "無"],
    ["供應商名稱", vendor?.vendorName ?? "無"],
    ["供應商 PQC 遷移計畫", vendor?.pqcRoadmapStatus ?? "無"],
    ["Crypto-agility 狀態", vendor?.cryptoAgilityStatus ?? "無"],
    ["合約資安升級條款", vendor?.contractUpgradeClause ?? "無"],
    ["風險評分觸發規則數", evaluation ? String(evaluation.triggeredRules.length) : "（未計算）"],
    ["待辦任務數", String(tasks.filter(t => t.status !== "completed").length)],
    ...tasks.map(t => [
      `待辦任務 ${t.taskId}`,
      `[${t.priority}][${t.assignedRole}][${TASK_STATUS_ZH[t.status] ?? t.status}] ${t.taskTitle}`,
    ] as [string, string]),
  ];

  const csv = rows.map(([k, v]) => `${csvEscape(k)},${csvEscape(v)}`).join("\n");
  downloadFile(
    `${system.systemId}-pqc-evidence-pack.csv`,
    "﻿" + csv,  // BOM for Excel UTF-8
    "text/csv;charset=utf-8",
  );
}

export function exportSystemMarkdown(payload: SystemReportPayload): void {
  const { system, vendor, tasks, evaluation } = payload;
  const openTasks = tasks.filter(t => t.status !== "completed");

  const md = `# PQC Intake Evidence Pack — ${system.systemName}

> **報告日期：** ${formatDate()}
> **分類：** 機密 — 限定資安管理使用（本報告為模擬資料）
> **系統 ID：** \`${system.systemId}\`

---

## Executive Summary

| 項目 | 內容 |
|------|------|
| 系統名稱 | ${system.systemName} |
| 業務單位 | ${system.businessUnit} |
| 業務重要性 | **${RISK_ZH[system.businessCriticality] ?? system.businessCriticality}** |
| HNDL 風險評分 | **${system.hndlRiskScore} / 100** |
| HNDL 高風險 | ${system.hndlRiskScore >= 80 ? "⚠ 是" : "否"} |
| 待辦任務數 | ${openTasks.length} |

---

## 風險規則觸發記錄

${evaluation ? evaluation.triggeredRules.map(t =>
  `### ${t.rule.ruleId} — ${t.rule.name}\n\n` +
  `- **觸發訊息：** ${t.message}\n` +
  `- **評分貢獻：** +${t.contribution} 分\n` +
  `- **政策來源：** ${t.rule.policySource}\n` +
  `- **參考標準：** *${t.rule.policyReference}*\n`
).join("\n") : "（本次匯出未包含規則評估結果）"}

---

## Data Lifespan & HNDL Risk

- **資料保存年限：** ${system.dataRetentionYears >= 99 ? "永久保存" : system.dataRetentionYears + " 年"}
- **敏感資料類型：** ${system.dataTypes.join("、")}
- **HNDL 風險評分：** ${system.hndlRiskScore}/100

---

## Crypto Signals

| 信號 | 說明 |
|------|------|
${system.cryptoSignals.map(s => `| \`${s}\` | — |`).join("\n")}

**CMDB Tags:** ${system.cmdbTags.map(t => `\`${t}\``).join(", ")}

---

## 供應商準備度

${vendor ? `
| 項目 | 狀態 |
|------|------|
| 供應商名稱 | ${vendor.vendorName} |
| PQC 遷移計畫 | ${vendor.pqcRoadmapStatus} |
| Crypto-agility | ${vendor.cryptoAgilityStatus} |
| 合約資安升級條款 | ${vendor.contractUpgradeClause} |
| 供應商風險等級 | ${RISK_ZH[vendor.riskLevel] ?? vendor.riskLevel} |
` : "本系統無外部供應商。"}

---

## Cross-functional Action Items

${openTasks.length === 0 ? "（無待辦任務）" : openTasks.map(t =>
  `### [${t.priority}] ${t.taskTitle}\n\n` +
  `- **負責角色：** ${t.assignedRole}\n` +
  `- **截止日：** ${t.dueDate}\n` +
  `- **狀態：** ${TASK_STATUS_ZH[t.status] ?? t.status}\n` +
  `- **觸發原因：** ${t.reason}\n`
).join("\n")}

---

*本證據包由 Bank Resilience Intake Platform 自動產生。所有資料為模擬資料，不含任何真實公司、客戶或系統資訊。*
`;

  downloadFile(
    `${system.systemId}-pqc-evidence-pack.md`,
    md,
    "text/markdown;charset=utf-8",
  );
}

// ─── Fleet-level export ───────────────────────────────────────────────────────

export function exportFleetJson(systems: System[], vendors: Vendor[], tasks: Task[]): void {
  const vendorMap = new Map(vendors.map(v => [v.vendorId, v]));
  const data = {
    meta: {
      reportType: "PQC Fleet Overview Report",
      reportId: `FLEET-RPT-${Date.now()}`,
      generatedAt: new Date().toISOString(),
      classification: "機密 — 限定資安管理使用（本報告為模擬資料）",
      systemCount: systems.length,
      vendorCount: vendors.length,
      taskCount: tasks.length,
    },
    summary: {
      hndlHigh: systems.filter(s => s.hndlRiskScore >= 80).length,
      vendorNoRoadmap: vendors.filter(v => v.pqcRoadmapStatus === "未提供").length,
      openTasks: tasks.filter(t => t.status !== "completed").length,
    },
    systems: systems.map(sys => ({
      ...sys,
      vendor: sys.vendorId ? vendorMap.get(sys.vendorId) ?? null : null,
    })),
    tasks,
  };
  downloadFile(
    `pqc-fleet-report-${new Date().toISOString().slice(0,10)}.json`,
    JSON.stringify(data, null, 2),
    "application/json;charset=utf-8",
  );
}

export function exportFleetCsv(systems: System[], vendors: Vendor[], tasks: Task[]): void {
  const vendorMap = new Map(vendors.map(v => [v.vendorId, v]));
  const header = ["系統ID","系統名稱","業務單位","業務重要性","HNDL評分","保存年限","有外部API","供應商名稱","PQC遷移計畫","加密調整能力","合約條款","盤點狀態"];
  const rows = systems.map(sys => {
    const v = sys.vendorId ? vendorMap.get(sys.vendorId) : null;
    return [
      sys.systemId, sys.systemName, sys.businessUnit,
      RISK_ZH[sys.businessCriticality] ?? sys.businessCriticality,
      String(sys.hndlRiskScore),
      sys.dataRetentionYears >= 99 ? "永久" : String(sys.dataRetentionYears),
      sys.hasExternalApi ? "是" : "否",
      v?.vendorName ?? "無",
      v?.pqcRoadmapStatus ?? "無",
      v?.cryptoAgilityStatus ?? "無",
      v?.contractUpgradeClause ?? "無",
      STATUS_ZH[sys.status] ?? sys.status,
    ].map(csvEscape).join(",");
  });
  const csv = [header.map(csvEscape).join(","), ...rows].join("\n");
  downloadFile(
    `pqc-fleet-report-${new Date().toISOString().slice(0,10)}.csv`,
    "﻿" + csv,
    "text/csv;charset=utf-8",
  );
}
