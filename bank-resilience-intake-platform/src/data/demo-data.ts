export type RiskLevel = "critical" | "high" | "medium" | "low";
export type SystemStatus = "not_started" | "in_progress" | "security_review" | "procurement_followup" | "completed";
export type PqcRoadmapStatus = "已提供" | "部分提供" | "未提供" | "不適用";
export type CryptoAgilityStatus = "已支援" | "部分支援" | "未確認" | "不支援";
export type ContractUpgradeClause = "有" | "無" | "待確認";
export type AssignedRole = "業務" | "系統Owner" | "資安" | "架構" | "採購" | "供應商";
export type TaskStatus = "open" | "in_progress" | "waiting_vendor" | "waiting_internal" | "completed";
export type SourceType = "FSC" | "NIST NCCoE" | "CISA" | "Internal Policy";

export interface System {
  systemId: string;
  systemName: string;
  businessUnit: string;
  systemType: string;
  businessCriticality: RiskLevel;
  dataTypes: string[];
  dataRetentionYears: number;
  hasExternalApi: boolean;
  externalParties: string[];
  vendorId: string | null;
  owner: string;
  status: SystemStatus;
  cmdbTags: string[];
  cryptoSignals: string[];
  hndlRiskScore: number;
  lastUpdated: string;
}

export interface Vendor {
  vendorId: string;
  vendorName: string;
  relatedSystemCount: number;
  pqcRoadmapStatus: PqcRoadmapStatus;
  cryptoAgilityStatus: CryptoAgilityStatus;
  contractUpgradeClause: ContractUpgradeClause;
  lastResponseDate: string;
  nextFollowUpDate: string;
  riskLevel: RiskLevel;
  notes: string;
}

export interface Task {
  taskId: string;
  relatedSystemId: string;
  assignedRole: AssignedRole;
  taskTitle: string;
  taskDescription: string;
  priority: "P1" | "P2" | "P3";
  dueDate: string;
  status: TaskStatus;
  reason: string;
}

export interface ComplianceLineage {
  lineageId: string;
  questionId: string;
  questionText: string;
  sourceType: SourceType;
  sourceName: string;
  sourceReference: string;
  rationale: string;
  relatedRisk: string;
}

