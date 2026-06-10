import type { AssignedRole } from "@/data/demo-data";
import type { IntakeFormSnapshot, IntakeGeneratedTaskSnapshot } from "@/lib/storage";

export interface TaskGenerationRule {
  ruleId: string;
  assignedRole: AssignedRole;
  triggerRule: string;
  suggestedAction: string;
}

export const taskGenerationRules: TaskGenerationRule[] = [
  {
    ruleId: "TASK-VENDOR-ROADMAP-PROC",
    assignedRole: "採購",
    triggerRule: "供應商 PQC 遷移計畫為未提供、未確認或空白",
    suggestedAction: "向供應商索取 PQC 遷移計畫、加密調整能力證據與升級時程。",
  },
  {
    ruleId: "TASK-VENDOR-ROADMAP-SUPPLIER",
    assignedRole: "供應商",
    triggerRule: "供應商 PQC 遷移計畫為未提供、未確認或空白",
    suggestedAction: "提交後量子密碼支援能力、演算法替換計畫與預計版本時程。",
  },
  {
    ruleId: "TASK-CONTRACT-EXPIRY",
    assignedRole: "採購",
    triggerRule: "供應商合約到期日距今天小於 6 個月",
    suggestedAction: "於續約或新約中納入 PQC 遷移計畫、加密調整能力與資安升級責任條款。",
  },
];

export function generateIntakeTasks(form: IntakeFormSnapshot, hndlScore: number): IntakeGeneratedTaskSnapshot[] {
  const tasks: IntakeGeneratedTaskSnapshot[] = [];
  const sysName = form.systemName || "此系統";

  tasks.push({
    role: "資安",
    priority: hndlScore >= 60 ? "P1" : "P2",
    title: `完成 ${sysName} 的密碼技術依存盤點（CBOM）`,
    reason: "所有系統均需建立密碼技術清單，作為 PQC 遷移計畫起點",
  });

  if (parseInt(form.dataRetentionYears || "0", 10) >= 10) {
    tasks.push({
      role: "業務",
      priority: "P1",
      title: `確認 ${sysName} 資料保存年限的法規依據與縮短可行性`,
      reason: `保存年限 ${form.dataRetentionYears} 年，超出 HNDL 風險閾值（10 年），需評估是否可合法縮短`,
    });
  }

  if (form.hasRealtimeApi || form.hasBatchFile) {
    tasks.push({
      role: "業務",
      priority: "P1",
      title: `補充 ${sysName} 各外部 API 串接點的加密協定細節`,
      reason: "現有盤點僅記錄對象名稱，需逐點說明 TLS 版本與憑證種類（FSC 草案要求）",
    });
  }

  if (form.hasVendor && !form.vendorHasRoadmap) {
    const roadmapReason = "供應商尚未提供 PQC 遷移計畫，需確認其後量子密碼支援能力與升級時程。";
    tasks.push({
      role: "採購",
      priority: "P1",
      title: `向 ${form.vendorName || "供應商"} 索取 PQC 遷移計畫與加密演算法升級計畫`,
      reason: roadmapReason,
    });
    tasks.push({
      role: "供應商",
      priority: "P1",
      title: `提交 ${sysName} 的 PQC 準備度聲明`,
      reason: roadmapReason,
    });
  }

  if (form.hasVendor && form.contractHasSecurityClause === false) {
    tasks.push({
      role: "採購",
      priority: "P2",
      title: `在 ${form.vendorName || "供應商"} 合約更新時新增加密技術升級義務條款`,
      reason: "合約缺乏技術升級責任條款，未來要求供應商執行 PQC 遷移將缺乏法律依據",
    });
  }

  if (form.hasVendor && isWithinMonths(form.contractExpiry, 6)) {
    tasks.push({
      role: "採購",
      priority: "P1",
      title: `優先檢視 ${form.vendorName || "供應商"} 續約條款`,
      reason: "供應商合約即將到期，建議於續約或新約中納入 PQC 遷移計畫、加密調整能力與資安升級責任條款。",
    });
  }

  if (form.hasHsm) {
    tasks.push({
      role: "架構",
      priority: "P2",
      title: `確認 ${sysName} 使用的 HSM 型號是否支援後量子演算法（CRYSTALS-Kyber / Dilithium）`,
      reason: "部分 HSM 硬體不支援 NIST 選定的後量子演算法，可能需要韌體升級或換購",
    });
  }

  if (form.hasCrossBorder) {
    tasks.push({
      role: "資安",
      priority: "P1",
      title: `評估 ${sysName} 跨境資料交換路徑的量子威脅暴露風險`,
      reason: "跨境傳輸在 HNDL 攻擊中暴露時間更長，需優先加強傳輸加密強度",
    });
  }

  if ((form.hasExternalExchange || form.hasRealtimeApi || form.hasBatchFile) &&
      form.usesHttps === null && form.hasDigitalSig === null && form.hasApiCertOrToken === null) {
    tasks.push({
      role: "資安",
      priority: "P1",
      title: `確認 ${sysName} 跨機構交換的憑證、簽章、API token 或加密傳輸`,
      reason: "系統涉及跨機構資料交換，但尚未填寫是否使用憑證、簽章、API token 或加密傳輸。",
    });
  }

  if (form.vendorCryptoAgility === false || (form.hasVendor && form.vendorCryptoAgility === null)) {
    tasks.push({
      role: "架構",
      priority: "P2",
      title: `評估 ${sysName} 的加密調整能力，確認能否在不中斷服務下替換演算法`,
      reason: "缺乏加密調整能力代表遷移時可能須停機或大規模改版，需提前規劃",
    });
  }

  if (form.involvesRegulatory) {
    tasks.push({
      role: "系統Owner",
      priority: "P2",
      title: `確認 ${sysName} 監理申報資料的加密傳輸協定是否符合最新 FSC 要求`,
      reason: "涉及法定資料保存的系統受 FSC 直接監管，加密標準需符合最新要求",
    });
  }

  return tasks;
}

function isWithinMonths(dateStr: string, months: number): boolean {
  if (!dateStr) return false;
  const target = new Date(dateStr);
  if (Number.isNaN(target.getTime())) return false;
  const threshold = new Date();
  threshold.setMonth(threshold.getMonth() + months);
  return target > new Date() && target <= threshold;
}
