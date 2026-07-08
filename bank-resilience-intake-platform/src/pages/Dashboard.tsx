import { Fragment, useState } from "react";
import {
  AlertTriangle,
  ArrowRight,
  Building2,
  CheckCircle2,
  Clock,
  DatabaseZap,
  FileSearch,
  GitBranch,
  Globe2,
  ShieldAlert,
  ShieldCheck,
  ShoppingCart,
  TrendingUp,
  Users,
  Wrench,
} from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { loadDemoData, loadIntakeSubmissions } from "@/lib/storage";
import {
  assignedRoleLabel,
  cryptoAgilityLabel,
  pqcRoadmapLabel,
  riskLevelLabel,
  systemStatusLabel,
  vendorReadinessScore
} from "@/lib/labels";
import { assessHndlRisk, formatRetention } from "@/lib/hndl-risk";
import { runGuardrails, runIntakeGuardrails } from "@/lib/guardrails";
import { GuardrailPanel } from "@/components/guardrails/GuardrailPanel";
import { DataQualityIssues } from "@/components/guardrails/DataQualityIssues";
import { MetricCard } from "@/components/MetricCard";
import { StatusBadge } from "@/components/StatusBadge";
import { RuleExplanationPanel } from "@/components/RuleExplanationPanel";
import { RiskExplanationPanel as SystemRiskExplanationPanel } from "@/components/common/RiskExplanationPanel";
import { evaluateRules, explainRiskForSystem } from "@/lib/risk-rules";

function MgmtItem({ label, value, action, tone }: { label: string; value: string; action: string; href?: string; tone: "danger" | "warn" | "ok" }) {
  const toneColor = tone === "danger" ? "text-rose-600" : tone === "warn" ? "text-amber-600" : "text-emerald-700";
  return (
    <div className="rounded-lg border bg-background p-3">
      <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{label}</div>
      <p className={`text-sm font-medium leading-5 ${toneColor}`}>{value}</p>
      <div className="mt-2 flex items-center gap-1 text-xs text-primary">
        <ArrowRight className="h-3 w-3" />
        {action}
      </div>
    </div>
  );
}