export const systems: System[] = [
  {
    systemId: "SYS-001",
    systemName: "房貸授信系統",
    businessUnit: "個人金融事業群",
    systemType: "Core Lending",
    businessCriticality: "critical",
    dataTypes: ["客戶身分資料", "授信評分", "抵押品資料", "KYC 文件"],
    dataRetentionYears: 30,
    hasExternalApi: true,
    externalParties: ["聯徵資料交換", "估價服務供應商", "電子簽章平台"],
    vendorId: "VND-003",
    owner: "Mortgage Platform Owner",
    status: "security_review",
    cmdbTags: ["PII", "HNDL", "TLS", "HSM", "archive"],
    cryptoSignals: ["TLS 1.2", "RSA-2048 certificate", "HSM signing"],
    hndlRiskScore: 92,
    lastUpdated: "2026-06-01"
  },
  {
    systemId: "SYS-002",
    systemName: "保單理賠系統",
    businessUnit: "保險代理業務部",
    systemType: "Partner Exchange",
    businessCriticality: "high",
    dataTypes: ["保單資料", "理賠資料", "醫療附件", "受益人資料", "客戶聯絡資料"],
    dataRetentionYears: 999,
    hasExternalApi: true,
    externalParties: ["保險公司 API", "醫療資料交換供應商"],
    vendorId: "VND-005",
    owner: "Claims System Owner",
    status: "procurement_followup",
    cmdbTags: ["PII", "HNDL", "vendor-link", "TLS"],
    cryptoSignals: ["mTLS", "XML signature", "AES-256 at rest"],
    hndlRiskScore: 97,
    lastUpdated: "2026-05-29"
  },
  {
    systemId: "SYS-003",
    systemName: "財富管理客戶系統",
    businessUnit: "財富管理事業群",
    systemType: "CRM",
    businessCriticality: "high",
    dataTypes: ["投資偏好", "客戶聯絡資料", "行銷同意紀錄", "交易摘要"],
    dataRetentionYears: 12,
    hasExternalApi: true,
    externalParties: ["市場資料供應商", "投資商品合作夥伴"],
    vendorId: "VND-001",
    owner: "Wealth CRM Owner",
    status: "in_progress",
    cmdbTags: ["PII", "API", "TLS", "HNDL"],
    cryptoSignals: ["OAuth token", "JWT RS256", "ECC certificate"],
    hndlRiskScore: 76,
    lastUpdated: "2026-06-02"
  },
  {
    systemId: "SYS-004",
    systemName: "外匯清算介接系統",
    businessUnit: "交易銀行部",
    systemType: "Payment Clearing",
    businessCriticality: "critical",
    dataTypes: ["外匯交易資料", "SWIFT 訊息", "匯款指示", "交易對手資料"],
    dataRetentionYears: 10,
    hasExternalApi: true,
    externalParties: ["SWIFT 網路", "清算行", "支付服務商"],
    vendorId: "VND-002",
    owner: "FX Clearing Owner",
    status: "security_review",
    cmdbTags: ["SWIFT", "payment", "HSM", "TLS", "HNDL"],
    cryptoSignals: ["SWIFT PKI", "RSA-4096 signing", "HSM key custody"],
    hndlRiskScore: 95,
    lastUpdated: "2026-05-25"
  },
  {
    systemId: "SYS-005",
    systemName: "聯徵查詢系統",
    businessUnit: "風險管理部",
    systemType: "Credit Bureau Integration",
    businessCriticality: "high",
    dataTypes: ["信用查詢紀錄", "客戶識別資料", "授信狀態"],
    dataRetentionYears: 7,
    hasExternalApi: true,
    externalParties: ["信用資料交換中心"],
    vendorId: "VND-004",
    owner: "Credit Bureau Integration Owner",
    status: "not_started",
    cmdbTags: ["API", "PII", "TLS", "internet-facing", "unknown crypto module"],
    cryptoSignals: ["mTLS", "RSA certificate", "legacy certificate"],
    hndlRiskScore: 66,
    lastUpdated: "2026-05-18"
  },
  {
    systemId: "SYS-006",
    systemName: "信用卡交易授權系統",
    businessUnit: "信用卡暨支付事業群",
    systemType: "Card Authorization",
    businessCriticality: "critical",
    dataTypes: ["交易授權資料", "卡片代碼", "3DS 驗證資料"],
    dataRetentionYears: 8,
    hasExternalApi: true,
    externalParties: ["國際卡組織", "收單服務商", "3DS 供應商"],
    vendorId: "VND-001",
    owner: "Card Authorization Owner",
    status: "in_progress",
    cmdbTags: ["PCI-DSS", "payment", "HSM", "tokenization", "TLS"],
    cryptoSignals: ["HSM PIN translation", "tokenization", "TLS 1.3"],
    hndlRiskScore: 73,
    lastUpdated: "2026-06-03"
  },
  {
    systemId: "SYS-007",
    systemName: "企業網銀系統",
    businessUnit: "企業金融部",
    systemType: "Digital Banking",
    businessCriticality: "critical",
    dataTypes: ["企業交易指示", "簽核紀錄", "往來帳戶資料", "授權資料"],
    dataRetentionYears: 15,
    hasExternalApi: true,
    externalParties: ["企業 ERP", "支付服務商", "授權憑證供應商"],
    vendorId: "VND-004",
    owner: "Corporate Banking Owner",
    status: "security_review",
    cmdbTags: ["internet-facing", "payment", "PKI", "HNDL", "TLS"],
    cryptoSignals: ["PKI signing", "RSA-2048", "mTLS"],
    hndlRiskScore: 86,
    lastUpdated: "2026-05-30"
  },
  {
    systemId: "SYS-008",
    systemName: "行動銀行 API Gateway",
    businessUnit: "數位金融部",
    systemType: "API Gateway",
    businessCriticality: "critical",
    dataTypes: ["API token", "交易請求", "裝置指紋", "客戶識別資料"],
    dataRetentionYears: 3,
    hasExternalApi: true,
    externalParties: ["Open Banking 合作方", "行動支付服務"],
    vendorId: "VND-006",
    owner: "Mobile API Owner",
    status: "in_progress",
    cmdbTags: ["API", "OAuth", "JWT", "TLS", "internet-facing"],
    cryptoSignals: ["OAuth 2.0", "JWT RS256", "TLS 1.3"],
    hndlRiskScore: 69,
    lastUpdated: "2026-06-04"
  },
  {
    systemId: "SYS-009",
    systemName: "客服知識庫系統",
    businessUnit: "客服中心",
    systemType: "Knowledge Base",
    businessCriticality: "medium",
    dataTypes: ["FAQ 內容", "客服處理紀錄", "一般產品資訊"],
    dataRetentionYears: 5,
    hasExternalApi: false,
    externalParties: [],
    vendorId: "VND-007",
    owner: "Service Knowledge Owner",
    status: "completed",
    cmdbTags: ["internal", "TLS", "SaaS"],
    cryptoSignals: ["TLS 1.2", "SaaS encryption at rest"],
    hndlRiskScore: 41,
    lastUpdated: "2026-05-12"
  },
  {
    systemId: "SYS-010",
    systemName: "內部報表系統",
    businessUnit: "財務會計部",
    systemType: "Reporting",
    businessCriticality: "medium",
    dataTypes: ["財務報表", "成本資料", "歷史交易彙總"],
    dataRetentionYears: 12,
    hasExternalApi: false,
    externalParties: [],
    vendorId: null,
    owner: "Finance Reporting Owner",
    status: "not_started",
    cmdbTags: ["internal", "archive", "HNDL", "TLS"],
    cryptoSignals: ["TLS 1.2", "database encryption"],
    hndlRiskScore: 59,
    lastUpdated: "2026-05-08"
  },
  {
    systemId: "SYS-011",
    systemName: "醫療理賠資料交換系統",
    businessUnit: "保險代理業務部",
    systemType: "Data Exchange",
    businessCriticality: "high",
    dataTypes: ["醫療診斷資料", "就醫紀錄", "理賠證明", "敏感個資"],
    dataRetentionYears: 30,
    hasExternalApi: true,
    externalParties: ["醫療院所", "合作保險公司"],
    vendorId: "VND-005",
    owner: "Medical Claims Exchange Owner",
    status: "procurement_followup",
    cmdbTags: ["PII", "health-data", "HNDL", "vendor-link", "TLS"],
    cryptoSignals: ["XML signature", "mTLS", "RSA certificate"],
    hndlRiskScore: 98,
    lastUpdated: "2026-06-01"
  },
  {
    systemId: "SYS-012",
    systemName: "供應商文件交換平台",
    businessUnit: "採購管理部",
    systemType: "Contract Repository",
    businessCriticality: "low",
    dataTypes: ["契約文件", "供應商資料", "採購紀錄"],
    dataRetentionYears: 10,
    hasExternalApi: true,
    externalParties: ["電子簽章服務", "文件交換供應商"],
    vendorId: "VND-008",
    owner: "Procurement Portal Owner",
    status: "completed",
    cmdbTags: ["vendor-link", "document", "TLS", "archive", "legacy certificate"],
    cryptoSignals: ["PDF signature", "TLS 1.1", "legacy certificate"],
    hndlRiskScore: 52,
    lastUpdated: "2026-05-16"
  }
];

