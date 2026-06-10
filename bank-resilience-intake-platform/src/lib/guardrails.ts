/**
 * guardrails.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * 資料品質防呆與一致性警示。
 *
 * 每條防呆規則都會明確說明：
 *  - 觸發條件（哪個欄位 / 哪個矛盾）
 *  - 嚴重程度（error / warning / info）
 *  - 建議行動
 *  - 觸發原因（policy source）
 *
 * 與 risk-rules.ts 的差異：
 *  - risk-rules.ts：評分規則，決定風險等級
 *  - guardrails.ts：防呆規則，偵測資料缺口與矛盾
 */

import type { System, Vendor } from "@/data/demo-data";
import type { IntakeSubmission } from "@/lib/storage";

// ─── Types ─────────────────────────────────────────────────────────────────────

export type GuardrailSeverity = "error" | "warning" | "info";

export interface GuardrailAlert {
  alertId: string;
  guardrailId: string;
  guardrailName: string;
  severity: GuardrailSeverity;
  systemId: string;
  systemName: string;
  title: string;
  detail: string;
  targetRole: string;
  suggestedAction: string;
  policySource: string;
}

// ─── Guardrail definitions ─────────────────────────────────────────────────────

interface GuardrailDef {
  id: string;
  name: string;
  severity: GuardrailSeverity;
  targetRole: string;
  policySource: string;
  check: (sys: System, vendor: Vendor | null) => string | null;  // null = not triggered; string = detail message
  title: (sys: System) => string;
  suggestedAction: string;
}

const SENSITIVE_TYPES = ["保單", "授信", "醫療", "財務", "個資", "KYC", "健康", "理賠", "交易", "受益人"];
const LEGACY_CRYPTO_TAGS = [
  "legacy crypto",
  "tls 1.0",
  "tls 1.1",
  "legacy certificate",
  "unknown crypto module",
  "rsa 1024",
  "weak cipher",
];

/** 距今幾個月後的日期是否在 threshold 之內 */
function withinMonths(dateStr: string, months: number): boolean {
  if (!dateStr) return false;
  const target = new Date(dateStr);
  const threshold = new Date();
  threshold.setMonth(threshold.getMonth() + months);
  return target > new Date() && target <= threshold;
}

