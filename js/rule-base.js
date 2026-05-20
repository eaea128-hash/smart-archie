/* ============================================================
   CloudFrame — Rule / Knowledge Base Engine
   Structured rule sets for cloud governance, financial compliance,
   migration anti-patterns, and skill gap analysis.

   Decoupled from prompt engineering — runs 100% in-browser,
   no API required. Augments analyze-engine.js with auditable rules.
   ============================================================ */

'use strict';

const RuleBase = (() => {

  // ══════════════════════════════════════════════════════════
  // ── CLOUD GOVERNANCE RULES ────────────────────────────────
  // Standard: CSP Well-Architected / NIST / CIS Benchmark
  // Each rule: { id, category, title, desc, severity, check(inputs), remedy, standard }
  // check() → true = PASS, false = FAIL / gap detected
  // ══════════════════════════════════════════════════════════

  const GOVERNANCE_RULES = [
    {
      id: 'GOV-001', category: '身份與存取管理 (IAM)',
      title: 'IAM 最小權限原則與 MFA',
      desc:  '所有雲端帳號須啟用 MFA，採最小權限原則，禁止以 Root 帳號執行日常作業',
      severity: 'critical',
      check: i => i.hasIAM === 'yes',
      remedy:   '部署 AWS IAM Identity Center / Azure Entra ID；建立 Role-Based Access Control (RBAC) 矩陣',
      standard: 'NIST SP 800-53 AC-6、CIS Benchmark Level 1',
    },
    {
      id: 'GOV-002', category: '帳號治理 (Account Governance)',
      title: 'Landing Zone 多帳號隔離架構',
      desc:  '生產、測試、稽核帳號需 OU 層級隔離，避免爆炸半徑擴大',
      severity: 'critical',
      check: i => i.hasLandingZone === 'yes',
      remedy:   'AWS Control Tower 或 Azure Landing Zone Blueprint；建立 SCP / Azure Policy 邊界',
      standard: 'AWS Well-Architected Security Pillar、Azure CAF',
    },
    {
      id: 'GOV-003', category: '資料加密 (Encryption)',
      title: '靜態與傳輸中資料加密',
      desc:  '所有儲存資料需 AES-256 加密；傳輸需 TLS 1.2+；金鑰由 KMS 集中管理',
      severity: 'critical',
      check: i => !( (i.hasPersonalData === 'yes' || i.hasFinancialData === 'yes') && i.complianceLevel !== 'high' ),
      remedy:   '啟用 AWS KMS / Azure Key Vault；Storage、RDS、EBS 預設加密；禁用 TLS 1.0/1.1',
      standard: 'FIPS 140-2 Level 2；PCI DSS 3.4；ISO 27001 A.10',
    },
    {
      id: 'GOV-004', category: '可觀測性 (Observability)',
      title: '集中式日誌與稽核軌跡（CloudTrail/Monitor）',
      desc:  '所有 API 呼叫須記錄稽核日誌，保留 ≥ 1 年，不可竄改',
      severity: 'high',
      check: _ => true, // always a gap if not explicitly confirmed
      remedy:   'AWS CloudTrail → S3 (Object Lock)；Azure Monitor → Log Analytics Workspace；設定異常告警',
      standard: 'SOC 2 Type II (CC7.2)；ISO 27001 A.12.4；NIST AU-12',
    },
    {
      id: 'GOV-005', category: '網路安全 (Network Security)',
      title: 'VPC / VNet 隔離與 Zero Trust 入口',
      desc:  '工作負載部署於私有子網路；WAF + API Gateway 作為公開入口；禁止直接公開 DB',
      severity: 'high',
      check: i => i.hasLandingZone === 'yes',
      remedy:   'Hub-Spoke VPC 架構；WAF 規則集 (OWASP Top 10)；Security Group 最小開放；PrivateLink',
      standard: 'NIST SP 800-207 Zero Trust Architecture；CIS AWS/Azure Foundations',
    },
    {
      id: 'GOV-006', category: '災難復原 (DR / BCM)',
      title: 'RTO/RPO 定義、DR 演練與核心系統 BCP',
      desc:  '核心系統 RTO ≤ 4hr / RPO ≤ 1hr，並每季執行一次完整 DR 演練',
      severity: 'critical',
      check: i => !(i.isCoreSystem === 'yes' && i.downtimeTolerance !== 'low'),
      remedy:   'Multi-AZ 主動-主動或主動-待命部署；制訂 Runbook；自動化 DR 觸發（Route 53 Health Check）',
      standard: 'ISO 22301 Business Continuity；MAS TRM 2021 §9.5',
    },
    {
      id: 'GOV-007', category: '成本治理 (FinOps)',
      title: '資源標籤策略與預算告警',
      desc:  '所有資源打 Project / Env / Owner 標籤；設定預算告警（≥80% 觸發）；月度成本審查',
      severity: 'medium',
      check: _ => true, // always a recommendation
      remedy:   'AWS Cost Explorer Tag Policy + Budget Alert；Azure Cost Management + Tag Governance Policy',
      standard: 'FinOps Foundation Best Practices；ITFM / TBM Framework',
    },
    {
      id: 'GOV-008', category: '供應鏈安全 (Supply Chain)',
      title: 'Container Image 掃描與 SBOM 管理',
      desc:  '容器映像上傳前須通過 CVE 掃描；維護 SBOM（軟體物料清單）；禁用 latest tag',
      severity: 'high',
      check: i => i.archType !== 'microservices', // microservices = containers = higher risk
      remedy:   'AWS ECR Image Scanning / Azure Defender for Containers；Trivy 整合 CI/CD；Cosign 簽章驗證',
      standard: 'EO 14028 (美國行政命令)；NIST SSDF；CIS Software Supply Chain Security',
    },
  ];

  // ══════════════════════════════════════════════════════════
  // ── FINANCIAL & INDUSTRY COMPLIANCE RULES ────────────────
  // ══════════════════════════════════════════════════════════

  const COMPLIANCE_RULES = {

    financial: [
      {
        id: 'FSC-001', jurisdiction: '台灣 FSC 金管會',
        title: '金融機構辦理資訊系統委外作業安全控管',
        desc:  '委外廠商（含 CSP）須簽署 NDA，金融資料須存放於台灣境內（資料主權）',
        severity: 'critical',
        check: i => i.complianceLevel === 'high',
        remedy:   '確認 CSP 台灣 Region 可用性（AWS ap-east-1 / Azure Taiwan）；資料分類與在地化控制；委外稽核契約條款',
        authority: 'FSC Taiwan 金管會',
      },
      {
        id: 'FSC-002', jurisdiction: '台灣 FSC 金管會',
        title: '第三方風險管理 (TPRM) — CSP 稽核要求',
        desc:  'CSP 需提供 SOC 2 Type II + ISO 27001 最新報告；納入年度 TPRM 評核',
        severity: 'high',
        check: _ => true,
        remedy:   '建立 CSP TPRM 評核問卷；要求提供 CSA STAR Level 2 報告；合約加入稽核權條款',
        authority: 'FSC Taiwan 函釋',
      },
      {
        id: 'MAS-001', jurisdiction: 'MAS (新加坡金融管理局)',
        title: 'TRM Guidelines 2021 — 重要系統定義與 RTO',
        desc:  '影響清算、支付、核心銀行的系統：RTO ≤ 4hr，年度 DR 測試，事件 1hr 內通報',
        severity: 'critical',
        check: i => i.isCoreSystem !== 'yes',
        remedy:   '對應 MAS TRM Annexure 5；建立系統重要性分類；核心系統完整 BCM 計畫含模擬演練',
        authority: 'MAS Singapore TRM Guidelines 2021',
      },
      {
        id: 'MAS-002', jurisdiction: 'MAS (新加坡金融管理局)',
        title: 'TPOR — 集中度風險：單一 CSP 依賴',
        desc:  '避免過度依賴單一 CSP；需評估 CSP 退出策略；集中度風險需向 MAS 申報',
        severity: 'high',
        check: _ => true,
        remedy:   '建立多雲退出計畫（Exit Plan）；評估可攜性（Portability Assessment）；合約需包含資料匯出條款',
        authority: 'MAS Circular on TPOR 2023',
      },
      {
        id: 'APRA-001', jurisdiction: 'APRA (澳洲審慎監理局)',
        title: 'CPS 234 資訊安全 — 第三方控制要求',
        desc:  'CSP 須受與自身相同的資訊安全控管要求；需有控制框架對應 (Control Mapping)',
        severity: 'critical',
        check: _ => true,
        remedy:   '建立 CPS 234 Control Framework Mapping；對應 AWS/Azure 安全控制；每年執行第三方稽核',
        authority: 'APRA CPS 234 (2019)',
      },
      {
        id: 'DORA-001', jurisdiction: 'EU DORA（2025 生效）',
        title: 'Digital Operational Resilience Act — ICT 第三方風險',
        desc:  'ICT 第三方風險管理義務、重大事件 4hr 內通報 EBA/ESMA、年度 TLPT 測試',
        severity: 'high',
        check: _ => true,
        remedy:   '建立 ICT Risk Register；確保 CSP 合約包含 DORA Article 28 要求；指定 ICT 風險管理負責人',
        authority: 'EU Regulation 2022/2554 (DORA)',
      },
    ],

    healthcare: [
      {
        id: 'MOHW-001', jurisdiction: '台灣衛福部',
        title: '電子病歷管理辦法 — 儲存地點與保存年限',
        desc:  '電子病歷需保存 10 年；資料主權須在台灣境內；異地備份須加密',
        severity: 'critical',
        check: _ => true,
        remedy:   '確認雲端服務商在台灣 Region 可用性；建立資料生命週期管理政策；S3 Object Lock 設定',
        authority: 'Taiwan MOHW 衛福部',
      },
      {
        id: 'HIPAA-001', jurisdiction: 'HIPAA (美國)',
        title: 'Business Associate Agreement (BAA) 與 PHI 保護',
        desc:  '含 PHI 工作負載的 CSP 需簽署 BAA；僅使用 HIPAA Eligible Services',
        severity: 'critical',
        check: i => i.hasPersonalData !== 'yes',
        remedy:   '與 AWS/Azure 簽署 BAA；採用 HIPAA Eligible Services 清單；啟用 CloudTrail + GuardDuty',
        authority: 'US DHHS 45 CFR Parts 160/164',
      },
    ],

    government: [
      {
        id: 'NICS-001', jurisdiction: '台灣行政院資安院',
        title: '政府資訊服務雲端化資安管理規範',
        desc:  '政府機關上雲需通過 ISMS 認證；資料須存放於政府雲或取得核准之私有雲',
        severity: 'critical',
        check: _ => true,
        remedy:   '採用具 CNS 27001 (ISMS) 認證之雲端服務；完成政府雲申請流程；定期資安健診',
        authority: 'Taiwan NICS 行政院資安辦',
      },
    ],

    manufacturing: [
      {
        id: 'IEC-001', jurisdiction: 'IEC 62443',
        title: 'OT/IT 融合資安 — 工控系統保護',
        desc:  'OT 系統（SCADA/PLC）需與 IT 網路隔離（Air-Gap 或 DMZ）；工控系統上雲需特殊評估',
        severity: 'critical',
        check: _ => true,
        remedy:   '建立 IT/OT 隔離架構；Edge Computing 保留在廠區；雲端只作資料蒐集與分析用途',
        authority: 'IEC 62443 Series、NIST SP 800-82',
      },
    ],
  };

  // ══════════════════════════════════════════════════════════
  // ── MIGRATION ANTI-PATTERNS ───────────────────────────────
  // ══════════════════════════════════════════════════════════

  const ANTI_PATTERNS = [
    {
      id: 'AP-001', risk: 'critical',
      name: 'Big Bang 全量遷移',
      desc: '一次性遷移所有核心系統，停機風險極高，且難以快速 Rollback',
      trigger: i => i.isCoreSystem === 'yes' && i.timeline === 'urgent',
      recommendation: '採 Strangler Fig 策略：切割功能模組，逐波次遷移；保留舊系統平行運行 ≥ 1 個月；切換前完成 DR 演練',
    },
    {
      id: 'AP-002', risk: 'high',
      name: 'Lift & Shift 套用至超高齡系統',
      desc: '將 15+ 年 Monolith 直接 Rehost，忽略授權、硬體依賴、編碼問題',
      trigger: i => parseInt(i.systemAge) >= 15 && i.archType === 'monolith',
      recommendation: '先執行系統體檢（授權清單、硬體依賴、字元集相容性）；部分組件可能需先 Replatform 後才能 Rehost',
    },
    {
      id: 'AP-003', risk: 'critical',
      name: '缺乏 Landing Zone 直接部署應用',
      desc: '未建立帳號隔離、IAM 基線、VPC 架構，直接在 Root 帳號部署工作負載',
      trigger: i => i.hasLandingZone !== 'yes',
      recommendation: '先完成 Day 0 治理建置（6–10 週）：Landing Zone + IAM + VPC + 監控基線，再進行 Day 1 應用遷移',
    },
    {
      id: 'AP-004', risk: 'high',
      name: '雲端能力不成熟時強推 Refactor',
      desc: '組織雲端能力低，強行推動微服務重構，反增技術債與維運複雜度',
      trigger: i => i.cloudMaturity === 'low' && (i.cloudGoal === 'api' || i.archType === 'microservices'),
      recommendation: '建議 Rehost → Replatform 的漸進路徑；先建立 COE（雲端卓越中心），累積雲端能力後再評估 Refactor',
    },
    {
      id: 'AP-005', risk: 'critical',
      name: '無 BCP/DR 計畫上線核心系統',
      desc: '核心業務系統在未制訂 BCP/Runbook、未完成 DR 演練的情況下正式遷移上線',
      trigger: i => i.isCoreSystem === 'yes' && i.downtimeTolerance === 'low',
      recommendation: '遷移前必要條件：Multi-AZ 部署確認、DR 演練通過（RTO 達標）、Runbook 評審完成、Rollback 演練',
    },
    {
      id: 'AP-006', risk: 'high',
      name: '忽略資料庫遷移複雜度',
      desc: '遷移評估未考量資料庫異質轉換（Oracle → Aurora / SQL Server → PostgreSQL）的工時與風險',
      trigger: i => i.archType === 'monolith' || i.techDebt === 'high',
      recommendation: '使用 AWS SCT/DMS 或 Azure Database Migration Service 進行相容性評估；建議先行小規模 PoC',
    },
    // ── 金融行業專屬反模式 ──────────────────────────────────────
    {
      id: 'AP-007', risk: 'critical',
      name: '金融機構未完成主管機關外包通知',
      desc: '受 MAS/FSC/HKMA 監管的金融機構，在雲端服務達到「重大委外」門檻時，須於上線前向主管機關完成書面通知/申請',
      trigger: i => i.isMajorOutsource === 'yes' && i.complianceLevel === 'high',
      recommendation: '依 MAS 外包準則第 5.3 條，重大委外需完成書面通知；建議提早 3–6 個月與法遵部門協作；準備 CSP 盡職調查報告（VAPT、SOC 2、ISO 27001）',
    },
    {
      id: 'AP-008', risk: 'critical',
      name: '客戶個資/金融資料境外儲存未評估',
      desc: '含客戶個資或金融交易資料的系統，未確認資料主權/落地要求即選定雲端 Region',
      trigger: i => (i.hasPersonalData === 'yes' || i.hasFinancialData === 'yes') && i.complianceLevel === 'high',
      recommendation: '優先使用境內 Region（AWS 台灣/新加坡、Azure East Asia）；設定 AWS Config Rule「restricted-to-approved-regions」；完成 PDPA/FSC 資料落地評估文件',
    },
    {
      id: 'AP-009', risk: 'high',
      name: 'MVP Pilot 跳過，直接遷移核心業務',
      desc: '未先以非核心系統完成 MVP Pilot 驗證技術可行性，即直接啟動核心系統遷移，導致問題發現時已影響業務',
      trigger: i => i.isCoreSystem === 'yes' && i.cloudMaturity !== 'high',
      recommendation: '金融業建議 MVP Pilot 優先：選定內部分析、報表或 HR 系統先行遷移（4–8 週）；驗證 Landing Zone、網路連線、合規掃描後，再啟動核心系統遷移波次',
    },
  ];

  // ══════════════════════════════════════════════════════════
  // ── SKILL GAP ANALYSIS ────────────────────────────────────
  // Required skill level: 1=基礎, 2=中階, 3=進階, 4=專家
  // ══════════════════════════════════════════════════════════

  const SKILL_MATRIX = {
    rehost: [
      { skill: '雲端網路基礎', required: 2, category: 'Infrastructure', icon: '🌐',
        desc: 'VPC / 子網路 / 安全群組 / Route Table 設定' },
      { skill: '虛擬機器遷移', required: 2, category: 'Migration', icon: '🖥️',
        desc: 'VM Import/Export、AWS SMS、Azure Migrate' },
      { skill: '基礎 DevOps', required: 2, category: 'DevOps', icon: '⚙️',
        desc: 'CI/CD 流水線基礎（GitHub Actions / CodePipeline）、Git 版控' },
      { skill: 'IAM 與身份管理', required: 2, category: 'Security', icon: '🔑',
        desc: 'Role/Policy 設計、IAM Identity Center、SCP' },
      { skill: '雲端成本管理 (FinOps)', required: 1, category: 'FinOps', icon: '💰',
        desc: '帳單監控、資源標籤、預算告警、Reserved Instance 規劃' },
    ],
    replatform: [
      { skill: '容器化技術 (Docker / K8s)', required: 3, category: 'Container', icon: '🐳',
        desc: 'Docker 映像建置、Kubernetes/EKS/AKS 中級操作、Helm Chart' },
      { skill: '受管資料庫遷移', required: 2, category: 'Database', icon: '🗄️',
        desc: 'RDS、Aurora、Azure SQL Migration Service、Schema Conversion' },
      { skill: 'CI/CD 自動化進階', required: 3, category: 'DevOps', icon: '🔄',
        desc: 'GitHub Actions、AWS CodePipeline、ArgoCD、GitOps 流程設計' },
      { skill: 'IaC 基礎 (Terraform)', required: 2, category: 'Infrastructure', icon: '📋',
        desc: 'Terraform 基礎語法、State 管理、Module 使用' },
      { skill: '雲端可觀測性', required: 2, category: 'Operations', icon: '📊',
        desc: 'CloudWatch / Azure Monitor、Grafana、Distributed Tracing 基礎' },
      { skill: '雲端安全防護', required: 2, category: 'Security', icon: '🛡️',
        desc: 'WAF 設定、GuardDuty / Defender、Security Hub 整合' },
    ],
    refactor: [
      { skill: '微服務架構設計', required: 4, category: 'Architecture', icon: '🏗️',
        desc: 'Domain-Driven Design、API-First 設計、Strangler Fig 模式' },
      { skill: 'Kubernetes 進階', required: 4, category: 'Container', icon: '☸️',
        desc: 'Service Mesh (Istio)、GitOps (Flux/ArgoCD)、RBAC、Network Policy' },
      { skill: 'IaC 進階 (Terraform / CDK)', required: 3, category: 'Infrastructure', icon: '🔧',
        desc: 'Module 封裝設計、Policy as Code (OPA)、Sentinel、多環境管理' },
      { skill: '雲原生資料架構', required: 3, category: 'Data', icon: '📡',
        desc: 'Event Streaming (Kafka / Kinesis)、CQRS 模式、Data Mesh 概念' },
      { skill: '安全即程式碼 (DevSecOps)', required: 3, category: 'Security', icon: '🔐',
        desc: 'SAST/DAST CI/CD 整合、SBOM 管理、Container 簽章、Secrets 管理' },
      { skill: 'SRE 實踐', required: 3, category: 'Reliability', icon: '📈',
        desc: 'SLO/SLI 定義、Error Budget、Chaos Engineering、自動化 Runbook' },
      { skill: 'FinOps 進階', required: 3, category: 'FinOps', icon: '💹',
        desc: '成本歸因模型、Spot/Savings Plan 優化、Chargeback 機制設計' },
    ],
    retain: [
      { skill: '混合雲連線', required: 2, category: 'Hybrid', icon: '🔗',
        desc: 'Direct Connect / ExpressRoute、Site-to-Site VPN、Network 路由設計' },
      { skill: 'Landing Zone 建置', required: 3, category: 'Governance', icon: '🏛️',
        desc: 'AWS Control Tower、Azure Landing Zone Blueprint、SCP / Policy 設定' },
      { skill: '合規治理自動化', required: 2, category: 'Compliance', icon: '✅',
        desc: 'AWS Config Rules、Azure Policy、合規報告自動化、例外管理流程' },
    ],
  };

  // Cloud maturity → estimated current skill level
  const MATURITY_TO_LEVEL = { low: 1, medium: 2, high: 3 };

  function assessSkillGap(inputs, strategy) {
    const currentLevel = MATURITY_TO_LEVEL[inputs.cloudMaturity || 'low'];
    const required     = SKILL_MATRIX[strategy] || SKILL_MATRIX.rehost;

    return required.map(item => {
      const gap = Math.max(0, item.required - currentLevel);
      return {
        ...item,
        currentLevel,
        gap,
        status: gap === 0 ? 'ok' : gap === 1 ? 'minor' : gap === 2 ? 'major' : 'critical',
        gapLabel: gap === 0 ? '✅ 已具備' : gap === 1 ? '⚠️ 輕微不足' : gap === 2 ? '🟠 明顯缺口' : '🔴 嚴重不足',
      };
    });
  }

  // ══════════════════════════════════════════════════════════
  // ── STRATEGY DISTRIBUTION ─────────────────────────────────
  // Convert 6R raw scores → percentage breakdown for executive view
  // ══════════════════════════════════════════════════════════

  const STRATEGY_LABELS_ZH = {
    rehost: 'Rehost（直接遷移）', replatform: 'Replatform（平台調整）',
    refactor: 'Refactor（架構重構）', retain: 'Retain（暫緩保留）', retire: 'Retire（下線退場）',
  };
  const STRATEGY_COLORS = {
    rehost: '#4ade80', replatform: '#38bdf8', refactor: '#a78bfa',
    retain: '#fbbf24', retire: '#f87171',
  };

  function strategyDistribution(strategy6R) {
    if (!strategy6R) return [];
    const scores = strategy6R.scores || {};
    const capped  = Object.fromEntries(Object.entries(scores).map(([k, v]) => [k, Math.max(0, v)]));
    const total   = Object.values(capped).reduce((s, v) => s + v, 0) || 1;
    return Object.entries(capped)
      .map(([key, score]) => ({
        key,
        score,
        pct:   Math.round((score / total) * 100),
        label: STRATEGY_LABELS_ZH[key] || key,
        color: STRATEGY_COLORS[key] || '#94a3b8',
      }))
      .sort((a, b) => b.score - a.score)
      .filter(d => d.pct > 0);
  }

  // ══════════════════════════════════════════════════════════
  // ── GO / NO-GO DETERMINATION ──────────────────────────────
  // ══════════════════════════════════════════════════════════

  function determineGoNoGo(govResults, antiPatterns, skillGap, inputs) {
    const criticalGovFails = govResults.filter(r => !r.passed && r.severity === 'critical').length;
    const highGovFails     = govResults.filter(r => !r.passed && r.severity === 'high').length;
    const criticalAP       = antiPatterns.filter(ap => ap.risk === 'critical').length;
    const highAP           = antiPatterns.filter(ap => ap.risk === 'high').length;
    const criticalSkillGap = skillGap.filter(s => s.status === 'critical').length;
    const majorSkillGap    = skillGap.filter(s => s.status === 'major').length;

    // ── No-Go：治理基礎嚴重缺失，或多個關鍵風險並存 ──────────────────────
    // 條件：2+ 個治理關鍵缺口，或 2+ 個關鍵反模式，或同時有 1 個治理缺口＋1 個關鍵反模式
    // （單一孤立關鍵反模式但治理完整者，降為附條件可行，避免誤判）
    const hardBlock = criticalGovFails >= 2
      || criticalAP >= 2
      || (criticalGovFails >= 1 && criticalAP >= 1);

    if (hardBlock) {
      return {
        decision: 'no-go',
        label:    '🔴 暫緩 (No-Go)',
        color:    '#ef4444',
        bgColor:  '#fef2f2',
        message:  `發現 ${criticalGovFails} 個治理關鍵缺口、${criticalAP} 個關鍵反模式，基礎條件不足，建議先完成前提條件再啟動遷移。`,
        conditions: [],
      };
    }

    // ── 金融行業額外前提條件 ───────────────────────────────────────────────
    const ind = (inputs?.industry || '').toLowerCase();
    const isFinancial = ['financial','banking','insurance','financial services','finance','銀行','金融','保險'].some(k => ind.includes(k));
    const financialPrereqs = [];
    if (isFinancial) {
      if (inputs?.isMajorOutsource === 'yes') financialPrereqs.push('MAS/FSC 重大委外通知文件（上線前 6 個月送件）');
      if (inputs?.hasPersonalData === 'yes' || inputs?.hasFinancialData === 'yes') financialPrereqs.push('資料主權評估完成：確認個資/交易資料 Region 落地合規（PDPA/FSC）');
      if (inputs?.complianceLevel === 'high') financialPrereqs.push('CSP 盡職調查報告取得（VAPT 報告、SOC 2 Type II、ISO 27001）');
    }
    const mvpPrereq = (isFinancial && inputs?.isCoreSystem === 'yes' && inputs?.cloudMaturity !== 'high')
      ? 'MVP Pilot 先行：以非核心系統完成 4–8 週 Pilot，驗證 Landing Zone + 合規掃描後再啟動核心系統波次'
      : null;

    // ── 附條件可行：有單一關鍵反模式、高度治理缺口或技能嚴重不足 ──────────
    const softBlock = criticalGovFails >= 1 || criticalAP >= 1
      || highGovFails > 1 || highAP > 1 || criticalSkillGap > 0
      || financialPrereqs.length > 0;

    if (softBlock) {
      const conditions = [];
      if (mvpPrereq)         conditions.push(mvpPrereq);
      if (criticalAP >= 1) {
        const names = antiPatterns.filter(ap => ap.risk === 'critical').map(ap => ap.name).join('、');
        conditions.push(`優先處理關鍵反模式：${names}（遷移前必須制定對應緩解計畫）`);
      }
      if (criticalGovFails >= 1) conditions.push(`完成 ${criticalGovFails} 個關鍵治理項目建置（IAM / Landing Zone 等）`);
      if (highGovFails > 0)      conditions.push(`補強 ${highGovFails} 個高風險治理項目`);
      if (criticalSkillGap > 0)  conditions.push(`引入 ${criticalSkillGap} 個關鍵技能資源（外部顧問或專職招募）`);
      if (highAP > 0)            conditions.push(`制定 ${highAP} 個高風險反模式的對應計畫`);
      conditions.push(...financialPrereqs);
      return {
        decision: 'conditional',
        label:    '🟡 附條件可行 (Conditional Go)',
        color:    '#b45309',
        bgColor:  '#fef3c7',
        message:  isFinancial
          ? '金融行業遷移條件評估：整體方向可行，需先完成以下監管與技術前提條件：'
          : '整體方向可行，但需先完成以下前提條件後再正式啟動：',
        conditions,
      };
    }

    // ── 建議推進 ─────────────────────────────────────────────────────────────
    if (majorSkillGap > 0 || highAP > 0 || highGovFails > 0 || mvpPrereq) {
      const conditions = [];
      if (mvpPrereq)        conditions.push(mvpPrereq);
      if (highGovFails > 0) conditions.push(`建議完成 ${highGovFails} 個高風險治理項目`);
      if (highAP > 0)       conditions.push(`留意 ${highAP} 個中高風險反模式，執行中持續監控`);
      if (majorSkillGap > 0) conditions.push(`技能缺口建議透過培訓或外部顧問補強`);
      return {
        decision: 'go-with-notes',
        label:    '🟢 建議推進（留意事項）',
        color:    '#15803d',
        bgColor:  '#f0fdf4',
        message:  '整體條件符合遷移基準，建議按計畫推進並持續監控以下事項：',
        conditions,
      };
    }
    return {
      decision: 'go',
      label:    '🟢 建議推進 (Go)',
      color:    '#15803d',
      bgColor:  '#f0fdf4',
      message:  isFinancial
        ? '金融行業治理基礎、監管前提、技能配置均符合上雲條件，建議依 MVP Pilot → 核心系統分波遷移路徑推進。'
        : '治理基礎、技能配置、風險控制均在可接受範圍，建議按計劃推進遷移。',
      conditions: [],
    };
  }

  // ══════════════════════════════════════════════════════════
  // ── MAIN EVALUATE FUNCTION ────────────────────────────────
  // ══════════════════════════════════════════════════════════

  function evaluate(inputs, strategy6R) {
    const strategy = strategy6R?.primary || 'replatform';
    const industry = (inputs.industry || '').toLowerCase();

    // 1. Governance rules
    const govResults = GOVERNANCE_RULES.map(rule => ({
      ...rule, passed: rule.check(inputs),
    }));

    // 2. Industry compliance rules
    const compKey = (['financial','banking','insurance','banking_finance','financial services','finance'].some(k => industry.includes(k)))
      ? 'financial'
      : industry === 'healthcare' ? 'healthcare'
      : industry === 'government' ? 'government'
      : industry === 'manufacturing' ? 'manufacturing'
      : null;
    const compRules  = compKey ? (COMPLIANCE_RULES[compKey] || []) : [];
    const compResults = compRules.map(rule => ({ ...rule, passed: rule.check(inputs) }));

    // 3. Anti-patterns
    const triggeredAP = ANTI_PATTERNS.filter(ap => ap.trigger(inputs));

    // 4. Skill gap
    const skillGap = assessSkillGap(inputs, strategy);

    // 5. Strategy distribution
    const stratDist = strategyDistribution(strategy6R);

    // 6. Go/NoGo (pass inputs for financial-industry awareness)
    const goNoGo = determineGoNoGo(govResults, triggeredAP, skillGap, inputs);

    // 7. Governance score
    const passedGov  = govResults.filter(r => r.passed).length;
    const govScore   = Math.round((passedGov / govResults.length) * 100);

    // 8. Overall business readiness score
    const skillScore    = Math.round((skillGap.filter(s => s.gap === 0).length / Math.max(skillGap.length, 1)) * 100);
    const compliScore   = compResults.length === 0 ? 85
      : Math.round((compResults.filter(r => r.passed).length / compResults.length) * 100);
    const antiPatScore  = Math.max(20, 100 - triggeredAP.reduce((s, ap) => s + (ap.risk === 'critical' ? 30 : 15), 0));
    const bizReadiness  = Math.round((govScore * 0.35 + skillScore * 0.30 + compliScore * 0.20 + antiPatScore * 0.15));

    // 9. MVP Milestones — industry-aware, shown in Decision Board
    const isFinancialIndustry = compKey === 'financial';
    const mvpMust = isFinancialIndustry ? [
      '【Pilot 選定】選定非核心、非客戶直接接觸系統作為 MVP Pilot（內部分析/報表/HR 系統）',
      '【Day 0 治理】Landing Zone + Control Tower 金融帳號架構部署（含 Security/Log/Network 帳號）',
      '【監管前提】向主管機關完成雲端服務外包通知（MAS/FSC 重大委外申請）',
      '【安全基線】IAM Identity Center + MFA 強制 + CloudTrail + GuardDuty + Config Rules',
      '【資料合規】確認個資/金融資料 Region 落地、KMS 加密、S3 Object Lock 啟用',
      '【Pilot 驗證】平行運行 ≥ 4 週，完成效能/合規/DR 驗收，RTO/RPO 達標測試',
      '【Wave 1 啟動】Pilot 通過後，制定核心系統分波遷移計畫（Wave 1 非關鍵核心系統）',
    ] : [
      'AWS Landing Zone + Control Tower 部署',
      'IAM Identity Center + 最小授權 RBAC 設計',
      'CloudTrail + Config + GuardDuty 基礎安全啟用',
      '1 個非核心系統完整遷移驗證（MVP Pilot）',
      '成本監控與預算告警機制建立',
      'DR 演練通過（RTO/RPO 達標）',
    ];

    return {
      governance:   { rules: govResults, score: govScore, passedGov, totalGov: govResults.length },
      compliance:   { rules: compResults, jurisdiction: compKey },
      antiPatterns: triggeredAP,
      skillGap,
      strategyDistribution: stratDist,
      goNoGo,
      mvpMust,
      scores: { governance: govScore, skill: skillScore, compliance: compliScore, antiPattern: antiPatScore, bizReadiness },
    };
  }

  // ── Public API ────────────────────────────────────────────
  return {
    evaluate,
    assessSkillGap,
    strategyDistribution,
    STRATEGY_COLORS,
    STRATEGY_LABELS_ZH,
  };

})();

window.RuleBase = RuleBase;
