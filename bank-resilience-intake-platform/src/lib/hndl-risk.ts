import type { System, Vendor } from "@/data/demo-data";

export type HndlRiskLevel = "high" | "medium" | "low";

export interface HndlRiskAssessment {
  level: HndlRiskLevel;
  reasons: string[];
  suggestions: string[];
}

const SENSITIVE_KEYWORDS = ["個資", "客戶", "KYC", "保單", "醫療", "病歷", "授信", "財務", "交易資料", "交易", "信用", "資產", "投資", "帳務", "持卡", "受益人", "健康"];

export function isPermanentRetention(years: number) {
  return years >= 99;
}

export function formatRetention(years: number) {
  return isPermanentRetention(years) ? "永久保存" : `${years} 年`;
}

export function isSensitiveDataType(dataType: string) {
  return SENSITIVE_KEYWORDS.some((keyword) => dataType.includes(keyword));
}

export function hasSensitiveData(dataTypes: string[]) {
  return dataTypes.some(isSensitiveDataType);
}

export function assessHndlRisk(system: System, vendor?: Vendor): HndlRiskAssessment {
  const permanent = isPermanentRetention(system.dataRetentionYears);
  const longRetention = system.dataRetentionYears >= 10;
  const mediumRetention = system.dataRetentionYears >= 5 && system.dataRetentionYears < 10;
  const sensitive = hasSensitiveData(system.dataTypes);
  const highCriticality = system.businessCriticality === "critical" || system.businessCriticality === "high";
  const vendorRoadmapUnconfirmed = !!vendor && (vendor.pqcRoadmapStatus === "未提供" || vendor.pqcRoadmapStatus === "部分提供");
  const reasons: string[] = [];
  const suggestions: string[] = [];

  if ((permanent || longRetention) && sensitive && (highCriticality || system.hasExternalApi)) {
    reasons.push(permanent
      ? "資料為永久保存，一旦今日加密流量或檔案被攔截，未來沒有自然失效窗口。"
      : `資料保存 ${system.dataRetentionYears} 年，超過 2030–2035 量子威脅成熟時間窗。`);
    reasons.push("資料類型包含個資、保單、醫療、授信、財務或交易資料，未來解密後的損害不可逆。");
    if (highCriticality) {
      reasons.push("系統業務重要性為高或重大，遷移延誤會影響核心金融流程。");
    }
    if (system.hasExternalApi) {
      reasons.push("具外部 API 或跨機構串接，傳輸中資料更可能成為 HNDL 攔截目標。");
    }
    if (vendorRoadmapUnconfirmed) {
      reasons.push("供應商 PQC 遷移計畫尚未完整確認，可能阻礙後續遷移排程。");
    }
    suggestions.push("列入第一批 PQC 遷移準備度盤點，確認所有加密傳輸與靜態儲存路徑。");
    suggestions.push("由資安確認 TLS、PKI、HSM、簽章、JWT 或 XML signature 等密碼相依性。");
    suggestions.push("由系統 Owner 與架構團隊確認替換演算法、憑證生命週期與測試窗口。");
    if (system.hasExternalApi) {
      suggestions.push("要求外部介接機構與供應商提供 PQC 準備度聲明或遷移計畫。");
    }
    return { level: "high", reasons, suggestions };
  }

  if (mediumRetention || (sensitive && !highCriticality) || vendorRoadmapUnconfirmed) {
    if (mediumRetention) {
      reasons.push(`資料保存 ${system.dataRetentionYears} 年，接近量子威脅時間窗，需持續追蹤。`);
    }
    if (sensitive && !highCriticality) {
      reasons.push("系統包含敏感資料，但目前非核心或重大系統，可列入第二批盤點。");
    }
    if (vendorRoadmapUnconfirmed) {
      reasons.push("供應商 PQC 遷移計畫未完整確認，存在供應鏈遷移不確定性。");
    }
    suggestions.push("列入第二批 PQC 準備度追蹤清單，至少每半年複查保存年限與供應商狀態。");
    suggestions.push("要求供應商或內部技術單位補充加密調整能力證據。");
    return { level: "medium", reasons, suggestions };
  }

  reasons.push(`資料保存 ${system.dataRetentionYears} 年，低於 HNDL 高風險保存年限門檻。`);
  if (!sensitive) {
    reasons.push("目前未標示個資、保單、醫療、授信、財務或交易資料等高敏感資料類型。");
  }
  if (!system.hasExternalApi) {
    reasons.push("無外部 API 或跨機構串接，資料攔截暴露面較低。");
  }
  suggestions.push("維持既有加密基準並定期複查，作為後續批次處理。");
  return { level: "low", reasons, suggestions };
}