export function Dashboard() {
  const [expandedSystemId, setExpandedSystemId] = useState<string | null>(null);
  const { systems, tasks, vendors, complianceLineage } = loadDemoData();
  const submissions = loadIntakeSubmissions();
  const guardrailAlerts = [
    ...runGuardrails(systems, vendors),
    ...runIntakeGuardrails(submissions),
  ];
  const completedSystems = systems.filter((system) => system.status === "completed").length;
  const pendingSystems = systems.length - completedSystems;
  const vendorById = new Map(vendors.map((vendor) => [vendor.vendorId, vendor]));
  const hndlAssessments = systems.map((system) => {
    const vendor = system.vendorId ? vendorById.get(system.vendorId) : undefined;
    return { ...system, vendor, hndlRisk: assessHndlRisk(system, vendor) };
  });
  const hndlHighRiskSystems = hndlAssessments.filter((system) => system.hndlRisk.level === "high").length;
  const longRetentionSystems = systems.filter((system) => system.dataRetentionYears > 10).length;
  const vendorsWithoutRoadmap = vendors.filter((vendor) => vendor.pqcRoadmapStatus === "未提供").length;
  const externalApiSystems = systems.filter((system) => system.hasExternalApi).length;
  const pendingSecurityTasks = tasks.filter((task) => task.assignedRole === "資安" && task.status !== "completed").length;
  const pendingProcurementTasks = tasks.filter((task) => task.assignedRole === "採購" && task.status !== "completed").length;
  const pendingArchTasks = tasks.filter((task) => task.assignedRole === "架構" && task.status !== "completed").length;

  // 高風險：由規則引擎判定為 critical 或 high 的系統
  const highRiskByRules = systems.filter((sys) => {
    const vendor = sys.vendorId ? vendorById.get(sys.vendorId) ?? null : null;
    const { riskLevel } = evaluateRules(sys, vendor);
    return riskLevel === "critical" || riskLevel === "high";
  }).length;

  const hndlRanking = [...hndlAssessments]
    .sort((a, b) => {
      const levelScore = { high: 3, medium: 2, low: 1 };
      return levelScore[b.hndlRisk.level] - levelScore[a.hndlRisk.level] || b.hndlRiskScore - a.hndlRiskScore;
    })
    .slice(0, 8);

  const vendorReadinessRanking = vendors
    .map((vendor) => ({
      ...vendor,
      readinessScore: vendorReadinessScore(vendor.pqcRoadmapStatus, vendor.cryptoAgilityStatus, vendor.contractUpgradeClause),
    }))
    .sort((a, b) => a.readinessScore - b.readinessScore);

  const riskExplanations = hndlRanking.slice(0, 4).map((system) => ({
    systemId: system.systemId,
    systemName: system.systemName,
    explanation: explainRiskForSystem(system, system.vendor ?? null),
  }));

  const riskDistribution = (["critical", "high", "medium", "low"] as const).map((risk) => ({
    name: riskLevelLabel[risk],
    value: systems.filter((system) => system.businessCriticality === risk).length,
    fill: risk === "critical" ? "#be123c" : risk === "high" ? "#d97706" : risk === "medium" ? "#2563eb" : "#64748b",
  }));

  const statusDistribution = ([
    ["not_started", "#94a3b8"],
    ["in_progress", "#2563eb"],
    ["security_review", "#d97706"],
    ["procurement_followup", "#be123c"],
    ["completed", "#0f766e"],
  ] as const).map(([status, fill]) => ({
    name: systemStatusLabel[status],
    value: systems.filter((system) => system.status === status).length,
    fill,
  }));

  const taskSummary = (["業務", "系統Owner", "資安", "架構", "採購", "供應商"] as const).map((role) => ({
    role,
    total: tasks.filter((task) => task.assignedRole === role).length,
    open: tasks.filter((task) => task.assignedRole === role && task.status !== "completed").length,
  }));

  // 2030 wave distribution (simplified inline calculation)
  const waveCounts = systems.reduce(
    (acc, s) => {
      const v = s.vendorId ? vendorById.get(s.vendorId) ?? null : null;
      const exp = explainRiskForSystem(s, v);
      const isHndl = s.dataRetentionYears >= 10 || s.hndlRiskScore >= 80;
      const urgency = Math.min(100, Math.round(exp.score * 0.5 + (isHndl ? 20 : 0)));
      const tags = [...s.cmdbTags, ...s.cryptoSignals].join(" ").toLowerCase();
      let feasibility = 50;
      if (v?.pqcRoadmapStatus === "已提供") feasibility += 15;
      else if (v?.pqcRoadmapStatus === "未提供") feasibility -= 10;
      if (v?.cryptoAgilityStatus === "不支援") feasibility -= 15;
      if (tags.includes("unknown crypto")) feasibility -= 15;
      const wave =
        urgency >= 60 && feasibility >= 55 ? "Wave 1" :
        urgency >= 60 && feasibility < 55  ? "Wave 2" :
        urgency < 60  && feasibility >= 55 ? "Wave 3" : "觀察";
      acc[wave] = (acc[wave] ?? 0) + 1;
      return acc;
    },
    {} as Record<string, number>
  );
  const daysTo2030 = Math.round((new Date("2030-01-01").getTime() - new Date().setHours(0,0,0,0)) / (1000 * 60 * 60 * 24));
  const completedCount = systems.filter(s => s.status === "completed").length;
  const estimatedReadyPct = Math.round(
    ((completedCount + (waveCounts["Wave 1"] ?? 0) * 0.3) / systems.length) * 100
  );
  const waveChartData = [
    { name: "Wave 1（緊迫）", value: waveCounts["Wave 1"] ?? 0, fill: "#be123c" },
    { name: "Wave 2（阻礙）", value: waveCounts["Wave 2"] ?? 0, fill: "#d97706" },
    { name: "Wave 3（計畫）", value: waveCounts["Wave 3"] ?? 0, fill: "#2563eb" },
    { name: "觀察", value: waveCounts["觀察"] ?? 0, fill: "#94a3b8" },
  ];

  return (
    <div className="space-y-6">

      {/* ── 系統入口 Banner ────────────────────────────────────── */}
      <section className="rounded-xl border bg-card overflow-hidden">
        {/* 上半：價值陳述 */}
        <div className="border-b bg-muted/30 px-6 py-5">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h1 className="text-xl font-bold tracking-tight">銀行科技韌性前期盤點平台</h1>
              <p className="mt-1 text-sm text-muted-foreground">
                填寫一份系統盤點表單，10 分鐘內取得：
              </p>
              <div className="mt-2 flex flex-wrap gap-2">
                {["風險分數與評級", "觸發原因清單", "跨部門任務清單", "可匯出盤點報告"].map((item) => (
                  <span key={item} className="inline-flex items-center gap-1 rounded-full border bg-background px-2.5 py-0.5 text-xs font-medium">
                    <CheckCircle2 className="h-3 w-3 text-emerald-500" />
                    {item}
                  </span>
                ))}
              </div>
            </div>
            <a href="/pqc-intake" className="shrink-0">
              <button className="inline-flex items-center gap-2 rounded-lg bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground shadow-sm hover:bg-primary/90 transition-colors whitespace-nowrap">
                <ArrowRight className="h-4 w-4" />
                開始填寫盤點表單
              </button>
            </a>
          </div>
        </div>

        {/* 下半：情境入口 */}
        <div className="px-6 py-4">
          <div className="mb-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">你目前的狀況是？</div>
          <div className="grid gap-2 sm:grid-cols-3">
            {[
              {
                situation: "第一次使用，還沒有任何資料",
                action: "從填寫盤點表單開始",
                href: "/pqc-intake",
                tone: "primary",
              },
              {
                situation: "已有盤點資料，要查看風險結果",
                action: "前往全行風險總覽",
                href: "/",
                tone: "default",
              },
              {
                situation: "來看供應商或治理追蹤進度",
                action: "前往平台總覽",
                href: "/storyboard",
                tone: "default",
              },
            ].map(({ situation, action, href, tone }) => (
              <a
                key={situation}
                href={href}
                className={`group flex flex-col gap-1.5 rounded-lg border px-4 py-3 transition-colors hover:border-primary/50 hover:bg-muted/40 ${
                  tone === "primary" ? "border-primary/30 bg-primary/5" : "bg-background"
                }`}
              >
                <div className="text-xs text-muted-foreground leading-5">{situation}</div>
                <div className="flex items-center gap-1 text-xs font-semibold text-primary">
                  <ArrowRight className="h-3 w-3 transition-transform group-hover:translate-x-0.5" />
                  {action}
                </div>
              </a>
            ))}
          </div>
        </div>
      </section>

      {/* ── 今日盤點總覽 ─────────────────────────────────────── */}
      <section>
        <div className="mb-3 flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold">今日盤點總覽</h1>
            <p className="mt-0.5 text-sm text-muted-foreground">
              依規則引擎即時計算 — 點擊各指標前往對應模組
            </p>
          </div>
          <div className="text-xs text-muted-foreground">
            共 <span className="font-semibold text-foreground">{systems.length}</span> 個系統 ·{" "}
            <span className="font-semibold text-foreground">{vendors.length}</span> 家供應商
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
          <OverviewCard
            icon={CheckCircle2}
            label="已盤點系統"
            value={systems.length}
            description="已完成前期資料填寫，納入風險評估範圍。"
            tone="info"
          />
          <OverviewCard
            icon={ShieldAlert}
            label="高風險系統"
            value={highRiskByRules}
            description="涉及長期資料保存、外部介接或供應商準備度不足，由規則引擎判定。"
            tone="danger"
          />
          <OverviewCard
            icon={ShieldCheck}
            label="供應商無 PQC 計畫"
            value={vendorsWithoutRoadmap}
            description="供應商尚未提交後量子密碼遷移路線圖，影響系統遷移排程。"
            tone="danger"
          />
          <OverviewCard
            icon={Clock}
            label="資料保存超過 10 年"
            value={longRetentionSystems}
            description="資料生命週期超過量子威脅時間窗（2030–2035），需優先評估 HNDL 風險。"
            tone="warn"
          />
          <OverviewCard
            icon={Users}
            label="待資安複核"
            value={pendingSecurityTasks}
            description="尚待資安團隊確認風險評估結果或補件資訊。"
            tone="warn"
          />
          <OverviewCard
            icon={Wrench}
            label="待架構評估"
            value={pendingArchTasks}
            description="需架構師確認密碼模組清單（CBOM）與遷移可行性。"
            tone="neutral"
          />
        </div>
      </section>

      <GuardrailPanel alerts={guardrailAlerts} defaultOpen={guardrailAlerts.some(a => a.severity === "error")} />
      <DataQualityIssues alerts={guardrailAlerts} />

      {/* 2030 PQC Target Progress */}
      <Card className="border-rose-200 bg-rose-50/30 dark:border-rose-900 dark:bg-rose-950/10">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <span className="text-rose-700 dark:text-rose-400">🎯 2030 PQC 達標進度</span>
            <span className="ml-auto font-mono text-sm font-normal text-muted-foreground">
              距 2030-01-01 還有 <span className="font-semibold text-rose-700">{daysTo2030.toLocaleString()}</span> 天
            </span>
          </CardTitle>
          <CardDescription>NSA CNSA 2.0 全面停用傳統算法截止日 · 以 Wave 計畫估算各系統就緒狀態</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-6 md:grid-cols-2">
            {/* Donut chart */}
            <div>
              <div className="mb-2 text-xs font-medium text-muted-foreground">系統遷移優先波次分布</div>
              <ResponsiveContainer width="100%" height={180}>
                <PieChart>
                  <Pie
                    data={waveChartData}
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={80}
                    paddingAngle={2}
                    dataKey="value"
                    label={({ name, value }) => value > 0 ? `${name}: ${value}` : ""}
                    labelLine={false}
                  >
                    {waveChartData.map((entry, i) => (
                      <Cell key={i} fill={entry.fill} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(v) => [`${v} 系統`]} />
                </PieChart>
              </ResponsiveContainer>
            </div>

            {/* Stats */}
            <div className="flex flex-col justify-center gap-3">
              {waveChartData.map((w) => (
                <div key={w.name} className="flex items-center gap-3">
                  <span className="h-3 w-3 shrink-0 rounded-full" style={{ background: w.fill }} />
                  <span className="flex-1 text-sm">{w.name}</span>
                  <span className="font-semibold">{w.value}</span>
                  <span className="text-xs text-muted-foreground">
                    {w.name === "Wave 1（緊迫）" ? "→ 2027 Q2 前" :
                     w.name === "Wave 2（阻礙）" ? "→ 2028 Q1 前" :
                     w.name === "Wave 3（計畫）" ? "→ 2029 Q2 前" : "→ 持續追蹤"}
                  </span>
                </div>
              ))}
              <div className="mt-2 border-t pt-3">
                <div className="mb-1 flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">估計現況啟動率</span>
                  <span className="font-semibold text-rose-700">{estimatedReadyPct}%</span>
                </div>
                <Progress value={estimatedReadyPct} className="h-2" />
                <p className="mt-1.5 text-xs text-muted-foreground">
                  基於已完成盤點 + Wave 1 系統進度估算，非精確預測。
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="border-primary/20 bg-primary/5">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-primary">
            <TrendingUp className="h-4 w-4" />
            管理摘要 — 本期治理重點
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            <MgmtItem
              label="本期最主要風險"
              value={`${hndlHighRiskSystems} 個 HNDL（長期資料解密風險）高風險系統，含永久保存與長期個資`}
              action="HNDL 分析"
              href="/hndl"
              tone="danger"
            />
            <MgmtItem
              label="需要主管介入"
              value={guardrailAlerts.filter((a) => a.severity === "error").length > 0
                ? `${guardrailAlerts.filter((a) => a.severity === "error").length} 個重大告警：關鍵系統尚未啟動盤點`
                : "目前無重大告警"}
              action="防呆告警"
              href="/"
              tone={guardrailAlerts.filter((a) => a.severity === "error").length > 0 ? "danger" : "ok"}
            />
            <MgmtItem
              label="供應商缺口"
              value={`${vendorsWithoutRoadmap} 家供應商未提供 PQC 遷移計畫`}
              action="供應商準備度"
              href="/vendors"
              tone="warn"
            />
            <MgmtItem
              label="補件壓力"
              value={`${guardrailAlerts.filter((a) => a.severity === "warning").length} 項待補件：外部 API 串接未填、供應商追蹤期限將至`}
              action="防呆告警"
              href="/"
              tone="warn"
            />
            <MgmtItem
              label="跨部門待辦"
              value={`${tasks.filter((t) => t.status !== "completed").length} 件未完成，資安與採購均有高優先項目`}
              action="跨部門待辦"
              href="/tasks"
              tone="warn"
            />
            <MgmtItem
              label="建議下一步"
              value="優先確認 HNDL 高風險系統加密清單（CBOM：密碼資產清單），並向未回覆供應商發出正式詢問"
              action="盤點證據包"
              href="/report"
              tone="ok"
            />
          </div>
        </CardContent>
      </Card>

      <section className="grid gap-4 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>HNDL 優先檢視系統</CardTitle>
            <CardDescription>依示範 HNDL risk score 排序，用於 PQC 前期優先排序。</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>系統</TableHead>
                  <TableHead>保存</TableHead>
                  <TableHead>外部 API</TableHead>
                  <TableHead>HNDL</TableHead>
                  <TableHead>狀態</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {hndlRanking.map((system) => {
                  const topReason = explainRiskForSystem(system, system.vendor ?? null).reasons[0];
                  const expanded = expandedSystemId === system.systemId;
                  return (
                    <Fragment key={system.systemId}>
                      <TableRow
                        className="cursor-pointer"
                        onClick={() => setExpandedSystemId(expanded ? null : system.systemId)}
                      >
                        <TableCell>
                          <div className="font-medium">{system.systemName}</div>
                          <div className="font-mono text-xs text-muted-foreground">{system.systemId}</div>
                          {topReason && <div className="mt-0.5 max-w-56 text-xs text-muted-foreground leading-4 opacity-80">{topReason}</div>}
                          <button
                            type="button"
                            className="mt-1 text-xs font-medium text-primary"
                            onClick={(event) => {
                              event.stopPropagation();
                              setExpandedSystemId(expanded ? null : system.systemId);
                            }}
                          >
                            {expanded ? "收合風險原因" : "查看風險原因"}
                          </button>
                        </TableCell>
                        <TableCell>{formatRetention(system.dataRetentionYears)}</TableCell>
                        <TableCell>{system.hasExternalApi ? "是" : "否"}</TableCell>
                        <TableCell>
                          <div className="flex min-w-24 items-center gap-2">
                            <Progress value={system.hndlRiskScore} />
                            <span className="text-xs font-semibold">{system.hndlRiskScore}</span>
                          </div>
                        </TableCell>
                        <TableCell><StatusBadge status={system.status} /></TableCell>
                      </TableRow>
                      {expanded && (
                        <TableRow>
                          <TableCell colSpan={5}>
                            <SystemRiskExplanationPanel system={system} vendor={system.vendor ?? null} />
                          </TableCell>
                        </TableRow>
                      )}
                    </Fragment>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>供應商 PQC 準備度壓力排序</CardTitle>
            <CardDescription>分數越低，越需要採購、法遵與供應商風險團隊追蹤。</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {vendorReadinessRanking.map((vendor) => (
              <div className="rounded-lg border bg-muted/20 p-3" key={vendor.vendorId}>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="font-medium">{vendor.vendorName}</div>
                    <div className="mt-1 text-xs text-muted-foreground">
                      遷移計畫：{pqcRoadmapLabel[vendor.pqcRoadmapStatus]} / 加密調整能力：{cryptoAgilityLabel[vendor.cryptoAgilityStatus]}
                    </div>
                  </div>
                  <Badge variant={vendor.riskLevel === "critical" || vendor.riskLevel === "high" ? "risk" : "warning"}>
                    {riskLevelLabel[vendor.riskLevel]}
                  </Badge>
                </div>
                <div className="mt-3 flex items-center gap-2">
                  <Progress value={vendor.readinessScore} />
                  <span className="w-8 text-right text-xs font-semibold">{vendor.readinessScore}</span>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </section>

      <RuleExplanationPanel items={riskExplanations} />

      <section className="grid gap-4 xl:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>跨部門待辦分布</CardTitle>
            <CardDescription>依責任角色統計尚未完成的追蹤事項。</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {taskSummary.map((item) => (
              <div className="flex items-center gap-3" key={item.role}>
                <div className="w-24 text-sm text-muted-foreground">{assignedRoleLabel[item.role]}</div>
                <div className="flex-1">
                  <Progress value={item.total ? (item.open / item.total) * 100 : 0} />
                </div>
                <Badge variant={item.open ? "warning" : "success"}>{item.open}/{item.total}</Badge>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>業務關鍵性分布</CardTitle>
            <CardDescription>示範系統的 business criticality。</CardDescription>
          </CardHeader>
          <CardContent className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={riskDistribution} dataKey="value" nameKey="name" innerRadius={48} outerRadius={78} paddingAngle={2}>
                  {riskDistribution.map((entry) => <Cell key={entry.name} fill={entry.fill} />)}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>盤點流程狀態</CardTitle>
            <CardDescription>12 個假系統的 intake workflow 狀態。</CardDescription>
          </CardHeader>
          <CardContent className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={statusDistribution}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
                <Tooltip />
                <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                  {statusDistribution.map((entry) => <Cell key={entry.name} fill={entry.fill} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </section>
    </div>
  );
}

type OverviewTone = "danger" | "warn" | "info" | "neutral";

const overviewToneMap: Record<OverviewTone, {
  border: string; numColor: string; iconBg: string; iconColor: string;
}> = {
  danger:  { border: "border-l-rose-500",   numColor: "text-rose-600",   iconBg: "bg-rose-50",   iconColor: "text-rose-500" },
  warn:    { border: "border-l-amber-400",   numColor: "text-amber-600",  iconBg: "bg-amber-50",  iconColor: "text-amber-500" },
  info:    { border: "border-l-blue-400",    numColor: "text-blue-600",   iconBg: "bg-blue-50",   iconColor: "text-blue-500" },
  neutral: { border: "border-l-slate-400",   numColor: "text-slate-700",  iconBg: "bg-slate-100", iconColor: "text-slate-500" },
};

function OverviewCard({
  icon: Icon, label, value, description, tone,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: number;
  description: string;
  tone: OverviewTone;
}) {
  const t = overviewToneMap[tone];
  return (
    <div className={`rounded-xl border-l-4 bg-background p-4 shadow-sm ${t.border}`}>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="text-xs font-medium text-muted-foreground">{label}</div>
          <div className={`mt-1 text-3xl font-bold tabular-nums leading-none ${t.numColor}`}>{value}</div>
        </div>
        <div className={`rounded-lg p-2 ${t.iconBg}`}>
          <Icon className={`h-5 w-5 ${t.iconColor}`} />
        </div>
      </div>
      <p className="mt-3 text-xs leading-5 text-muted-foreground">{description}</p>
    </div>
  );
}
