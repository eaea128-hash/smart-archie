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
  ShoppingCart,
  TrendingUp,
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
import { explainRiskForSystem } from "@/lib/risk-rules";

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

  return (
    <div className="space-y-6">
      <Card className="border-primary/20">
        <CardContent className="pt-5">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
            <div>
              <div className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                Bank Resilience Intake Platform / PQC 前期盤點
              </div>
              <h1 className="mt-2 text-2xl font-semibold leading-tight">
                Bank Resilience Intake Platform
              </h1>
              <p className="mt-1 text-base font-medium text-foreground">
                將新興科技風險的分散填報，轉成跨部門可查閱、可追蹤、可稽核的治理資料流
              </p>
              <div className="mt-3 flex flex-wrap gap-x-6 gap-y-1 text-sm text-muted-foreground">
                <span><span className="font-medium text-foreground">風險可視化</span> — 優先檢視哪些系統、哪些供應商</span>
                <span><span className="font-medium text-foreground">風險可解釋</span> — 每筆風險判定均有明確規則依據，避免黑箱推論</span>
                <span><span className="font-medium text-foreground">證據與責任追蹤</span> — 跨部門待辦、補件紀錄、可供稽核的匯出</span>
              </div>
              <p className="mt-2 max-w-3xl text-xs leading-5 text-muted-foreground">
                不取代 CMDB、GRC、SIEM、CBOM 或弱點掃描。本平台協助銀行於前期盤點階段，將業務填答、系統標籤、供應商回覆與政策依據彙整為資安與法遵團隊可用的治理資料。所有示範資料均為虛構。
              </p>
            </div>
            <div className="grid gap-2 sm:grid-cols-3 xl:w-[520px]">
              <SignalCard icon={FileSearch} title="標準化盤點" value={`${systems.length} 系統`} />
              <SignalCard icon={GitBranch} title="可追溯依據" value={`${complianceLineage.length} 條合規軌跡`} />
              <SignalCard icon={ShieldAlert} title="跨部門待辦" value={`${tasks.length} 件`} />
            </div>
          </div>
        </CardContent>
      </Card>

      <GuardrailPanel alerts={guardrailAlerts} defaultOpen={guardrailAlerts.some(a => a.severity === "error")} />
      <DataQualityIssues alerts={guardrailAlerts} />

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard icon={Building2} label="待完成盤點系統" value={pendingSystems} helper={`總計 ${systems.length} 個示範系統`} tone="default" />
        <MetricCard icon={CheckCircle2} label="已完成盤點系統" value={completedSystems} helper="已建立前期盤點紀錄" tone="success" />
        <MetricCard icon={DatabaseZap} label="高 HNDL 風險系統" value={hndlHighRiskSystems} helper="HNDL 分數 >= 80" tone="danger" />
        <MetricCard icon={Clock} label="保存超過 10 年" value={longRetentionSystems} helper="資料生命週期優先檢視" tone="danger" />
        <MetricCard icon={ShieldAlert} label="未提供 PQC 遷移計畫" value={vendorsWithoutRoadmap} helper="供應商待追蹤" tone="warn" />
        <MetricCard icon={Globe2} label="外部 API 系統" value={externalApiSystems} helper="跨機構或供應商介接" tone="warn" />
        <MetricCard icon={AlertTriangle} label="資安待辦" value={pendingSecurityTasks} helper="指派角色：資安" tone="warn" />
        <MetricCard icon={ShoppingCart} label="採購待辦" value={pendingProcurementTasks} helper="指派角色：採購" tone="warn" />
      </section>

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
              value={`${hndlHighRiskSystems} 個高 HNDL 系統，含永久保存與長期個資資料`}
              action="→ 查看 HNDL Analysis"
              href="/hndl"
              tone="danger"
            />
            <MgmtItem
              label="需要主管介入"
              value={guardrailAlerts.filter((a) => a.severity === "error").length > 0
                ? `${guardrailAlerts.filter((a) => a.severity === "error").length} 個 Error 級防呆告警：重大系統尚未啟動盤點`
                : "目前無 Error 級告警"}
              action="→ 查看防呆告警"
              href="/"
              tone={guardrailAlerts.filter((a) => a.severity === "error").length > 0 ? "danger" : "ok"}
            />
            <MgmtItem
              label="供應商缺口"
              value={`${vendorsWithoutRoadmap} 家供應商未提供 PQC 遷移計畫，影響遷移排程估算`}
              action="→ 查看 Vendor Readiness"
              href="/vendors"
              tone="warn"
            />
            <MgmtItem
              label="合規補件壓力"
              value={`${guardrailAlerts.filter((a) => a.severity === "warning").length} 個 Warning 級待補件，含外部 API 串接未填、供應商追蹤期限將至`}
              action="→ 查看防呆告警"
              href="/"
              tone="warn"
            />
            <MgmtItem
              label="跨部門待辦"
              value={`共 ${tasks.filter((t) => t.status !== "completed").length} 件未完成，資安與採購各有高優先待辦`}
              action="→ 查看 Cross-functional Tasks"
              href="/tasks"
              tone="warn"
            />
            <MgmtItem
              label="建議下一步"
              value="優先確認 HNDL 高風險系統的加密依存清單，並向未回覆供應商發出正式詢問函"
              action="→ 查看 Evidence Pack"
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

function SignalCard({ icon: Icon, title, value }: { icon: React.ComponentType<{ className?: string }>; title: string; value: string }) {
  return (
    <div className="rounded-lg border bg-muted/20 p-3">
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <Icon className="h-3.5 w-3.5" />
        {title}
      </div>
      <div className="mt-1 text-sm font-semibold">{value}</div>
    </div>
  );
}
