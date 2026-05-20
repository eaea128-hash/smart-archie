/* ============================================================
   CloudFrame — Impact Graph (Bounded Context Analysis)
   Generates industry-specific architecture dependency model
   and migration wave recommendations from analysis inputs.

   No external libraries — pure SVG + HTML.
   ============================================================ */

'use strict';

const ImpactGraph = (() => {

  // ── Industry Module Templates ─────────────────────────────
  // Each cluster: { id, name, risk, phase, modules[], couplingScore,
  //   hasExternalDep, desc, waveReason }
  // Dependencies: { from, to, strength, label }

  const DOMAIN_TEMPLATES = {

    financial: {
      clusters: [
        {
          id: 'digital-channel', name: '數位管道層', risk: 'low',
          modules: ['行動銀行 API Gateway', '網銀閘道 WEBGW', '客服系統 CRMSVC', '推播通知 NOTFSVC'],
          couplingScore: 28, hasExternalDep: true,
          desc: '無狀態服務為主，容器化難度最低，與核心帳務為讀取依賴',
          waveReason: '低耦合、無狀態，風險最低，適合 Phase 1 作為 PoC 驗證範圍',
        },
        {
          id: 'reporting', name: '報表稽核層', risk: 'medium',
          modules: ['監理報表 REGSRPT', '對帳稽核 RECONCIL', '客戶對帳單 STMTSVC', '稽核日誌 AUDITLOG'],
          couplingScore: 44, hasExternalDep: false,
          desc: '批次讀取為主，與核心帳務為單向唯讀依賴，可接受 T+1 資料延遲',
          waveReason: '唯讀依賴可轉換為 API/CDC，Phase 2 遷移對業務影響最小',
        },
        {
          id: 'payments', name: '支付清算層', risk: 'high',
          modules: ['境內匯款 DOMTRANS', 'SWIFT 閘道 SWFTGW', 'ATM 介面 ATMSVC', '票據交換 CLRSVC'],
          couplingScore: 78, hasExternalDep: true,
          desc: '含外部金融網路介面（SWIFT/ATM），遷移需協調合規測試視窗',
          waveReason: '外部依賴需協調窗口（SWIFT/ATM），建議 Phase 2 末段，支付系統整批遷移',
        },
        {
          id: 'core-banking', name: '核心帳務層', risk: 'critical',
          modules: ['存款管理 DEPTSYS', '帳戶開立 ACCTOPN', '日終結算 EOD-BATCH', '利息計算 INTCALC', '總分類帳 GLSYS'],
          couplingScore: 94, hasExternalDep: false,
          desc: '所有交易的最終數據源，所有層均依賴此層，技術債最高',
          waveReason: '最高耦合度，強烈建議最後遷移；前置條件：其他三層已穩定運行 ≥ 3 個月',
        },
      ],
      dependencies: [
        { from: 'digital-channel', to: 'core-banking',  strength: 'high',     label: '讀帳戶餘額 / 交易紀錄' },
        { from: 'digital-channel', to: 'payments',       strength: 'high',     label: '發起匯款 / 支付指令' },
        { from: 'payments',        to: 'core-banking',   strength: 'critical', label: '記帳 / 沖正 / 日終對帳' },
        { from: 'reporting',       to: 'core-banking',   strength: 'medium',   label: '批次讀取帳務資料（T+1）' },
        { from: 'reporting',       to: 'payments',       strength: 'low',      label: '讀取清算明細報表' },
      ],
    },

    tech: {
      clusters: [
        {
          id: 'api-layer', name: 'API 閘道層', risk: 'low',
          modules: ['API Gateway', '認證授權 AuthSvc', '限流控制 RateLimiter', '服務路由 RouterSvc'],
          couplingScore: 22, hasExternalDep: false,
          desc: '無狀態閘道，可直接容器化，無資料庫依賴',
          waveReason: '無狀態、獨立部署，Phase 1 首選；可先做 Blue/Green 切換驗證',
        },
        {
          id: 'business-logic', name: '業務邏輯層', risk: 'medium',
          modules: ['訂單管理 OrderSvc', '庫存管理 InvSvc', '定價引擎 PriceSvc', '推薦引擎 RecSvc'],
          couplingScore: 62, hasExternalDep: false,
          desc: '核心業務邏輯，相互依賴中等，需整批遷移避免部分降級',
          waveReason: '業務邏輯相互依賴，Phase 2 整批遷移，功能驗收後切流量',
        },
        {
          id: 'integration', name: '外部整合層', risk: 'medium',
          modules: ['ERP 介面 ERPConnector', 'CRM 連接器 CRMLink', '物流 API LogisticsSvc', 'Email/SMS 閘道'],
          couplingScore: 50, hasExternalDep: true,
          desc: '外部依賴多，遷移前需協調合作夥伴 API 版本凍結窗口',
          waveReason: '外部 SLA 協調耗時，建議 Phase 2 與業務邏輯層同步推進',
        },
        {
          id: 'data-layer', name: '資料持久層', risk: 'critical',
          modules: ['主資料庫 Oracle', '快取叢集 Redis', '全文搜尋 ES', '報表資料倉儲 DW'],
          couplingScore: 91, hasExternalDep: false,
          desc: '所有上層服務的資料來源，停機影響 100% 系統，需最嚴謹的遷移計畫',
          waveReason: '最高風險；建議 RDS/Aurora 替換 Oracle 後，Phase 3 完成最終切換',
        },
      ],
      dependencies: [
        { from: 'api-layer',       to: 'business-logic', strength: 'high',     label: '業務請求路由' },
        { from: 'business-logic',  to: 'data-layer',     strength: 'critical', label: '讀寫主資料' },
        { from: 'business-logic',  to: 'integration',    strength: 'medium',   label: '調用外部服務' },
        { from: 'api-layer',       to: 'data-layer',     strength: 'low',      label: 'Session / 快取查詢' },
        { from: 'integration',     to: 'data-layer',     strength: 'medium',   label: '同步外部資料入庫' },
      ],
    },

    healthcare: {
      clusters: [
        {
          id: 'patient-portal', name: '病患服務入口', risk: 'low',
          modules: ['掛號預約 ApptSvc', '病歷查詢 PHRView', '繳費服務 PaySvc', '線上諮詢 TeleSvc'],
          couplingScore: 30, hasExternalDep: true,
          desc: '前端服務層，與 HIS 核心單向依賴，容器化難度低',
          waveReason: 'Phase 1：前端服務無狀態，作為 PoC 驗證雲端部署可行性',
        },
        {
          id: 'clinical-ops', name: '臨床作業系統', risk: 'high',
          modules: ['醫師工作站 CPOE', '護理紀錄 NursSvc', '藥局管理 PharmSvc', '手術排程 OTSvc'],
          couplingScore: 76, hasExternalDep: false,
          desc: '24×7 不可中斷，任何遷移停機需嚴格管控（手術排程容忍度：0）',
          waveReason: 'Phase 2：需完整 DR 演練通過後方可遷移，停機視窗 < 2 小時',
        },
        {
          id: 'his-core', name: 'HIS 核心帳務', risk: 'critical',
          modules: ['門診費用 OPDBilling', '住院費用 IPDBilling', '保險申報 InsurClaim', '總帳整合 GLLink'],
          couplingScore: 89, hasExternalDep: true,
          desc: '連結健保署申報系統，遷移需取得衛福部書面確認方可進行',
          waveReason: 'Phase 3 末段：需監管機關書面核准，法規合規前置作業最長',
        },
        {
          id: 'imaging', name: '醫學影像層', risk: 'medium',
          modules: ['PACS 影像服務', 'DICOM 閘道', 'AI 診斷輔助', '影像歸檔 Archive'],
          couplingScore: 48, hasExternalDep: false,
          desc: '資料量龐大，遷移主要挑戰為影像資料搬遷速度（數十 TB 等級）',
          waveReason: 'Phase 2：與臨床系統同批，優先在雲端建立 Archive 節點再逐步遷移',
        },
      ],
      dependencies: [
        { from: 'patient-portal', to: 'his-core',     strength: 'high',     label: '費用查詢 / 繳費' },
        { from: 'patient-portal', to: 'clinical-ops', strength: 'medium',   label: '掛號 / 預約排程' },
        { from: 'clinical-ops',   to: 'his-core',     strength: 'critical', label: '帳務記錄 / 保險申報' },
        { from: 'clinical-ops',   to: 'imaging',      strength: 'high',     label: '調閱影像 / DICOM' },
        { from: 'imaging',        to: 'his-core',     strength: 'low',      label: '費用計算（造影費用）' },
      ],
    },

    manufacturing: {
      clusters: [
        {
          id: 'iot-edge', name: 'IoT / 邊緣運算', risk: 'low',
          modules: ['感測器閘道 MQTT', '資料採集 OPC-UA', '邊緣分析 EdgeAI', '設備監控 MonSvc'],
          couplingScore: 25, hasExternalDep: true,
          desc: '邊緣節點，雲端化後仍需保留廠區本地節點，典型混合架構',
          waveReason: 'Phase 1：雲端資料湖建立後，邊緣資料串流至雲端，低停機風險',
        },
        {
          id: 'mes', name: '製造執行系統 MES', risk: 'high',
          modules: ['工單管理 WOSvc', '品管系統 QCSvc', '物料追蹤 TraceSvc', '產線排程 SchSvc'],
          couplingScore: 80, hasExternalDep: false,
          desc: '即時生產控制，遷移中斷直接影響產線，停機視窗極短（< 4 小時）',
          waveReason: 'Phase 2：需進行完整 Parallel Run（雙軌運行），確認資料一致後切換',
        },
        {
          id: 'erp-core', name: 'ERP 核心', risk: 'critical',
          modules: ['SAP 財務 FI/CO', 'SAP 採購 MM', 'SAP 銷售 SD', 'SAP 生產 PP'],
          couplingScore: 92, hasExternalDep: true,
          desc: 'SAP 系統通常需要 SAP RISE 或 SAP on AWS 方案，授權重新協商',
          waveReason: 'Phase 3：SAP 授權重談 + RISE 方案評估，通常 12–18 個月前置期',
        },
        {
          id: 'supply-chain', name: '供應鏈整合', risk: 'medium',
          modules: ['供應商入口 SupPortal', 'EDI 閘道', '物流追蹤 LogTrack', '倉儲系統 WMSSvc'],
          couplingScore: 55, hasExternalDep: true,
          desc: '涉及多家供應商 EDI 格式，遷移需同步通知並測試所有合作夥伴',
          waveReason: 'Phase 2：與 MES 並行，先建立雲端 EDI 橋接層，再逐步切換',
        },
      ],
      dependencies: [
        { from: 'iot-edge',     to: 'mes',          strength: 'high',     label: '即時生產資料上送' },
        { from: 'mes',          to: 'erp-core',     strength: 'critical', label: '工單費用計算 / 庫存異動' },
        { from: 'supply-chain', to: 'erp-core',     strength: 'high',     label: '採購單 / 驗收入庫' },
        { from: 'mes',          to: 'supply-chain', strength: 'medium',   label: '物料需求 / 領料申請' },
        { from: 'iot-edge',     to: 'erp-core',     strength: 'low',      label: '設備折舊 / 維修費用' },
      ],
    },

    government: {
      clusters: [
        {
          id: 'citizen-portal', name: '民眾服務入口', risk: 'low',
          modules: ['電子申辦 eService', '狀態查詢 StatusSvc', '線上繳費 PayGov', '通知推播 GovNotify'],
          couplingScore: 20, hasExternalDep: false,
          desc: '純前端服務，與後台單向依賴，符合政府雲端優先政策',
          waveReason: 'Phase 1：最低風險，符合政府上雲先行政策，建議作為 PoC 範疇',
        },
        {
          id: 'case-mgmt', name: '案件業務系統', risk: 'medium',
          modules: ['案件登記 CaseSvc', '流程審核 WorkflowSvc', '公文管理 DocMgmt', '電子簽章 eSigSvc'],
          couplingScore: 58, hasExternalDep: false,
          desc: '核心政府業務，遷移需完整 BIA（業務影響評估）與 BCP 計畫',
          waveReason: 'Phase 2：需通過政府雲端安全審查（ISMS）後方可遷移',
        },
        {
          id: 'inter-agency', name: '跨機關介接', risk: 'high',
          modules: ['戶政 API 介接', '財稅資料串接', '健保署介面', '地政資料同步'],
          couplingScore: 72, hasExternalDep: true,
          desc: '涉及多機關 MOU / 資訊交換協議，遷移需各機關聯合審查',
          waveReason: 'Phase 2 末段：跨機關協調期最長，建議提前 6 個月啟動溝通',
        },
        {
          id: 'core-db', name: '核心資料庫', risk: 'critical',
          modules: ['戶籍資料庫 HouseDB', '地政資料庫 LandDB', '稅務主檔 TaxDB', '歸檔系統 ArchiveDB'],
          couplingScore: 95, hasExternalDep: false,
          desc: '涉及個資法、檔案法，資料主權須留在政府管轄區域內',
          waveReason: 'Phase 3：最後遷移；須通過個資主管機關審查 + 資安健診',
        },
      ],
      dependencies: [
        { from: 'citizen-portal', to: 'case-mgmt',     strength: 'high',     label: '申辦案件提交 / 查詢' },
        { from: 'case-mgmt',      to: 'core-db',       strength: 'critical', label: '讀寫戶籍 / 地政主檔' },
        { from: 'case-mgmt',      to: 'inter-agency',  strength: 'high',     label: '跨機關資料驗核' },
        { from: 'inter-agency',   to: 'core-db',       strength: 'medium',   label: '資料交換同步' },
        { from: 'citizen-portal', to: 'core-db',       strength: 'low',      label: '身份驗證查詢' },
      ],
    },

    // Default fallback
    default: {
      clusters: [
        {
          id: 'frontend', name: '前端 / 介面層', risk: 'low',
          modules: ['Web 前端', 'Mobile App', 'API 閘道', '靜態資源 CDN'],
          couplingScore: 18, hasExternalDep: false,
          desc: '純展示層，容器化難度最低，無狀態部署',
          waveReason: 'Phase 1 首選：獨立部署，可快速驗證 CI/CD 與網路連線',
        },
        {
          id: 'application', name: '應用邏輯層', risk: 'medium',
          modules: ['業務服務群 BizSvc', '工作流引擎 WFEngine', '通知服務 NotifySvc', '排程作業 JobSvc'],
          couplingScore: 60, hasExternalDep: false,
          desc: '核心業務邏輯，相互依賴中等，需整批遷移',
          waveReason: 'Phase 2：PoC 驗證後，業務邏輯整批遷移，進行效能基線對比',
        },
        {
          id: 'integration', name: '整合層', risk: 'medium',
          modules: ['第三方 API 介接', 'ESB / Message Queue', 'File Transfer', 'Email Gateway'],
          couplingScore: 52, hasExternalDep: true,
          desc: '涉及外部合作夥伴介面，遷移需協調 API 版本窗口',
          waveReason: 'Phase 2：與應用層同步推進，建立雲端 API 橋接層後逐步切換',
        },
        {
          id: 'data', name: '資料層', risk: 'critical',
          modules: ['主要資料庫', '資料倉儲 DW', '快取服務', '備份系統'],
          couplingScore: 88, hasExternalDep: false,
          desc: '所有層的資料來源，停機影響最大，需最嚴謹遷移計畫',
          waveReason: 'Phase 3 最後：資料庫遷移前須完成所有應用層驗證',
        },
      ],
      dependencies: [
        { from: 'frontend',     to: 'application', strength: 'high',     label: '業務請求' },
        { from: 'application',  to: 'data',        strength: 'critical', label: '讀寫資料' },
        { from: 'application',  to: 'integration', strength: 'medium',   label: '外部服務調用' },
        { from: 'integration',  to: 'data',        strength: 'medium',   label: '外部資料同步' },
        { from: 'frontend',     to: 'data',        strength: 'low',      label: '快取 / Session' },
      ],
    },
  };

  // ── Map form industry value → template key ────────────────
  const INDUSTRY_MAP = {
    financial: 'financial',
    banking:   'financial',
    insurance: 'financial',
    healthcare:'healthcare',
    retail:    'default',
    manufacturing: 'manufacturing',
    government:'government',
    tech:      'tech',
    technology:'tech',
  };

  // ── Assign migration phases based on strategy + risk ──────
  function assignPhases(clusters, strategy) {
    const riskPhase = {
      rehost:     { low: 1, medium: 2, high: 2, critical: 3 },
      replatform: { low: 1, medium: 2, high: 2, critical: 3 },
      refactor:   { low: 1, medium: 2, high: 3, critical: 3 },
      retain:     { low: 2, medium: 3, high: 3, critical: 3 }, // retain = slower
    };
    const map = riskPhase[strategy] || riskPhase.replatform;
    return clusters.map(c => ({ ...c, phase: map[c.risk] || 2 }));
  }

  // ── Build impact graph from analysis result ───────────────
  function buildGraph(inputs, strategy6R) {
    const industry  = (inputs.industry || 'default').toLowerCase();
    const tplKey    = INDUSTRY_MAP[industry] || 'default';
    const tpl       = DOMAIN_TEMPLATES[tplKey] || DOMAIN_TEMPLATES.default;
    const strategy  = strategy6R?.primary || 'replatform';

    const clusters  = assignPhases([...tpl.clusters], strategy);
    const deps      = [...tpl.dependencies];

    // Enrich each cluster with impact data
    const impactMap = {};
    deps.forEach(d => {
      if (!impactMap[d.from]) impactMap[d.from] = { downstream: [], upstream: [] };
      if (!impactMap[d.to])   impactMap[d.to]   = { downstream: [], upstream: [] };
      impactMap[d.from].downstream.push({ id: d.to, strength: d.strength, label: d.label });
      impactMap[d.to].upstream.push({ id: d.from, strength: d.strength, label: d.label });
    });

    const enriched = clusters.map(c => ({
      ...c,
      downstream: impactMap[c.id]?.downstream || [],
      upstream:   impactMap[c.id]?.upstream   || [],
    }));

    // Generate summary insight for each cluster
    const withInsights = enriched.map(c => ({
      ...c,
      insight: _generateInsight(c, enriched, strategy),
    }));

    return { clusters: withInsights, dependencies: deps, strategy, industryKey: tplKey };
  }

  function _generateInsight(cluster, allClusters, strategy) {
    const downCount = cluster.downstream.length;
    const upCount   = cluster.upstream.length;
    const critDeps  = cluster.downstream.filter(d => d.strength === 'critical').length;
    const extNote   = cluster.hasExternalDep ? '⚠️ 含外部介面，遷移需協調外部窗口。' : '';
    const coupling  = cluster.couplingScore;

    let insight = '';
    if (cluster.risk === 'critical') {
      insight = `🔴 最高耦合度（${coupling}%），被 ${upCount} 個群組依賴。強烈建議最後遷移，前置條件：其他群組已穩定運行 ≥ 3 個月。`;
    } else if (cluster.risk === 'high') {
      const downNames = cluster.downstream.map(d => allClusters.find(c => c.id === d.id)?.name || d.id).join('、');
      insight = `🟠 高耦合，下游影響 ${downCount} 個群組${downCount > 0 ? '（' + downNames + '）' : ''}。遷移前需建立完整 Rollback 計畫。`;
    } else if (cluster.risk === 'medium') {
      insight = `🟡 中等耦合（${coupling}%），可接受 Parallel Run 策略。建議雙軌運行 2–4 週後再正式切換。`;
    } else {
      insight = `🟢 低耦合（${coupling}%），${upCount === 0 ? '無上游依賴' : `被 ${upCount} 個群組呼叫但為讀取型`}，適合作為 Phase 1 PoC 首選。`;
    }
    return insight + (extNote ? ' ' + extNote : '');
  }

  // ── Render State ─────────────────────────────────────────
  let _currentFormat = 'dsl';

  // ── Render ────────────────────────────────────────────────

  const RISK_COLORS = {
    low:      { bg: '#f0fdf4', border: '#4ade80', badge: '#16a34a', badgeBg: '#dcfce7', label: '低風險' },
    medium:   { bg: '#fffbeb', border: '#fbbf24', badge: '#b45309', badgeBg: '#fef3c7', label: '中風險' },
    high:     { bg: '#fff7ed', border: '#f97316', badge: '#c2410c', badgeBg: '#ffedd5', label: '高風險' },
    critical: { bg: '#fef2f2', border: '#ef4444', badge: '#b91c1c', badgeBg: '#fee2e2', label: '極高風險' },
  };

  const STRENGTH_COLORS = {
    critical: '#ef4444',
    high:     '#f97316',
    medium:   '#6366f1',
    low:      '#94a3b8',
  };

  function render(containerId, graphData) {
    const container = document.getElementById(containerId);
    if (!container) return;

    const { clusters, dependencies } = graphData;

    // Group by phase
    const byPhase = { 1: [], 2: [], 3: [] };
    clusters.forEach(c => { (byPhase[c.phase] || byPhase[3]).push(c); });

    const phaseLabels = {
      1: { label: 'Phase 1 — PoC 驗證首選', desc: '低耦合・獨立部署・快速驗證', color: '#4ade80' },
      2: { label: 'Phase 2 — 主體遷移',    desc: '中等耦合・需並行驗證・整批遷移', color: '#f97316' },
      3: { label: 'Phase 3 — 核心收尾',    desc: '高耦合・最後切換・前置條件最嚴', color: '#ef4444' },
    };

    container.innerHTML = `
      <div id="ig-layout">
        <!-- Left: Phase columns + SVG overlay -->
        <div id="ig-left">
          <div id="ig-phases">
            ${[1,2,3].map(ph => `
              <div class="ig-phase-col" id="ig-col-${ph}">
                <div class="ig-phase-header" style="border-color:${phaseLabels[ph].color}">
                  <span style="color:${phaseLabels[ph].color};font-weight:700;font-size:var(--fs-sm);">
                    ${phaseLabels[ph].label}
                  </span>
                  <span style="font-size:10px;color:var(--c-text-muted);">${phaseLabels[ph].desc}</span>
                </div>
                <div class="ig-clusters">
                  ${(byPhase[ph] || []).map(c => _clusterCard(c)).join('')}
                </div>
              </div>`).join('')}
          </div>
          <svg id="ig-svg" style="position:absolute;top:0;left:0;width:100%;height:100%;pointer-events:none;overflow:visible;"></svg>
        </div>

        <!-- Right: Impact panel -->
        <div id="ig-impact-panel">
          <div class="ig-impact-title">📍 影響分析</div>
          <div id="ig-impact-content" class="ig-impact-placeholder">
            ← 點擊左側任一群組查看詳細影響分析
          </div>
        </div>
      </div>

      <!-- Migration Wave Summary -->
      <div id="ig-wave-summary">
        <div style="font-size:var(--fs-xs);font-weight:700;color:var(--c-primary);text-transform:uppercase;letter-spacing:0.05em;margin-bottom:var(--sp-3);">
          📋 遷移波次建議摘要
        </div>
        ${[1,2,3].map(ph => {
          const pClusters = byPhase[ph] || [];
          if (!pClusters.length) return '';
          return `
            <div class="ig-wave-row">
              <div class="ig-wave-badge" style="background:${phaseLabels[ph].color}">P${ph}</div>
              <div class="ig-wave-body">
                <div style="font-weight:600;font-size:var(--fs-xs);">
                  ${pClusters.map(c => c.name).join(' ＋ ')}
                </div>
                <div style="color:var(--c-text-muted);font-size:10px;margin-top:2px;">
                  ${pClusters.map(c => c.modules.length).reduce((a,b)=>a+b,0)} 個程式 / 服務
                  ・耦合度：${Math.round(pClusters.map(c=>c.couplingScore).reduce((a,b)=>a+b,0)/pClusters.length)}%
                  ・風險：${pClusters.map(c => RISK_COLORS[c.risk]?.label || c.risk).join('/')}
                </div>
              </div>
            </div>`;
        }).join('')}
      </div>

      <!-- ── Metadata Input Panel ─────────────────────── -->
      <div id="ig-metadata-panel">
        <div class="ig-metadata-header">
          <div>
            <span style="font-size:var(--fs-sm);font-weight:700;color:var(--c-primary);">🔬 真實 Metadata 驅動分析</span>
            <span class="ig-metadata-source-badge" id="ig-source-badge">行業範本模式</span>
          </div>
          <div style="font-size:10px;color:var(--c-text-muted);margin-top:2px;">
            貼入您的系統相依關係資料，即可自動偵測群組、計算耦合度並重繪圖譜
          </div>
        </div>
        <div class="ig-metadata-body">
          <!-- Format Toggle -->
          <div class="ig-format-toggle">
            <button class="ig-fmt-btn ig-fmt-active" data-fmt="dsl"  onclick="ImpactGraph.setFormat('dsl')">DSL 語法</button>
            <button class="ig-fmt-btn"               data-fmt="csv"  onclick="ImpactGraph.setFormat('csv')">CSV 表格</button>
            <button class="ig-fmt-btn"               data-fmt="json" onclick="ImpactGraph.setFormat('json')">JSON 格式</button>
            <button class="ig-fmt-btn"               data-fmt="auto" onclick="ImpactGraph.setFormat('auto')">自動偵測</button>
          </div>

          <!-- Format Hints -->
          <div id="ig-fmt-hint-dsl"  class="ig-fmt-hint ig-fmt-hint-show">
            <code>程式A -&gt; 程式B [CALL|DB-READ|DB-WRITE|EXTERNAL|BATCH]</code>
            ・多目標：<code>A -&gt; B, C</code>
            ・群組：<code>GROUP: 名稱 &#123; A, B, C &#125;</code>
          </div>
          <div id="ig-fmt-hint-csv"  class="ig-fmt-hint">
            標題行（可選）：<code>FROM,TO,TYPE</code>　每行一條依賴關係，TYPE 可省略
          </div>
          <div id="ig-fmt-hint-json" class="ig-fmt-hint">
            <code>&#123;"nodes":["A","B"],"edges":[&#123;"from":"A","to":"B","type":"CALL"&#125;]&#125;</code>
          </div>
          <div id="ig-fmt-hint-auto" class="ig-fmt-hint">
            自動偵測格式：JSON 以 &#123; 開頭；CSV 用逗號分隔；其餘視為 DSL
          </div>

          <!-- Textarea -->
          <textarea id="ig-metadata-input" class="ig-metadata-textarea" rows="9"
            placeholder="貼入或輸入系統相依關係資料..."></textarea>

          <!-- Action Row -->
          <div class="ig-metadata-actions">
            <label class="ig-upload-label">
              📂 上傳 CSV 檔
              <input type="file" accept=".csv,.txt,.json" style="display:none;"
                onchange="ImpactGraph.handleFileUpload(event)">
            </label>
            <button class="ig-parse-btn" onclick="ImpactGraph.parseAndRender()">
              🔬 解析並更新圖譜
            </button>
            <button class="ig-load-example-btn" onclick="ImpactGraph.loadExample()">
              📋 載入範例
            </button>
          </div>

          <!-- Stats & Errors -->
          <div id="ig-parse-stats"  style="display:none;"></div>
          <div id="ig-parse-errors" style="display:none;"></div>
        </div>
      </div>
    `;

    // Store graph data on container for click handlers
    container.__graphData = graphData;

    // Draw SVG arrows after DOM renders
    requestAnimationFrame(() => _drawArrows(graphData, container));
  }

  function _clusterCard(c) {
    const col = RISK_COLORS[c.risk] || RISK_COLORS.medium;
    return `
      <div class="ig-cluster" id="igc-${c.id}"
        data-id="${c.id}"
        style="background:${col.bg};border-color:${col.border};"
        onclick="ImpactGraph.selectCluster('${c.id}')">
        <div class="igc-header">
          <span class="igc-name">${c.name}</span>
          <span class="igc-badge" style="background:${col.badgeBg};color:${col.badge};">${col.label}</span>
        </div>
        <div class="igc-modules">
          ${c.modules.slice(0, 3).map(m => `<span class="igc-module-tag">${m}</span>`).join('')}
          ${c.modules.length > 3 ? `<span class="igc-module-tag igc-more">+${c.modules.length - 3} 項</span>` : ''}
        </div>
        <div class="igc-coupling">
          <span style="color:var(--c-text-muted);font-size:10px;">耦合度</span>
          <div class="igc-coupling-bar">
            <div class="igc-coupling-fill" style="width:${c.couplingScore}%;background:${col.border};"></div>
          </div>
          <span style="font-size:10px;font-weight:600;color:${col.badge};">${c.couplingScore}%</span>
        </div>
        ${c.hasExternalDep ? '<div class="igc-ext-badge">🌐 外部依賴</div>' : ''}
      </div>`;
  }

  function _drawArrows(graphData, container) {
    const svg = document.getElementById('ig-svg');
    if (!svg) return;

    svg.innerHTML = '';
    const defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');

    // Add arrowhead markers for each strength
    Object.entries(STRENGTH_COLORS).forEach(([strength, color]) => {
      const marker = document.createElementNS('http://www.w3.org/2000/svg', 'marker');
      marker.setAttribute('id', `arrow-${strength}`);
      marker.setAttribute('markerWidth', '8');
      marker.setAttribute('markerHeight', '8');
      marker.setAttribute('refX', '7');
      marker.setAttribute('refY', '3');
      marker.setAttribute('orient', 'auto');
      marker.innerHTML = `<path d="M0,0 L0,6 L8,3 z" fill="${color}" />`;
      defs.appendChild(marker);
    });
    svg.appendChild(defs);

    const svgRect = svg.getBoundingClientRect();

    graphData.dependencies.forEach(dep => {
      const fromEl = document.getElementById(`igc-${dep.from}`);
      const toEl   = document.getElementById(`igc-${dep.to}`);
      if (!fromEl || !toEl) return;

      const fromRect = fromEl.getBoundingClientRect();
      const toRect   = toEl.getBoundingClientRect();

      const x1 = fromRect.right - svgRect.left;
      const y1 = fromRect.top + fromRect.height / 2 - svgRect.top;
      const x2 = toRect.left - svgRect.left;
      const y2 = toRect.top + toRect.height / 2 - svgRect.top;

      const color = STRENGTH_COLORS[dep.strength] || STRENGTH_COLORS.low;
      const strokeW = dep.strength === 'critical' ? 2.5 : dep.strength === 'high' ? 1.8 : 1.2;
      const dash    = dep.strength === 'low' ? '4,3' : 'none';

      // Bezier curve
      const cx = (x1 + x2) / 2;
      const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      path.setAttribute('d', `M${x1},${y1} C${cx},${y1} ${cx},${y2} ${x2},${y2}`);
      path.setAttribute('stroke', color);
      path.setAttribute('stroke-width', strokeW);
      path.setAttribute('stroke-dasharray', dash);
      path.setAttribute('fill', 'none');
      path.setAttribute('marker-end', `url(#arrow-${dep.strength})`);
      path.setAttribute('opacity', '0.7');
      path.dataset.from = dep.from;
      path.dataset.to   = dep.to;
      path.classList.add('ig-arrow');
      svg.appendChild(path);
    });
  }

  function selectCluster(clusterId) {
    const container = document.getElementById('igGraphContainer');
    if (!container?.__graphData) return;

    const { clusters, dependencies } = container.__graphData;
    const cluster = clusters.find(c => c.id === clusterId);
    if (!cluster) return;

    // Highlight selected card
    document.querySelectorAll('.ig-cluster').forEach(el => {
      el.classList.toggle('ig-selected', el.dataset.id === clusterId);
    });

    // Highlight relevant arrows
    document.querySelectorAll('.ig-arrow').forEach(el => {
      const active = el.dataset.from === clusterId || el.dataset.to === clusterId;
      el.style.opacity = active ? '1' : '0.1';
      el.style.strokeWidth = active ? '3' : null;
    });

    // Render impact panel
    const col = RISK_COLORS[cluster.risk] || RISK_COLORS.medium;
    const downNames = cluster.downstream.map(d => {
      const c = clusters.find(x => x.id === d.id);
      return `<span style="font-weight:600;color:${STRENGTH_COLORS[d.strength]};">
        ${c?.name || d.id}</span>（${d.label}）`;
    }).join('<br>');
    const upNames = cluster.upstream.map(d => {
      const c = clusters.find(x => x.id === d.id);
      return `<span style="font-weight:600;">${c?.name || d.id}</span>`;
    }).join('、');

    document.getElementById('ig-impact-content').innerHTML = `
      <div style="background:${col.bg};border:1px solid ${col.border};border-radius:var(--r-lg);padding:var(--sp-3);margin-bottom:var(--sp-3);">
        <div style="font-weight:700;color:${col.badge};font-size:var(--fs-sm);">${cluster.name}</div>
        <div style="font-size:10px;color:var(--c-text-muted);margin-top:2px;">${col.label} ・ 耦合度 ${cluster.couplingScore}% ・ Phase ${cluster.phase}</div>
      </div>

      <div class="ig-impact-block">
        <div class="ig-impact-block-title">🔍 綜合決策洞察</div>
        <div style="font-size:11px;line-height:1.8;color:var(--c-text);">${cluster.insight}</div>
      </div>

      <div class="ig-impact-block">
        <div class="ig-impact-block-title">📋 所含程式 / 服務（${cluster.modules.length} 個）</div>
        <div style="display:flex;flex-wrap:wrap;gap:4px;">
          ${cluster.modules.map(m => `<span class="igc-module-tag">${m}</span>`).join('')}
        </div>
      </div>

      ${cluster.downstream.length > 0 ? `
      <div class="ig-impact-block">
        <div class="ig-impact-block-title">⬇️ 此群組依賴（下游 ${cluster.downstream.length} 個）</div>
        <div style="font-size:11px;line-height:2;color:var(--c-text);">${downNames}</div>
        <div style="font-size:10px;color:#b45309;background:#fff8e1;border-radius:var(--r-md);padding:6px 8px;margin-top:6px;">
          ⚠️ 遷移此群組前，需確認下游群組 API 介面向後相容或已建立橋接層
        </div>
      </div>` : ''}

      ${cluster.upstream.length > 0 ? `
      <div class="ig-impact-block">
        <div class="ig-impact-block-title">⬆️ 依賴此群組的上游（${cluster.upstream.length} 個）</div>
        <div style="font-size:11px;color:var(--c-text);">${upNames}</div>
        <div style="font-size:10px;color:#1e40af;background:#eff6ff;border-radius:var(--r-md);padding:6px 8px;margin-top:6px;">
          ℹ️ 遷移前需通知以上群組做連線測試，確認沿用現有介面不受影響
        </div>
      </div>` : ''}

      <div class="ig-impact-block">
        <div class="ig-impact-block-title">🗺️ 建議遷移波次理由</div>
        <div style="font-size:11px;line-height:1.8;color:var(--c-text);">${cluster.waveReason}</div>
      </div>
    `;
  }

  // ── Metadata Panel Methods ────────────────────────────────

  function setFormat(fmt) {
    _currentFormat = fmt;

    // Toggle button active state
    document.querySelectorAll('.ig-fmt-btn').forEach(btn => {
      btn.classList.toggle('ig-fmt-active', btn.dataset.fmt === fmt);
    });

    // Show matching hint, hide others
    ['dsl','csv','json','auto'].forEach(f => {
      const el = document.getElementById(`ig-fmt-hint-${f}`);
      if (el) el.classList.toggle('ig-fmt-hint-show', f === fmt);
    });
  }

  function loadExample() {
    const ta = document.getElementById('ig-metadata-input');
    if (!ta) return;
    if (typeof MetadataParser === 'undefined') {
      _showError('MetadataParser 尚未載入，請確認 js/metadata-parser.js 已引入。');
      return;
    }
    ta.value = MetadataParser.DSL_EXAMPLE;
    setFormat('dsl');
  }

  function handleFileUpload(event) {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      const ta = document.getElementById('ig-metadata-input');
      if (ta) ta.value = e.target.result;

      // Auto-detect format from extension
      if (file.name.endsWith('.json')) setFormat('json');
      else if (file.name.endsWith('.csv')) setFormat('csv');
      else setFormat('auto');

      _showStats(null, `已載入檔案：${file.name}（${(file.size / 1024).toFixed(1)} KB）`);
    };
    reader.onerror = () => _showError('檔案讀取失敗，請重試。');
    reader.readAsText(file, 'UTF-8');
  }

  function parseAndRender() {
    const ta = document.getElementById('ig-metadata-input');
    if (!ta || !ta.value.trim()) {
      _showError('請先輸入或貼上系統相依關係資料。');
      return;
    }

    if (typeof MetadataParser === 'undefined') {
      _showError('MetadataParser 模組尚未載入，請確認 js/metadata-parser.js 已正確引入。');
      return;
    }

    const rawText = ta.value.trim();
    const fmt     = _currentFormat === 'auto' ? MetadataParser.detectFormat(rawText) : _currentFormat;

    // Get current strategy from stored graphData
    const container = document.getElementById('igGraphContainer');
    const strategy6R = container?.__graphData
      ? { primary: container.__graphData.strategy }
      : { primary: 'replatform' };

    _showStats(null, '⏳ 解析中...');

    let graphData;
    try {
      graphData = MetadataParser.buildGraphFromMetadata(rawText, fmt, strategy6R);
    } catch (e) {
      _showError(`解析失敗：${e.message}`);
      return;
    }

    if (!graphData.clusters.length) {
      _showError('未能偵測到有效節點，請確認資料格式正確。' +
        (graphData.errors?.length ? '<br>' + graphData.errors.join('<br>') : ''));
      return;
    }

    // Re-render graph with real data
    render('igGraphContainer', graphData);

    // Restore format toggle after re-render (render() resets innerHTML)
    setFormat(fmt);

    // Restore textarea content
    const newTa = document.getElementById('ig-metadata-input');
    if (newTa) newTa.value = rawText;

    // Show stats
    const s = graphData.stats;
    _showStats(s, null);

    // Update source badge
    const badge = document.getElementById('ig-source-badge');
    if (badge) {
      badge.textContent = 'Metadata 驅動模式';
      badge.style.background = '#dbeafe';
      badge.style.color = '#1d4ed8';
    }

    // Show parse errors as warnings if any
    if (s.errors?.length) {
      _showError('⚠️ 部分行無法解析（已忽略）：<br>' + s.errors.join('<br>'), 'warning');
    }
  }

  function _showStats(stats, msg) {
    const el = document.getElementById('ig-parse-stats');
    if (!el) return;

    if (msg) {
      el.style.display = 'block';
      el.innerHTML = `<span style="color:var(--c-text-muted);">${msg}</span>`;
      return;
    }

    if (!stats) { el.style.display = 'none'; return; }

    el.style.display = 'flex';
    el.innerHTML = `
      <span class="ig-stat-chip">📦 ${stats.programs} 個程式</span>
      <span class="ig-stat-chip">🔗 ${stats.edges} 條依賴</span>
      <span class="ig-stat-chip">🗂 ${stats.clusters} 個群組</span>
      ${stats.externalDeps > 0 ? `<span class="ig-stat-chip ig-stat-warn">🌐 ${stats.externalDeps} 個外部介面</span>` : ''}
      ${stats.dbDeps > 0       ? `<span class="ig-stat-chip">🗄 ${stats.dbDeps} 個 DB 依賴</span>` : ''}
    `;

    const errEl = document.getElementById('ig-parse-errors');
    if (errEl) errEl.style.display = 'none';
  }

  function _showError(msg, level = 'error') {
    const el = document.getElementById('ig-parse-errors');
    if (!el) return;
    const bg = level === 'warning' ? '#fff8e1' : '#fef2f2';
    const cl = level === 'warning' ? '#b45309' : '#b91c1c';
    el.style.display = 'block';
    el.innerHTML = `<div style="background:${bg};color:${cl};border-radius:var(--r-md);padding:8px 10px;font-size:11px;line-height:1.6;">${msg}</div>`;
  }

  // ── Public API ────────────────────────────────────────────
  return { buildGraph, render, selectCluster, setFormat, loadExample, handleFileUpload, parseAndRender };

})();

window.ImpactGraph = ImpactGraph;