export const GUARDRAIL_DEFS: GuardrailDef[] = [
  // ── GRD-01: 敏感資料類型有值，但保存年限未填 ──────────────────────────────
  {
    id: "GRD-01",
    name: "敏感資料保存年限缺失",
    severity: "error",
    targetRole: "業務",
    policySource: "CISA PQC Roadmap 2023 / Internal DATA-RETAIN-POL Rev.2.1",
    check: (sys) => {
      const hasSensitive = SENSITIVE_TYPES.some(t => sys.dataTypes.some(dt => dt.includes(t)));
      if (hasSensitive && (sys.dataRetentionYears === 0 || sys.dataRetentionYears === null || sys.dataRetentionYears === undefined)) {
        const sensitiveFound = SENSITIVE_TYPES.filter(t => sys.dataTypes.some(dt => dt.includes(t)));
        return `系統包含 ${sensitiveFound.join("、")} 等敏感資料，但保存年限欄位為空或 0`;
      }
      return null;
    },
    title: (sys) => `${sys.systemName}：敏感資料類型已填但保存年限未填`,
    suggestedAction: "業務負責人補填法定保存年限，資安才能完成 HNDL 風險評分",
  },

  // ── GRD-02: 有外部 API 但外部對象清單為空 ─────────────────────────────────
  {
    id: "GRD-02",
    name: "外部 API 串接對象未填寫",
    severity: "warning",
    targetRole: "業務",
    policySource: "FSC 金融資安韌性修訂草案 2026 Section 6.1",
    check: (sys) => {
      if (sys.hasExternalApi && sys.externalParties.length === 0) {
        return "系統標記為有外部 API 串接，但未填寫任何外部對象名稱";
      }
      return null;
    },
    title: (sys) => `${sys.systemName}：標記有外部 API 但串接對象清單為空`,
    suggestedAction: "業務負責人補充外部串接對象清單，包含機構名稱與資料交換類型",
  },

  // ── GRD-03: 供應商未提供 PQC 遷移計畫（產生採購待辦） ─────────────────────
  {
    id: "GRD-03",
    name: "供應商 PQC 遷移計畫缺失",
    severity: "warning",
    targetRole: "採購",
    policySource: "FSC 科技外包要點 Section 5.3",
    check: (sys, vendor) => {
      const roadmap = vendor?.pqcRoadmapStatus;
      if (sys.vendorId && vendor && (!roadmap || roadmap === "未提供" || (roadmap as string) === "未確認")) {
        return `供應商「${vendor.vendorName}」尚未提供 PQC 遷移計畫`;
      }
      return null;
    },
    title: (sys) => `${sys.systemName}：供應商 PQC 遷移計畫缺失，需採購與供應商跟進`,
    suggestedAction: "採購發出正式詢問，要求供應商在 30 天內提交 PQC 技術準備度聲明；同時由供應商提交遷移計畫",
  },

  // ── GRD-04: CMDB 顯示 legacy crypto，但系統風險評分偏低（矛盾） ───────────
  {
    id: "GRD-04",
    name: "CMDB Legacy Crypto 與低風險評分矛盾",
    severity: "warning",
    targetRole: "資安",
    policySource: "NIST SP 800-131A Rev.3 / Internal 防呆規則",
    check: (sys) => {
      const allTags = [...sys.cmdbTags, ...sys.cryptoSignals];
      const hasLegacyTag = allTags.some(item => {
        const value = item.toLowerCase();
        return LEGACY_CRYPTO_TAGS.some(tag => value.includes(tag));
      });
      if (hasLegacyTag && sys.hndlRiskScore < 45) {
        const legacyItems = allTags.filter(item => {
          const value = item.toLowerCase();
          return LEGACY_CRYPTO_TAGS.some(tag => value.includes(tag));
        });
        return `CMDB 包含舊型加密標記（${legacyItems.join("、")}），但 HNDL 風險評分僅 ${sys.hndlRiskScore}，可能有評分依據缺失`;
      }
      return null;
    },
    title: (sys) => `${sys.systemName}：CMDB 舊型加密標記與低風險評分矛盾`,
    suggestedAction: "資安複查系統資料類型與保存年限填報是否完整，確認低風險評分是否反映實際狀況",
  },

  // ── GRD-05: 合約即將到期（< 6 個月），需採購優先確認 ──────────────────────
  {
    id: "GRD-05",
    name: "供應商追蹤期限迫近（< 90 天）",
    severity: "warning",
    targetRole: "採購",
    policySource: "Internal 合約管理指引 / PROC-TECH-CLAUSE Rev.1.2",
    check: (sys, vendor) => {
      if (sys.vendorId && vendor && withinMonths(vendor.nextFollowUpDate, 3)) {
        return `供應商「${vendor.vendorName}」追蹤截止日 ${vendor.nextFollowUpDate} 距今不足 90 天，合約 PQC 條款尚未確認（${vendor.contractUpgradeClause}）`;
      }
      return null;
    },
    title: (sys) => `${sys.systemName}：供應商合約追蹤期限即將到來`,
    suggestedAction: "採購在本季末前確認合約中是否包含加密升級義務條款，若無需排入下次合約更新議程",
  },

  // ── GRD-06: 高重要性系統但狀態為「尚未開始」 ─────────────────────────────
  {
    id: "GRD-06",
    name: "重大/高重要性系統盤點尚未開始",
    severity: "error",
    targetRole: "系統Owner",
    policySource: "FSC 金融資安行動方案 2.0 Section 3",
    check: (sys) => {
      if ((sys.businessCriticality === "critical" || sys.businessCriticality === "high") &&
          sys.status === "not_started") {
        return `系統業務重要性為「${sys.businessCriticality === "critical" ? "重大" : "高"}」，但 PQC 盤點狀態仍為「尚未開始」`;
      }
      return null;
    },
    title: (sys) => `${sys.systemName}：重要系統盤點尚未啟動`,
    suggestedAction: "系統 Owner 立即啟動盤點流程，或提供已進行中的具體說明",
  },

  // ── GRD-07: 涉及跨機構資料交換但無加密傳輸說明 ──────────────────────────
  {
    id: "GRD-07",
    name: "跨機構資料交換加密傳輸說明缺失",
    severity: "warning",
    targetRole: "資安",
    policySource: "FSC 金融資安韌性修訂草案 2026 Section 6.2 / NIST SP 1800-38B Section 5",
    check: (sys) => {
      const crossInstitutional = sys.hasExternalApi && sys.externalParties.length > 0;
      const missingCryptoSignal = !sys.cryptoSignals.some(s =>
        /tls|ssl|https|mtls|token|憑證|簽章|encrypt|api.key/i.test(s)
      );
      if (crossInstitutional && missingCryptoSignal) {
        return `系統涉及跨機構資料交換（${sys.externalParties.slice(0, 2).join("、")}），但加密信號欄位未填寫憑證、簽章、API Token 或加密傳輸資訊`;
      }
      return null;
    },
    title: (sys) => `${sys.systemName}：跨機構交換但缺少加密傳輸說明`,
    suggestedAction: "資安確認跨機構 API 是否使用 mTLS / HTTPS / API Token 保護，補充至加密信號欄位",
  },
];