export const vendors: Vendor[] = [
  {
    vendorId: "VND-001",
    vendorName: "AsterPay Gateway",
    relatedSystemCount: 2,
    pqcRoadmapStatus: "未提供",
    cryptoAgilityStatus: "未確認",
    contractUpgradeClause: "無",
    lastResponseDate: "2026-04-10",
    nextFollowUpDate: "2026-06-20",
    riskLevel: "high",
    notes: "示範供應商。支付閘道尚未提供 PQC 遷移計畫與加密調整能力證明。"
  },
  {
    vendorId: "VND-002",
    vendorName: "NorthGrid SWIFT Solutions",
    relatedSystemCount: 1,
    pqcRoadmapStatus: "部分提供",
    cryptoAgilityStatus: "部分支援",
    contractUpgradeClause: "待確認",
    lastResponseDate: "2026-05-15",
    nextFollowUpDate: "2026-07-01",
    riskLevel: "high",
    notes: "示範供應商。已提供 TLS 清單，但 HSM 演算法遷移細節仍待補件。"
  },
  {
    vendorId: "VND-003",
    vendorName: "CoreLend Mortgage Platform",
    relatedSystemCount: 1,
    pqcRoadmapStatus: "已提供",
    cryptoAgilityStatus: "部分支援",
    contractUpgradeClause: "有",
    lastResponseDate: "2026-05-28",
    nextFollowUpDate: "2026-08-01",
    riskLevel: "medium",
    notes: "示範供應商。已有遷移計畫，但整合測試計畫仍是草案。"
  },
  {
    vendorId: "VND-004",
    vendorName: "EnterpriseBanking Corp",
    relatedSystemCount: 2,
    pqcRoadmapStatus: "部分提供",
    cryptoAgilityStatus: "已支援",
    contractUpgradeClause: "有",
    lastResponseDate: "2026-06-01",
    nextFollowUpDate: "2026-07-10",
    riskLevel: "medium",
    notes: "示範供應商。具備加密調整框架，PKI 遷移證據待確認。"
  },
  {
    vendorId: "VND-005",
    vendorName: "MediClaim Exchange Ltd",
    relatedSystemCount: 2,
    pqcRoadmapStatus: "未提供",
    cryptoAgilityStatus: "不支援",
    contractUpgradeClause: "無",
    lastResponseDate: "2026-03-18",
    nextFollowUpDate: "2026-06-18",
    riskLevel: "critical",
    notes: "示範供應商。長期保存醫療理賠資料，但尚未提出 PQC 遷移計畫。"
  },
  {
    vendorId: "VND-006",
    vendorName: "OpenAPI Middleware Co.",
    relatedSystemCount: 1,
    pqcRoadmapStatus: "已提供",
    cryptoAgilityStatus: "已支援",
    contractUpgradeClause: "有",
    lastResponseDate: "2026-05-30",
    nextFollowUpDate: "2026-09-01",
    riskLevel: "low",
    notes: "示範供應商。API Gateway 遷移計畫與 token signing 遷移選項已提供。"
  },
  {
    vendorId: "VND-007",
    vendorName: "KnowledgeBase SaaS Inc.",
    relatedSystemCount: 1,
    pqcRoadmapStatus: "不適用",
    cryptoAgilityStatus: "未確認",
    contractUpgradeClause: "待確認",
    lastResponseDate: "2026-04-20",
    nextFollowUpDate: "2026-07-15",
    riskLevel: "low",
    notes: "示範供應商。內部知識庫 SaaS，PQC 遷移優先度較低。"
  },
  {
    vendorId: "VND-008",
    vendorName: "DocuVault Exchange",
    relatedSystemCount: 1,
    pqcRoadmapStatus: "部分提供",
    cryptoAgilityStatus: "部分支援",
    contractUpgradeClause: "待確認",
    lastResponseDate: "2026-05-12",
    nextFollowUpDate: "2026-07-05",
    riskLevel: "medium",
    notes: "示範供應商。電子簽章遷移計畫部分完成，契約升級條款待確認。"
  }
];

