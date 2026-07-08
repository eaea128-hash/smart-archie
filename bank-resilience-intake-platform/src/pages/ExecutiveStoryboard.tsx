import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  ClipboardList,
  DatabaseZap,
  FileText,
  GitBranch,
  ShieldCheck,
  Users,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { loadDemoData } from "@/lib/storage";
import { cn } from "@/lib/utils";

const capabilities = [
  {
    name: "風險可視化",
    owner: "主管 / 資安",
    input: "系統、資料保存年限、外部串接",
    output: "高風險系統排行與待處理清單",
    status: "已建立",
  },
  {
    name: "風險可解釋",
    owner: "資安 / 架構",
    input: "11 條規則與政策來源",
    output: "觸發原因、分數、治理依據",
    status: "已建立",
  },
  {
    name: "供應商準備度",
    owner: "採購 / 系統Owner",
    input: "PQC 遷移計畫、加密調整能力",
    output: "供應商缺口與可複用回覆",
    status: "已建立",
  },
  {
    name: "證據與責任追蹤",
    owner: "PMO / 稽核窗口",
    input: "防呆告警、待辦、治理依據",
    output: "盤點證據包與補件進度",
    status: "已建立",
  },
];

const operatingFlow = [
  ["1", "Intake（前期盤點）", "業務與系統 Owner 補齊系統、資料、外部串接與供應商欄位"],
  ["2", "Rules（規則判斷）", "依明確規則產生風險分數、觸發原因與治理依據"],
  ["3", "Guardrails（資料防呆）", "偵測缺漏、矛盾與供應商補件壓力"],
  ["4", "Tasks（責任追蹤）", "轉成業務、資安、架構、採購、供應商待辦"],
  ["5", "Evidence Pack（盤點證據包）", "輸出會議附件、治理追蹤與後續覆核材料"],
];

export function ExecutiveStoryboard() {
  const { systems, vendors, tasks } = loadDemoData();
  const hndlHigh = systems.filter((s) => s.hndlRiskScore >= 70).length;
  const vendorGap = vendors.filter((v) => v.pqcRoadmapStatus === "未提供").length;
  const pendingTasks = tasks.filter((t) => t.status !== "completed").length;
  const externalApiSystems = systems.filter((s) => s.hasExternalApi).length;

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <ShieldCheck className="h-4 w-4" />
            平台總覽
          </div>
          <h2 className="mt-1 text-2xl font-semibold">PQC Governance Intake Platform</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            將 PQC 前期盤點轉成可查閱、可追蹤、可稽核的治理資料流。
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => { window.location.href = "/"; }}>查看儀表板</Button>
          <Button onClick={() => { window.location.href = "/report"; }}>開啟證據包</Button>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard icon={DatabaseZap} label="HNDL（長期資料解密風險）" value={hndlHigh} helper="高風險系統" tone="danger" />
        <KpiCard icon={ShieldCheck} label="供應商準備度缺口" value={vendorGap} helper="未提供 PQC 遷移計畫" tone="warn" />
        <KpiCard icon={Users} label="跨部門待辦" value={pendingTasks} helper="尚未完成" tone="warn" />
        <KpiCard icon={GitBranch} label="外部串接系統" value={externalApiSystems} helper="需追蹤 API 明細" />
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.15fr_0.85fr]">
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">管理能力清單</CardTitle>
              <Badge variant="secondary">POC Ready</Badge>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>能力</TableHead>
                  <TableHead>負責單位</TableHead>
                  <TableHead>輸入資料</TableHead>
                  <TableHead>輸出</TableHead>
                  <TableHead>狀態</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {capabilities.map((item) => (
                  <TableRow key={item.name}>
                    <TableCell className="font-medium">{item.name}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{item.owner}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{item.input}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{item.output}</TableCell>
                    <TableCell><Badge variant="success">{item.status}</Badge></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">作業流程</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {operatingFlow.map(([step, title, desc]) => (
              <div key={step} className="flex gap-3 rounded-lg border bg-muted/20 p-3">
                <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-semibold text-primary-foreground">
                  {step}
                </div>
                <div>
                  <div className="text-sm font-medium">{title}</div>
                  <div className="mt-0.5 text-xs leading-5 text-muted-foreground">{desc}</div>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">主管可立即追蹤事項</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-3">
          <ActionItem
            icon={AlertTriangle}
            title="優先處理長期敏感資料"
            desc="房貸、保單、醫療與授信資料保存年限長，需優先確認 HNDL 風險。"
            tone="danger"
          />
          <ActionItem
            icon={ClipboardList}
            title="追蹤供應商補件"
            desc="供應商未提供 PQC 遷移計畫時，採購與系統 Owner 需共同追蹤。"
            tone="warn"
          />
          <ActionItem
            icon={FileText}
            title="固定會議證據"
            desc="Evidence Pack（盤點證據包）保留規則版本、資料版本與完整性指紋。"
            tone="ok"
          />
        </CardContent>
      </Card>
    </div>
  );
}

function KpiCard({
  icon: Icon,
  label,
  value,
  helper,
  tone = "default",
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: number;
  helper: string;
  tone?: "danger" | "warn" | "default";
}) {
  const color = tone === "danger" ? "text-rose-600" : tone === "warn" ? "text-amber-600" : "text-primary";
  return (
    <Card>
      <CardContent className="flex items-center gap-3 p-4">
        <div className="flex h-10 w-10 items-center justify-center rounded-md bg-muted">
          <Icon className={cn("h-5 w-5", color)} />
        </div>
        <div>
          <div className="text-xs text-muted-foreground">{label}</div>
          <div className={cn("mt-0.5 text-2xl font-semibold tabular-nums", color)}>{value}</div>
          <div className="text-xs text-muted-foreground">{helper}</div>
        </div>
      </CardContent>
    </Card>
  );
}

function ActionItem({
  icon: Icon,
  title,
  desc,
  tone,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  desc: string;
  tone: "danger" | "warn" | "ok";
}) {
  const color = tone === "danger" ? "text-rose-600" : tone === "warn" ? "text-amber-600" : "text-emerald-600";
  return (
    <div className="rounded-lg border bg-background p-3">
      <div className="flex items-center gap-2">
        <Icon className={cn("h-4 w-4", color)} />
        <div className="text-sm font-medium">{title}</div>
      </div>
      <div className="mt-2 flex items-start gap-2 text-xs leading-5 text-muted-foreground">
        <ArrowRight className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />
        {desc}
      </div>
    </div>
  );
}
