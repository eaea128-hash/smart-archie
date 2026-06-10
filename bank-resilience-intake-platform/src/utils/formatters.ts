/**
 * utils/formatters.ts
 * 統一的顯示格式化工具，避免各頁面重複轉換邏輯。
 */

import type { RiskLevel, TaskStatus, AssignedRole } from "@/types";
import { systemStatusLabel, riskLevelLabel, assignedRoleLabel, taskStatusLabel } from "@/lib/labels";

/** 保存年限轉人類可讀字串 */
export function fmtRetention(years: number): string {
  if (years >= 99) return "永久";
  if (years === 0) return "未填寫";
  return `${years} 年`;
}

/** 日期字串轉本地格式，空值回傳 — */
export function fmtDate(dateStr: string | null | undefined): string {
  if (!dateStr) return "—";
  try {
    return new Date(dateStr).toLocaleDateString("zh-TW", { year: "numeric", month: "2-digit", day: "2-digit" });
  } catch {
    return dateStr;
  }
}

/** HNDL 分數轉風險等級 */
export function scoreToRisk(score: number): RiskLevel {
  if (score >= 80) return "critical";
  if (score >= 55) return "high";
  if (score >= 35) return "medium";
  return "low";
}

/** 系統狀態 key → 中文 */
export { systemStatusLabel as fmtStatus };

/** 風險等級 → 中文 */
export { riskLevelLabel as fmtRisk };

/** 負責角色 → 中文 */
export { assignedRoleLabel as fmtRole };

/** 任務狀態 → 中文 */
export { taskStatusLabel as fmtTaskStatus };

/** 把 HNDL score 轉為 0–100 百分比字串（for CSS width） */
export function scoreToPct(score: number): string {
  return `${Math.min(100, Math.max(0, score))}%`;
}

/** 截斷長字串 */
export function truncate(str: string, max = 40): string {
  return str.length > max ? `${str.slice(0, max)}…` : str;
}

/** 複數化中文標籤（件、個、條） */
export function countLabel(n: number, unit: string): string {
  return `${n} ${unit}`;
}

/** 顯示距今幾天（用於 nextFollowUpDate 警示） */
export function daysFromNow(dateStr: string): number {
  const ms = new Date(dateStr).getTime() - Date.now();
  return Math.round(ms / 86_400_000);
}

/** 將 AssignedRole 轉 badge 配色 class */
export function roleBadgeCls(role: AssignedRole): string {
  const map: Record<AssignedRole, string> = {
    業務: "bg-blue-100 text-blue-800 border-blue-200",
    系統Owner: "bg-purple-100 text-purple-800 border-purple-200",
    資安: "bg-rose-100 text-rose-800 border-rose-200",
    架構: "bg-indigo-100 text-indigo-800 border-indigo-200",
    採購: "bg-amber-100 text-amber-800 border-amber-200",
    供應商: "bg-slate-100 text-slate-800 border-slate-200",
  };
  return map[role] ?? "bg-slate-100 text-slate-800 border-slate-200";
}

/** TaskStatus → 進度百分比（用於進度視覺） */
export function taskStatusToProgress(status: TaskStatus): number {
  const map: Record<TaskStatus, number> = {
    open: 0,
    in_progress: 40,
    waiting_vendor: 60,
    waiting_internal: 70,
    completed: 100,
  };
  return map[status] ?? 0;
}