export const tasks: Task[] = [
  {
    taskId: "TSK-001",
    relatedSystemId: "SYS-001",
    assignedRole: "資安",
    taskTitle: "確認房貸系統 TLS 與 HSM 演算法清單",
    taskDescription: "驗證憑證、簽章金鑰與 HSM 使用情境，建立 PQC 遷移待確認項目。",
    priority: "P1",
    dueDate: "2026-06-20",
    status: "in_progress",
    reason: "高 HNDL 暴露且資料保存期間長。"
  },
  {
    taskId: "TSK-002",
    relatedSystemId: "SYS-004",
    assignedRole: "資安",
    taskTitle: "檢視 SWIFT PKI 與 HSM 遷移路徑",
    taskDescription: "蒐集 SWIFT PKI、key custody 與 PQC 準備度證據。",
    priority: "P1",
    dueDate: "2026-06-18",
    status: "waiting_internal",
    reason: "關鍵支付清算整合。"
  },
  {
    taskId: "TSK-003",
    relatedSystemId: "SYS-011",
    assignedRole: "採購",
    taskTitle: "要求 MediClaim 提供 PQC 遷移計畫",
    taskDescription: "請供應商提供遷移計畫、支援演算法與升級時程。",
    priority: "P1",
    dueDate: "2026-06-25",
    status: "waiting_vendor",
    reason: "供應商處理長期保存醫療資料，且未提供遷移計畫。"
  },
  {
    taskId: "TSK-004",
    relatedSystemId: "SYS-007",
    assignedRole: "架構",
    taskTitle: "評估企業網銀 PKI 加密調整能力",
    taskDescription: "確認憑證與簽核流程是否支援分階段演算法遷移。",
    priority: "P1",
    dueDate: "2026-06-28",
    status: "open",
    reason: "企業交易簽核屬於業務關鍵流程。"
  },
  {
    taskId: "TSK-005",
    relatedSystemId: "SYS-002",
    assignedRole: "供應商",
    taskTitle: "提供 XML signature 遷移證據",
    taskDescription: "供應商需提供 XML 簽章演算法清單與 PQC 準備度聲明。",
    priority: "P1",
    dueDate: "2026-06-30",
    status: "waiting_vendor",
    reason: "理賠資料保存超過 10 年。"
  },
  {
    taskId: "TSK-006",
    relatedSystemId: "SYS-008",
    assignedRole: "資安",
    taskTitle: "檢視 JWT 簽章演算法相依性",
    taskDescription: "確認 RS256 / ES256 使用情境與 token signing 遷移選項。",
    priority: "P2",
    dueDate: "2026-07-10",
    status: "in_progress",
    reason: "外部 API Gateway 具跨通路暴露。"
  },
  {
    taskId: "TSK-007",
    relatedSystemId: "SYS-003",
    assignedRole: "採購",
    taskTitle: "蒐集市場資料供應商 PQC 聲明",
    taskDescription: "要求市場資料與投資商品合作夥伴提供準備度聲明。",
    priority: "P2",
    dueDate: "2026-07-20",
    status: "open",
    reason: "外部合作方支援客戶投資流程。"
  },
  {
    taskId: "TSK-008",
    relatedSystemId: "SYS-010",
    assignedRole: "系統Owner",
    taskTitle: "確認報表資料保存分類",
    taskDescription: "分類歷史報表資料集，確認是否包含長期保存敏感資料。",
    priority: "P3",
    dueDate: "2026-07-31",
    status: "open",
    reason: "保存期間超過 10 年，但系統為內部用途。"
  }
];

