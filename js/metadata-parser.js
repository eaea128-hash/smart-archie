/* ============================================================
   CloudFrame — Metadata Parser & Community Detection Engine
   Converts real system metadata (DSL / CSV / JSON) into the
   same graphData format as ImpactGraph.buildGraph(), replacing
   the industry template with actual dependency analysis.

   Supported inputs:
     DSL  — simple text-based dependency definition
     CSV  — FROM,TO[,TYPE] tabular format
     JSON — structured program/edge arrays

   Clustering: Hub-Territory algorithm (Newman-inspired, browser-safe)
   ============================================================ */

'use strict';

const MetadataParser = (() => {

  // ── DSL Format ────────────────────────────────────────────
  // PROG-A -> PROG-B             (CALL, default)
  // PROG-A -> PROG-B [CALL]
  // PROG-A -> DB-TABLE [DB-READ]
  // PROG-A -> DB-TABLE [DB-WRITE]
  // PROG-A -> EXT-API [EXTERNAL]
  // PROG-A -> REPORT [BATCH]
  // PROG-A -> PROG-B, PROG-C    (multiple targets)
  // # comment  or  // comment
  //
  // Optional explicit groups:
  // GROUP: 核心帳務 { ACCT-MAIN, ACCT-DB, EOD-BATCH }

  function parseDSL(text) {
    const nodes = new Set();
    const edges = [];
    const explicitGroups = [];
    const errors = [];

    const lines = text.split('\n');
    lines.forEach((raw, lineNo) => {
      const line = raw.trim();
      if (!line || line.startsWith('#') || line.startsWith('//')) return;

      // GROUP: name { A, B, C }
      const groupMatch = line.match(/^GROUP\s*[:：]\s*(.+?)\s*\{([^}]+)\}/i);
      if (groupMatch) {
        const name    = groupMatch[1].trim();
        const members = groupMatch[2].split(',').map(m => m.trim().toUpperCase()).filter(Boolean);
        members.forEach(m => nodes.add(m));
        explicitGroups.push({ name, members });
        return;
      }

      // A -> B, C [TYPE]  or  A → B [TYPE]
      const edgeMatch = line.match(/^([A-Z0-9_\-\.]+)\s*(?:->|→|:)\s*(.+?)(?:\s*\[([A-Z\-]+)\])?$/i);
      if (!edgeMatch) {
        if (line.length > 0) errors.push(`行 ${lineNo + 1}：格式不識別「${line}」`);
        return;
      }

      const from    = edgeMatch[1].trim().toUpperCase();
      const targets = edgeMatch[2].split(',').map(t => t.trim().toUpperCase()).filter(Boolean);
      const type    = (edgeMatch[3] || 'CALL').toUpperCase();

      nodes.add(from);
      targets.forEach(to => {
        nodes.add(to);
        edges.push({ from, to, type });
      });
    });

    return { nodes: [...nodes], edges, explicitGroups, errors };
  }

  // ── CSV Format ────────────────────────────────────────────
  // FROM,TO[,TYPE]
  // Header row is auto-detected and skipped.

  function parseCSV(text) {
    const nodes = new Set();
    const edges = [];
    const errors = [];

    const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
    lines.forEach((line, i) => {
      const cols = line.split(',').map(c => c.trim().replace(/^["']|["']$/g, ''));
      if (cols.length < 2) return;

      // Skip header row
      if (i === 0 && /^(from|source|caller|program|程式)/i.test(cols[0])) return;

      const from = cols[0].toUpperCase();
      const to   = cols[1].toUpperCase();
      const type = (cols[2] || 'CALL').toUpperCase();

      if (!from || !to) {
        errors.push(`行 ${i + 1}：缺少 FROM 或 TO 欄位`);
        return;
      }

      nodes.add(from);
      nodes.add(to);
      edges.push({ from, to, type });
    });

    return { nodes: [...nodes], edges, explicitGroups: [], errors };
  }

  // ── JSON Format ───────────────────────────────────────────
  // { nodes: ["A","B",...], edges: [{from:"A",to:"B",type:"CALL"},...]  }
  // OR { programs: [...], dependencies: [...] }

  function parseJSON(text) {
    const errors = [];
    let raw;
    try { raw = JSON.parse(text); } catch (e) {
      return { nodes: [], edges: [], explicitGroups: [], errors: [`JSON 解析錯誤：${e.message}`] };
    }

    const nodeList = raw.nodes || raw.programs || raw.modules || [];
    const edgeList = raw.edges || raw.dependencies || raw.calls || [];

    const nodes = new Set(nodeList.map(n => (typeof n === 'string' ? n : n.name || n.id || '').toUpperCase()).filter(Boolean));
    const edges = edgeList.map(e => {
      const from = (e.from || e.source || e.caller || '').toUpperCase();
      const to   = (e.to   || e.target || e.callee || '').toUpperCase();
      const type = (e.type || e.relationship || 'CALL').toUpperCase();
      if (from) nodes.add(from);
      if (to)   nodes.add(to);
      return { from, to, type };
    }).filter(e => e.from && e.to);

    const explicitGroups = (raw.groups || raw.clusters || []).map(g => ({
      name:    g.name || g.label || '',
      members: (g.members || g.nodes || g.programs || []).map(m => (typeof m === 'string' ? m : m.name || '').toUpperCase()),
    }));

    return { nodes: [...nodes], edges, explicitGroups, errors };
  }

  // ── Community Detection: Hub-Territory Algorithm ──────────
  // 1. If explicit GROUP directives → use them directly
  // 2. Find disconnected components via BFS
  // 3. If too many components → merge smallest until target count
  // 4. For single large component → hub-based territory partition
  // Target: 3–6 clusters (practical for PM decision-making)

  const TARGET_MIN = 2;
  const TARGET_MAX = 6;

  function detectCommunities(nodes, edges, explicitGroups) {
    if (!nodes.length) return [];

    // If explicit groups provided, use them (fill unassigned nodes into "Other")
    if (explicitGroups.length > 0) {
      return _buildFromExplicitGroups(nodes, edges, explicitGroups);
    }

    // Build adjacency (undirected for clustering)
    const adj = {};
    nodes.forEach(n => { adj[n] = new Set(); });
    edges.forEach(e => {
      if (adj[e.from]) adj[e.from].add(e.to);
      if (adj[e.to])   adj[e.to].add(e.from);
    });

    // Step 1: Find connected components
    const components = _connectedComponents(nodes, adj);

    // Step 2: Merge tiny components into neighbors or "Other" until ≤ TARGET_MAX
    const merged = _mergeSmallComponents(components, adj, edges);

    // Step 3: Split oversized components via hub partitioning
    const final = _splitLargeComponents(merged, adj, edges);

    return final;
  }

  function _connectedComponents(nodes, adj) {
    const visited = new Set();
    const components = [];

    nodes.forEach(start => {
      if (visited.has(start)) return;
      const comp = [];
      const queue = [start];
      while (queue.length) {
        const n = queue.shift();
        if (visited.has(n)) continue;
        visited.add(n);
        comp.push(n);
        (adj[n] || new Set()).forEach(nb => { if (!visited.has(nb)) queue.push(nb); });
      }
      if (comp.length > 0) components.push(comp);
    });

    return components;
  }

  function _mergeSmallComponents(components, adj, edges) {
    // Sort descending by size
    let comps = [...components].sort((a, b) => b.length - a.length);

    // If under limit → done
    if (comps.length <= TARGET_MAX) return comps;

    // Merge smallest into most-connected larger component
    while (comps.length > TARGET_MAX) {
      comps.sort((a, b) => b.length - a.length);
      const smallest = comps.pop();  // remove smallest

      // Find which larger component has most edges to smallest
      let bestIdx  = 0;
      let bestEdges = -1;
      comps.forEach((comp, idx) => {
        const edgeCount = edges.filter(e =>
          (smallest.includes(e.from) && comp.includes(e.to)) ||
          (smallest.includes(e.to)   && comp.includes(e.from))
        ).length;
        if (edgeCount > bestEdges) { bestEdges = edgeCount; bestIdx = idx; }
      });

      comps[bestIdx] = [...comps[bestIdx], ...smallest];
    }

    return comps;
  }

  function _splitLargeComponents(components, adj, edges) {
    // Split any component with > MAX_CLUSTER_SIZE members using multi-hub BFS.
    // Target: produce 2–4 clusters per large component (realistic for PM decisions).
    const MAX_CLUSTER_SIZE = 8;
    const result = [];

    components.forEach(comp => {
      // Keep small components or when global limit reached
      if (comp.length <= MAX_CLUSTER_SIZE || result.length + 1 >= TARGET_MAX) {
        result.push(comp);
        return;
      }

      // How many hubs? aim for ~4 nodes per cluster (ceil(n/4)), capped at remaining slots
      const remainingSlots = TARGET_MAX - result.length;
      const numHubs = Math.min(
        remainingSlots,
        Math.max(2, Math.ceil(comp.length / 4))
      );

      // Rank by degree within component, pick top-N as hubs
      const degrees = {};
      const compSet = new Set(comp);
      comp.forEach(n => {
        degrees[n] = [...(adj[n] || [])].filter(nb => compSet.has(nb)).length;
      });
      const hubs = [...comp].sort((a, b) => degrees[b] - degrees[a]).slice(0, numHubs);

      // Multi-hub BFS territory assignment
      const territory = {};
      hubs.forEach((h, i) => { territory[h] = i; });
      const visited = new Set(hubs);
      const queue = hubs.map((h, i) => ({ node: h, hub: i }));

      while (queue.length) {
        const { node, hub } = queue.shift();
        (adj[node] || new Set()).forEach(nb => {
          if (!visited.has(nb) && compSet.has(nb)) {
            visited.add(nb);
            territory[nb] = hub;
            queue.push({ node: nb, hub });
          }
        });
      }

      // Unvisited nodes → assign to hub with most direct edges
      comp.filter(n => territory[n] === undefined).forEach(n => {
        let best = 0, bestCount = -1;
        hubs.forEach((_, i) => {
          const count = edges.filter(e =>
            (e.from === n && territory[e.to] === i) ||
            (e.to   === n && territory[e.from] === i)
          ).length;
          if (count > bestCount) { bestCount = count; best = i; }
        });
        territory[n] = best;
      });

      // Build N groups and push non-empty ones
      hubs.forEach((_, i) => {
        const group = comp.filter(n => territory[n] === i);
        if (group.length > 0) result.push(group);
      });
    });

    return result;
  }

  function _buildFromExplicitGroups(nodes, edges, explicitGroups) {
    const assigned = new Set();
    const groups   = explicitGroups.map(g => {
      g.members.forEach(m => assigned.add(m));
      return [...g.members];
    });

    // Unassigned nodes → "其他模組" cluster
    const unassigned = nodes.filter(n => !assigned.has(n));
    if (unassigned.length > 0) groups.push(unassigned);

    return groups;
  }

  // ── Coupling Score ────────────────────────────────────────
  // Composite: internal density + external inbound pressure per node.
  // Avoids the "small cluster = inflated density" problem of pure n*(n-1) normalization.
  function calcCouplingScore(members, allEdges) {
    const memberSet  = new Set(members);
    const n          = members.length;
    if (n === 0) return 0;

    const internal   = allEdges.filter(e => memberSet.has(e.from) && memberSet.has(e.to)).length;
    const inbound    = allEdges.filter(e => !memberSet.has(e.from) && memberSet.has(e.to)).length;
    const outbound   = allEdges.filter(e => memberSet.has(e.from) && !memberSet.has(e.to)).length;

    // Coupling = how hard is this cluster to decouple from the rest?
    // Inbound counts more (others depend on us = hard to change)
    // Normalize per cluster member so large clusters aren't penalized
    const raw = ((inbound * 18 + outbound * 6 + internal * 3) / (n * 1.5));
    return Math.min(98, Math.max(5, Math.round(raw)));
  }

  // ── Edge Strength Classification ──────────────────────────
  // Count directed edges between two clusters
  function clusterEdgeStrength(fromMembers, toMembers, edges) {
    const count = edges.filter(e => fromMembers.includes(e.from) && toMembers.includes(e.to)).length;
    if (count >= 4) return 'critical';
    if (count >= 2) return 'high';
    if (count === 1) return 'medium';
    return null;
  }

  // ── Cluster Naming ────────────────────────────────────────
  // Detect common prefixes and map to meaningful names

  const PREFIX_NAME_MAP = [
    { pattern: /^(ACCT|ACCOUNT|DEPOSI|SAVINGS|LOAN|CREDIT)/i,  name: '帳務核心',   layer: 'core' },
    { pattern: /^(PAY|PAYMENT|SWIFT|ATM|CLEAR|TRANS|REMIT)/i,  name: '支付清算',   layer: 'payments' },
    { pattern: /^(RPT|REPORT|RECONCIL|AUDIT|STAT|STMT)/i,      name: '報表稽核',   layer: 'reporting' },
    { pattern: /^(WEB|API|GW|GATEWAY|MOBILE|APP|PORTAL|UI)/i,  name: '數位管道',   layer: 'digital' },
    { pattern: /^(BATCH|EOD|BOD|SCHED|JOB|CYCLE)/i,            name: '批次作業',   layer: 'batch' },
    { pattern: /^(DB|DATABASE|TABLE|STORE|REPO|PERSIST)/i,     name: '資料持久層', layer: 'data' },
    { pattern: /^(EXT|EXTERN|THIRD|PARTNER|SVC|SERVICE)/i,     name: '外部整合',   layer: 'integration' },
    { pattern: /^(AUTH|LOGIN|USER|SECURITY|PERM|ROLE)/i,       name: '認證授權',   layer: 'auth' },
    { pattern: /^(NOTIF|ALERT|EMAIL|SMS|PUSH|MSG|MAIL)/i,      name: '通知服務',   layer: 'notify' },
    { pattern: /^(CORE|MAIN|CENTRAL|MASTER|PRIMARY)/i,         name: '核心業務',   layer: 'core' },
    { pattern: /^(MES|PROD|PRODUCT|MANUFACT|PLANT)/i,          name: '製造執行',   layer: 'mes' },
    { pattern: /^(INV|INVENTORY|STOCK|WAREHOUSE|WMS)/i,        name: '庫存倉儲',   layer: 'inventory' },
    { pattern: /^(ORDER|SALES|CUSTOMER|CRM|CLIENT)/i,          name: '客戶銷售',   layer: 'sales' },
    { pattern: /^(HR|PAYROLL|STAFF|EMPLOYEE|HRM)/i,            name: '人力資源',   layer: 'hr' },
    { pattern: /^(FIN|FINANCE|GL|GENERAL|LEDGER|COST)/i,       name: '財務會計',   layer: 'finance' },
  ];

  function nameCluster(members, idx, explicitName) {
    if (explicitName) return explicitName;
    if (!members.length) return `群組 ${idx + 1}`;

    // Count prefix matches
    const tally = {};
    members.forEach(m => {
      PREFIX_NAME_MAP.forEach(({ pattern, name }) => {
        if (pattern.test(m)) tally[name] = (tally[name] || 0) + 1;
      });
    });

    const top = Object.entries(tally).sort((a, b) => b[1] - a[1]);
    if (top.length > 0 && top[0][1] >= Math.ceil(members.length * 0.25)) {
      return top[0][0];
    }

    // Fallback: use hub node name (shortest form, max 12 chars)
    const hub = members[0];
    const short = hub.replace(/[-_]/g, ' ').split(' ')[0].slice(0, 12);
    return `${short} 群組`;
  }

  // ── Risk Level from Coupling Score ────────────────────────
  // Thresholds calibrated for the composite coupling formula above.
  function riskFromCoupling(coupling, hasExternalDep, isHub) {
    if (coupling > 40 || isHub)            return 'critical';
    if (coupling > 20 || hasExternalDep)   return 'high';
    if (coupling > 8)                      return 'medium';
    return 'low';
  }

  // ── Display Coupling Normalization ───────────────────────
  // Maps raw coupling (typically 0–30) to a risk-consistent visual range.
  // Keeps the bar visually aligned with the risk badge without changing risk logic.
  const DISPLAY_RANGE = { critical: [70, 95], high: [45, 70], medium: [20, 45], low: [8, 22] };

  function _normalizeDisplayCoupling(rawCoupling, risk) {
    const [lo, hi] = DISPLAY_RANGE[risk] || [10, 60];
    const t = Math.min(1, rawCoupling / 25);  // raw typically peaks around 25
    return Math.round(lo + t * (hi - lo));
  }

  // ── Phase Assignment ──────────────────────────────────────
  function phaseFromRisk(risk, strategy) {
    const map = {
      rehost:     { low: 1, medium: 2, high: 2, critical: 3 },
      replatform: { low: 1, medium: 2, high: 2, critical: 3 },
      refactor:   { low: 1, medium: 2, high: 3, critical: 3 },
      retain:     { low: 2, medium: 3, high: 3, critical: 3 },
    };
    return (map[strategy] || map.replatform)[risk] || 2;
  }

  // ── Wave Reason Generator ─────────────────────────────────
  function waveReason(cluster) {
    const { phase, risk, couplingScore, hasExternalDep, downstream } = cluster;
    const ext = hasExternalDep ? '含外部介面，需協調外部窗口凍結版本。' : '';
    const down = downstream?.length > 0 ? `下游有 ${downstream.length} 個群組依賴，` : '';
    if (risk === 'critical') {
      return `Phase ${phase} 末段：${down}耦合度 ${couplingScore}% 為全局最高，需等其他群組穩定運行 ≥ 3 個月後方可遷移。${ext}`;
    } else if (risk === 'high') {
      return `Phase ${phase}：${down}高耦合建議整批遷移，採 Parallel Run（雙軌運行）2–4 週確認一致後再切換。${ext}`;
    } else if (risk === 'medium') {
      return `Phase ${phase}：中等耦合，可先建立雲端版本後逐步切流量（Canary 策略），降低切換風險。${ext}`;
    } else {
      return `Phase ${phase} 首選（PoC 範圍）：低耦合、${hasExternalDep ? '雖有外部依賴但' : ''}獨立部署風險最低，適合作為技術可行性驗證的第一個遷移目標。`;
    }
  }

  // ── Insight Text Generator ────────────────────────────────
  function generateInsight(cluster) {
    const { name, couplingScore, risk, upstream, downstream, hasExternalDep, modules } = cluster;
    const extNote = hasExternalDep ? '⚠️ 含外部介面依賴，遷移前需協調外部窗口。' : '';
    const up = (upstream || []).length;
    const dn = (downstream || []).length;

    if (risk === 'critical') {
      return `🔴 耦合度 ${couplingScore}%，被 ${up} 個群組依賴（含強依賴）。此群組為全域資料匯聚點，任何遷移中斷將影響 ${up} 個上游服務。強烈建議最後遷移，且前置條件為：所有依賴群組已在雲端穩定運行 ≥ 3 個月。 ${extNote}`;
    } else if (risk === 'high') {
      return `🟠 耦合度 ${couplingScore}%，下游影響 ${dn} 個群組。遷移前需建立完整 Rollback 計畫與切換 Runbook，且需整批遷移（避免部分遷移造成介面不一致）。${extNote}`;
    } else if (risk === 'medium') {
      return `🟡 耦合度 ${couplingScore}%，${up > 0 ? `被 ${up} 個群組讀取，` : ''}可接受 Canary 策略逐步切換。建議先在雲端建立鏡像版本，A/B 測試 2 週確認效能與資料一致性後正式切換。${extNote}`;
    } else {
      return `🟢 低耦合（${couplingScore}%），${up === 0 ? '無上游依賴' : `僅被 ${up} 個群組以讀取方式呼叫`}。可獨立部署，作為 Phase 1 PoC 最佳候選，快速驗證雲端 CI/CD 與網路連線可行性。${extNote}`;
    }
  }

  // ── Main Pipeline ─────────────────────────────────────────
  // rawText + format → graphData (same shape as ImpactGraph.buildGraph output)

  function buildGraphFromMetadata(rawText, format, strategy6R) {
    const strategy = strategy6R?.primary || 'replatform';

    // 1. Parse
    let parsed;
    if (format === 'csv')  parsed = parseCSV(rawText);
    else if (format === 'json') parsed = parseJSON(rawText);
    else                   parsed = parseDSL(rawText);

    if (!parsed.nodes.length) {
      return { clusters: [], dependencies: [], errors: parsed.errors, stats: null };
    }

    // 2. Detect communities
    const communityGroups = detectCommunities(parsed.nodes, parsed.edges, parsed.explicitGroups);

    // 3. Build cluster objects
    // First pass: compute totalEdges per cluster to identify hub
    const clusterTotalEdges = communityGroups.map(members => {
      const memberSet = new Set(members);
      return parsed.edges.filter(e => memberSet.has(e.from) || memberSet.has(e.to)).length;
    });
    const maxTotalEdges = Math.max(...clusterTotalEdges);

    const clustersRaw = communityGroups.map((members, idx) => {
      const explicitName = parsed.explicitGroups[idx]?.name;
      const rawCoupling  = calcCouplingScore(members, parsed.edges);

      // External deps (EXTERNAL type edges touching this cluster)
      const memberSet = new Set(members);
      const hasExternalDep = parsed.edges.some(e =>
        (memberSet.has(e.from) || memberSet.has(e.to)) && e.type === 'EXTERNAL'
      );

      // Hub = cluster with most total edge connections in the graph
      const totalEdges = clusterTotalEdges[idx];
      const isHub      = totalEdges === maxTotalEdges && communityGroups.length > 1;

      const risk    = riskFromCoupling(rawCoupling, hasExternalDep, isHub);
      const phase   = phaseFromRisk(risk, strategy);
      // Normalize coupling score to a risk-consistent visual range
      const couplingScore = _normalizeDisplayCoupling(rawCoupling, risk);

      // Find hub node (highest internal degree) for naming
      const degrees = {};
      members.forEach(m => {
        degrees[m] = parsed.edges.filter(e =>
          (e.from === m || e.to === m) && memberSet.has(e.from) && memberSet.has(e.to)
        ).length;
      });
      const hubNode = [...members].sort((a, b) => (degrees[b] || 0) - (degrees[a] || 0))[0];

      return {
        id:          `mc-${idx}`,
        name:        nameCluster(members, idx, explicitName),
        risk,
        phase,
        modules:     members,
        couplingScore,
        hasExternalDep,
        hubNode,
        totalEdges,
        _members:    members,  // kept for inter-cluster dep computation
      };
    }).sort((a, b) => b.couplingScore - a.couplingScore);

    // 4. Build inter-cluster dependencies
    const clusterDeps = [];
    for (let i = 0; i < clustersRaw.length; i++) {
      for (let j = 0; j < clustersRaw.length; j++) {
        if (i === j) continue;
        const strength = clusterEdgeStrength(clustersRaw[i]._members, clustersRaw[j]._members, parsed.edges);
        if (strength) {
          const label = _buildEdgeLabel(clustersRaw[i]._members, clustersRaw[j]._members, parsed.edges);
          clusterDeps.push({ from: clustersRaw[i].id, to: clustersRaw[j].id, strength, label });
        }
      }
    }

    // 5. Enrich with upstream/downstream maps
    const impactMap = {};
    clusterDeps.forEach(d => {
      if (!impactMap[d.from]) impactMap[d.from] = { downstream: [], upstream: [] };
      if (!impactMap[d.to])   impactMap[d.to]   = { downstream: [], upstream: [] };
      impactMap[d.from].downstream.push({ id: d.to, strength: d.strength, label: d.label });
      impactMap[d.to].upstream.push({ id: d.from, strength: d.strength, label: d.label });
    });

    const clusters = clustersRaw.map(c => {
      const enriched = {
        ...c,
        downstream: impactMap[c.id]?.downstream || [],
        upstream:   impactMap[c.id]?.upstream   || [],
        desc: '',
      };
      enriched.insight    = generateInsight(enriched);
      enriched.waveReason = waveReason(enriched);
      return enriched;
    });

    // 6. Stats
    const stats = {
      programs:     parsed.nodes.length,
      edges:        parsed.edges.length,
      clusters:     clusters.length,
      externalDeps: parsed.edges.filter(e => e.type === 'EXTERNAL').length,
      dbDeps:       parsed.edges.filter(e => e.type.startsWith('DB')).length,
      errors:       parsed.errors,
    };

    return {
      clusters,
      dependencies: clusterDeps,
      stats,
      _raw:        parsed,  // raw parsed data preserved for debugging
      sourceMode: 'metadata',
      strategy,
    };
  }

  function _buildEdgeLabel(fromMembers, toMembers, edges) {
    const relevant = edges.filter(e => fromMembers.includes(e.from) && toMembers.includes(e.to));
    const types    = [...new Set(relevant.map(e => e.type))];
    const typeMap  = { CALL:'程式呼叫', 'DB-READ':'DB 讀取', 'DB-WRITE':'DB 寫入', EXTERNAL:'外部呼叫', BATCH:'批次作業' };
    const typeStr  = types.map(t => typeMap[t] || t).join('/');
    return `${relevant.length} 個介面（${typeStr}）`;
  }

  // ── Format Validation ─────────────────────────────────────
  function detectFormat(text) {
    const trimmed = text.trim();
    if (trimmed.startsWith('{') || trimmed.startsWith('[')) return 'json';
    const firstLine = trimmed.split('\n')[0];
    // CSV: first line has comma-separated tokens without -> or →
    if (/^[^→\->]+,[^→\->]+/.test(firstLine) && !/->|→/.test(firstLine)) return 'csv';
    return 'dsl';
  }

  // ── DSL Example Template ──────────────────────────────────
  const DSL_EXAMPLE = `# 系統相依關係定義（可貼上或修改後解析）
# 格式：程式名稱 -> 被呼叫程式 [關係類型]
# 關係類型：CALL（預設）/ DB-READ / DB-WRITE / EXTERNAL / BATCH

# 數位管道（低耦合，Phase 1 候選）
WEB-GW      -> ACCT-MAIN [CALL]
WEB-GW      -> AUTH-SVC  [CALL]
MOBILE-API  -> WEB-GW    [CALL]

# 核心帳務（高耦合，Phase 3）
ACCT-MAIN   -> ACCT-DB   [DB-READ]
ACCT-MAIN   -> ACCT-DB   [DB-WRITE]
ACCT-MAIN   -> INTEREST  [CALL]
ACCT-MAIN   -> AUDIT-LOG [CALL]
EOD-BATCH   -> ACCT-MAIN [BATCH]
EOD-BATCH   -> REPORT-GEN [CALL]

# 外部介面
SWIFT-GW    -> EXT-SWIFT  [EXTERNAL]
SWIFT-GW    -> ACCT-MAIN  [CALL]

# 報表（中耦合，Phase 2）
REPORT-GEN  -> ACCT-DB   [DB-READ]
REPORT-GEN  -> RPT-STORE [DB-WRITE]

# 選填：手動指定群組名稱
# GROUP: 核心帳務 { ACCT-MAIN, ACCT-DB, INTEREST, AUDIT-LOG }
# GROUP: 數位管道 { WEB-GW, MOBILE-API, AUTH-SVC }`;

  // ── Public API ────────────────────────────────────────────
  return {
    parseDSL, parseCSV, parseJSON,
    detectFormat,
    buildGraphFromMetadata,
    DSL_EXAMPLE,
  };

})();

window.MetadataParser = MetadataParser;