// ─── Execution engine ─────────────────────────────────────────────────────────

/**
 * runGuardrails() — 針對所有系統執行防呆檢查
 * 回傳所有被觸發的警示，按嚴重程度排序（error → warning → info）
 */
export function runGuardrails(
  systems: System[],
  vendors: Vendor[],
): GuardrailAlert[] {
  const vendorMap = new Map(vendors.map(v => [v.vendorId, v]));
  const alerts: GuardrailAlert[] = [];
  let counter = 0;

  for (const sys of systems) {
    const vendor = sys.vendorId ? (vendorMap.get(sys.vendorId) ?? null) : null;
    for (const def of GUARDRAIL_DEFS) {
      const detail = def.check(sys, vendor);
      if (detail !== null) {
        counter++;
        alerts.push({
          alertId: `GRD-ALT-${String(counter).padStart(3, "0")}`,
          guardrailId: def.id,
          guardrailName: def.name,
          severity: def.severity,
          systemId: sys.systemId,
          systemName: sys.systemName,
          title: def.title(sys),
          detail,
          targetRole: def.targetRole,
          suggestedAction: def.suggestedAction,
          policySource: def.policySource,
        });
      }
    }
  }

  const order: GuardrailSeverity[] = ["error", "warning", "info"];
  return alerts.sort((a, b) => order.indexOf(a.severity) - order.indexOf(b.severity));
}

/**
 * runIntakeGuardrails() — 針對新提交的盤點資料執行防呆
 * 主要處理合約到期日等盤點資料專屬欄位
 */