export const complianceLineage: ComplianceLineage[] = [
  {
    lineageId: "LIN-001",
    questionId: "Q-CRYPTO-001",
    questionText: "系統是否使用 RSA、ECC、PKI、HSM、TLS、XML signature 或 JWT signing?",
    sourceType: "NIST NCCoE",
    sourceName: "Migration to Post-Quantum Cryptography",
    sourceReference: "NIST SP 1800-38B",
    rationale: "密碼相依性清單是 PQC 遷移規劃的第一步。",
    relatedRisk: "未知密碼相依性可能延誤遷移。"
  },
  {
    lineageId: "LIN-002",
    questionId: "Q-HNDL-001",
    questionText: "敏感資料是否保存超過 10 年?",
    sourceType: "CISA",
    sourceName: "Post-Quantum Cryptography Initiative",
    sourceReference: "CISA PQC Roadmap",
    rationale: "長期保存敏感資料可能面臨 harvest-now-decrypt-later 暴露。",
    relatedRisk: "HNDL 風險。"
  },
  {
    lineageId: "LIN-003",
    questionId: "Q-VENDOR-001",
    questionText: "供應商是否提供 PQC 遷移計畫與加密調整能力證據?",
    sourceType: "FSC",
    sourceName: "Technology outsourcing risk management expectation",
    sourceReference: "FSC outsourcing governance guidance",
    rationale: "第三方科技風險需留存準備度證據與追蹤責任。",
    relatedRisk: "供應商相依性阻礙遷移規劃。"
  },
  {
    lineageId: "LIN-004",
    questionId: "Q-API-001",
    questionText: "系統是否透過 API 與外部機構交換資料?",
    sourceType: "Internal Policy",
    sourceName: "Internal API Security Standard",
    sourceReference: "API-SEC-STD Section 4",
    rationale: "外部 API 增加暴露面，需要 TLS 與 token signing 證據。",
    relatedRisk: "跨機構 API 暴露。"
  },
  {
    lineageId: "LIN-005",
    questionId: "Q-CONTRACT-001",
    questionText: "契約是否包含密碼遷移升級權利?",
    sourceType: "Internal Policy",
    sourceName: "Vendor Contract Technology Clause",
    sourceReference: "PROC-TECH-CLAUSE Section 7",
    rationale: "契約條款可能阻礙或加速遷移時程。",
    relatedRisk: "採購與法遵待確認。"
  }
];

export const demoData = {
  systems,
  vendors,
  tasks,
  complianceLineage
};

export type DemoData = typeof demoData;