export function runIntakeGuardrails(submissions: IntakeSubmission[]): GuardrailAlert[] {
  const alerts: GuardrailAlert[] = [];
  let counter = 0;

  for (const sub of submissions) {
    const form = sub.form;

    // 合約到期日 < 6 個月
    if (form.contractExpiry && withinMonths(form.contractExpiry, 6)) {
      counter++;
      alerts.push({
        alertId: `INT-ALT-${String(counter).padStart(3, "0")}`,
        guardrailId: "GRD-05B",
        guardrailName: "盤點資料：合約到期日 < 6 個月",
        severity: "warning",
        systemId: sub.systemId,
        systemName: form.systemName || "（未命名）",
        title: `${form.systemName || "未命名系統"}：合約到期日 ${form.contractExpiry} 距今不足 6 個月`,
        detail: `盤點資料填寫的合約到期日為 ${form.contractExpiry}，供應商合約即將到期，建議於續約或新約中納入 PQC 遷移計畫、加密調整能力與資安升級責任條款。`,
        targetRole: "採購",
        suggestedAction: "採購在合約到期前確認是否加入 PQC 遷移計畫、加密調整能力與資安升級責任條款，若無需立即安排修約",
        policySource: "Internal PROC-TECH-CLAUSE Rev.1.2 Section 7",
      });
    }

    // 敏感資料有填但保存年限空白
    if (form.sensitiveDataTypes.length > 0 && (!form.dataRetentionYears || parseInt(form.dataRetentionYears) === 0)) {
      counter++;
      alerts.push({
        alertId: `INT-ALT-${String(counter).padStart(3, "0")}`,
        guardrailId: "GRD-01B",
        guardrailName: "盤點資料：敏感資料未填保存年限",
        severity: "error",
        systemId: sub.systemId,
        systemName: form.systemName || "（未命名）",
        title: `${form.systemName || "未命名系統"}：填寫了 ${form.sensitiveDataTypes.length} 種敏感資料，但保存年限未填`,
        detail: `盤點資料中的敏感資料包含：${form.sensitiveDataTypes.slice(0, 3).join("、")}，但保存年限欄位為空`,
        targetRole: "業務",
        suggestedAction: "請系統 Owner 補充保存年限，資安才能完成 HNDL 風險評分",
        policySource: "CISA PQC Roadmap 2023 / Internal DATA-RETAIN-POL Rev.2.1",
      });
    }

    if ((form.hasExternalExchange || form.hasRealtimeApi || form.hasBatchFile) && form.externalPartyTypes.length === 0) {
      counter++;
      alerts.push({
        alertId: `INT-ALT-${String(counter).padStart(3, "0")}`,
        guardrailId: "GRD-02B",
        guardrailName: "盤點資料：外部串接對象未填",
        severity: "warning",
        systemId: sub.systemId,
        systemName: form.systemName || "（未命名）",
        title: `${form.systemName || "未命名系統"}：涉及外部串接但未填外部對象`,
        detail: "此系統涉及外部串接，請補充外部對象，例如財金、聯徵、保險公司、醫療院所、政府機關或第三方 API。",
        targetRole: "業務",
        suggestedAction: "補齊外部對象與資料交換類型，資安才能確認每個串接點的加密保護。",
        policySource: "FSC 金融資安韌性修訂草案 2026 Section 6.1",
      });
    }

    if ((form.hasExternalExchange || form.hasRealtimeApi || form.hasBatchFile) &&
        form.hasDigitalSig === null && form.hasApiCertOrToken === null && form.usesHttps === null) {
      counter++;
      alerts.push({
        alertId: `INT-ALT-${String(counter).padStart(3, "0")}`,
        guardrailId: "GRD-07B",
        guardrailName: "盤點資料：外部交換加密情境未確認",
        severity: "warning",
        systemId: sub.systemId,
        systemName: form.systemName || "（未命名）",
        title: `${form.systemName || "未命名系統"}：跨機構交換但未填憑證、簽章、Token 或 HTTPS`,
        detail: "若系統涉及跨機構資料交換，但未填是否有憑證、簽章、API token 或加密傳輸，需提示資安待確認。",
        targetRole: "資安",
        suggestedAction: "資安確認 TLS / mTLS / 憑證 / 簽章 / API token / 批次檔加密是否存在，並建立 PQC 遷移依存。",
        policySource: "NIST SP 1800-38B / Internal API-SEC-STD Rev.1.5",
      });
    }
  }

  return alerts;
}

/** 計算各嚴重程度的防呆告警數量 */
export function countBySeverity(alerts: GuardrailAlert[]): Record<GuardrailSeverity, number> {
  return {
    error:   alerts.filter(a => a.severity === "error").length,
    warning: alerts.filter(a => a.severity === "warning").length,
    info:    alerts.filter(a => a.severity === "info").length,
  };
}
