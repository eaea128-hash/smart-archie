import {
  AlertTriangle,
  ArrowRight,
  BadgeCheck,
  Building2,
  CheckCircle2,
  ClipboardList,
  DatabaseZap,
  FileSearch,
  FileText,
  GitBranch,
  Globe2,
  Lightbulb,
  Package,
  ShieldAlert,
  ShieldCheck,
  Users,
  Zap,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { loadDemoData } from "@/lib/storage";

export function ExecutiveStoryboard() {
  const { systems, vendors, tasks } = loadDemoData();
  const hndlHigh = systems.filter((s) => s.hndlRiskScore >= 70).length;
  const vendorGap = vendors.filter((v) => v.pqcRoadmapStatus === "未提供").length;
  const pendingTasks = tasks.filter((t) => t.status !== "completed").length;
  const policyImpactSystems = systems.filter((s) => s.hasExternalApi).length;

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Lightbulb className="h-4 w-4" />
          Executive Storyboard
        </div>
        <h2 className="mt-1 text-2xl font-semibold">銀行科技韌性治理 POC：一頁式主管說明</h2>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">
          本頁用一頁說清楚「為什麼現在要做、解決什麼管理痛點、平台如何運作、主管會看到什麼」。
          適合用於主管簡報、概念驗證審查與跨部門溝通。
        </p>
      </div>

      {/* Why Now */}
      <section>
        <SectionLabel icon={Zap} label="Why Now" sublabel="為什麼現在要做" color="rose" />
        <div className="mt-3 grid gap-3 md:grid-cols-3">
          <WhyNowCard
            title="FSC 金融資安韌性發展藍圖"
            body="金管會已將 PQC 遷移準備納入金融資安韌性發展藍圖，銀行需證明已啟動盤點與準備工作。"
            badge="監理壓力"
            badgeVariant="risk"
          />
          <WhyNowCard
            title="新興科技治理議題同步湧現"
            body="PQC、智慧化系統風險、API 安全、供應商科技韌性等議題在同一時間點匯聚，既有 GRC 流程難以快速完成前期盤點與責任分派。"
            badge="治理缺口"
            badgeVariant="warning"
          />
          <WhyNowCard
            title="量子威脅時間窗口有限"
            body="HNDL（Harvest Now, Decrypt Later）威脅已是現在式。攻擊者正在蒐集加密資料，等待量子運算成熟後解密。"
            badge="即時風險"
            badgeVariant="risk"
          />
        </div>
      </section>

      {/* What We Solve */}
      <section>
        <SectionLabel icon={AlertTriangle} label="What We Solve" sublabel="解決什麼管理痛點" color="amber" />
        <div className="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {[
            {
              icon: Users,
              title: "業務、資安、採購、供應商語言不通",
              body: "業務填「保單系統很重要」，資安需要的是「RSA 2048 憑證有效期、是否含外部交換」。現有工具各說各話。",
            },
            {
              icon: FileSearch,
              title: "盤點資料分散且品質不一",
              body: "盤點結果散落在 Excel、Email、SharePoint 各處，無法跨系統比較，也很難即時發現欄位缺漏。",
            },
            {
              icon: ShieldAlert,
              title: "風險判斷缺乏可解釋性",
              body: "「高風險」只是一個標籤，沒有說明為什麼、對應哪條規則、依據哪項政策。主管無法判斷是否合理。",
            },
            {
              icon: GitBranch,
              title: "政策更新後補件困難",
              body: "新監理要求發布後，無法快速找出哪些系統需要補件、補什麼欄位、誰來負責。",
            },
            {
              icon: ClipboardList,
              title: "會議後缺乏證據包與待辦追蹤",
              body: "主管會議討論完就沒有後續。沒有結構化紀錄、補件清單，也無法稽核哪些決議被執行。",
            },
            {
              icon: Building2,
              title: "跨部門責任不清",
              body: "同一個議題，業務、系統 Owner、資安、採購各有一部分責任，但沒有工具讓每個角色看到自己的待辦。",
            },
          ].map((item) => (
            <div className="rounded-lg border bg-muted/20 p-4" key={item.title}>
              <div className="mb-2 flex items-center gap-2 text-sm font-semibold">
                <item.icon className="h-4 w-4 text-amber-600" />
                {item.title}
              </div>
              <p className="text-sm leading-6 text-muted-foreground">{item.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* How It Works */}
      <section>
        <SectionLabel icon={ArrowRight} label="How It Works" sublabel="平台如何運作" color="blue" />
        <div className="mt-3">
          <div className="grid gap-2 md:grid-cols-6">
            {[
              {
                icon: ClipboardList,
                step: "1",
                title: "Intake",
                body: "用業務看得懂的情境式問題收斂系統、資料、外部串接與供應商資訊",
                path: "/pqc-intake",
              },
              {
                icon: ShieldAlert,
                step: "2",
                title: "Rule-based Risk Explanation",
                body: "以明確規則計算風險，每條規則都有編號、原因與政策來源，避免黑箱判斷",
                path: "/hndl",
              },
              {
                icon: AlertTriangle,
                step: "3",
                title: "Guardrails",
                body: "7 條防呆規則偵測缺漏欄位、矛盾標籤，指派到負責角色",
                path: "/",
              },
              {
                icon: Package,
                step: "4",
                title: "Evidence Pack",
                body: "Snapshot + 風險說明 + 防呆 + 政策依據 + 待辦 + 已知限制",
                path: "/report",
              },
              {
                icon: Users,
                step: "5",
                title: "Tasks",
                body: "將業務白話轉成資安、採購、供應商可執行的待辦，並保留觸發原因",
                path: "/tasks",
              },
              {
                icon: GitBranch,
                step: "6",
                title: "Lineage",
                body: "每題、每條規則、每個報告欄位都可追溯政策來源，政策更新後可掃描缺口",
                path: "/lineage",
              },
            ].map((item, index) => (
              <div className="relative rounded-lg border bg-background p-4" key={item.step}>
                <div className="flex items-start gap-2">
                  <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-semibold text-primary-foreground">
                    {item.step}
                  </div>
                  <div>
                    <div className="flex items-center gap-1.5 text-sm font-semibold">
                      <item.icon className="h-3.5 w-3.5 text-primary" />
                      {item.title}
                    </div>
                    <p className="mt-1 text-xs leading-5 text-muted-foreground">{item.body}</p>
                  </div>
                </div>
                {index < 5 && (
                  <ArrowRight className="absolute -right-2 top-1/2 z-10 hidden h-4 w-4 -translate-y-1/2 text-muted-foreground md:block" />
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* What Leaders See */}
      <section>
        <SectionLabel icon={BadgeCheck} label="What Leaders See" sublabel="主管看到什麼" color="emerald" />
        <div className="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          <LeaderCard
            icon={DatabaseZap}
            title="高風險系統清單"
            metric={hndlHigh}
            metricLabel="個 HNDL 高風險系統（示範資料）"
            body="不只是數字，每個系統都顯示為什麼被判定高風險、觸發了哪條規則、需要哪個部門處理。"
            tone="danger"
          />
          <LeaderCard
            icon={Globe2}
            title="HNDL 長期資料風險"
            metric={systems.filter((s) => s.dataRetentionYears >= 10).length}
            metricLabel="個系統資料保存 ≥ 10 年"
            body="攻擊者現在蒐集、未來量子時代解密。長期保存的敏感資料是 PQC 遷移優先對象。"
            tone="danger"
          />
          <LeaderCard
            icon={ShieldCheck}
            title="供應商準備度缺口"
            metric={vendorGap}
            metricLabel="個供應商尚未提供 PQC 遷移計畫"
            body="供應商科技韌性是銀行 PQC 遷移的關鍵瓶頸。本平台顯示每個供應商的準備狀態與追蹤壓力。"
            tone="warn"
          />
          <LeaderCard
            icon={Users}
            title="跨部門待辦壓力"
            metric={pendingTasks}
            metricLabel="件待辦尚未完成（示範資料）"
            body="依業務、系統 Owner、資安、架構、採購、供應商分類，每個角色看到自己的責任範圍。"
            tone="warn"
          />
          <LeaderCard
            icon={AlertTriangle}
            title="政策變更影響"
            metric={policyImpactSystems}
            metricLabel="個系統涉及外部 API 或跨機構交換"
            body="當監理要求新增跨機構 API 串接點明細，平台可找出受影響系統、缺漏欄位、負責角色與報告缺口。"
            tone="warn"
          />
          <LeaderCard
            icon={GitBranch}
            title="合規補件壓力"
            metric={systems.filter((s) => s.status !== "completed").length}
            metricLabel="個系統尚未完成盤點"
            body="政策來源可追溯，政策更新後平台自動掃描受影響系統，產生補件任務並指派負責角色。"
            tone="default"
          />
        </div>
      </section>

      {/* Demo Walkthrough */}
      <section>
        <SectionLabel icon={FileText} label="Demo Walkthrough" sublabel="主管展示路線" color="indigo" />
        <Card className="mt-3">
          <CardContent className="pt-5">
            <div className="space-y-3">
              {[
                {
                  step: "1",
                  page: "Dashboard",
                  path: "/",
                  title: "全行風險總覽",
                  body: "管理摘要、防呆告警、HNDL 優先系統排行、供應商壓力排序、跨部門待辦分布",
                },
                {
                  step: "2",
                  page: "HNDL Analysis",
                  path: "/hndl",
                  title: "長期敏感資料高風險",
                  body: "Harvest Now, Decrypt Later 風險解析，篩選高/中/低風險系統，Drawer 展開觸發規則明細",
                },
                {
                  step: "3",
                  page: "HNDL Analysis → Risk Explanation",
                  path: "/hndl",
                  title: "規則透明，不是黑箱判斷",
                  body: "點開任一高風險系統，展開風險說明：每條規則都有編號、分數與政策來源，全部可追溯",
                },
                {
                  step: "4",
                  page: "Vendor Readiness",
                  path: "/vendors",
                  title: "供應商準備度可複用",
                  body: "同一供應商服務多個系統，準備度回覆一次即可供其他系統引用，降低重複追問成本",
                },
                {
                  step: "5",
                  page: "Cross-functional Tasks",
                  path: "/tasks",
                  title: "跨部門待辦與雙向轉譯",
                  body: "業務白話自動轉成資安、採購、供應商待辦；每筆任務顯示白話說明與技術說明，解決語言不通問題",
                },
                {
                  step: "6",
                  page: "Compliance Lineage",
                  path: "/lineage",
                  title: "政策來源與合規敏捷性",
                  body: "點選政策變更模擬：新監理要求發布 → 掃描受影響系統 → 標示缺口 → 產生補件任務 → 更新報告",
                },
                {
                  step: "7",
                  page: "Evidence Pack",
                  path: "/report",
                  title: "盤點證據包作為會議與追蹤依據",
                  body: "含 Snapshot、業務脈絡、風險依據、防呆告警、政策來源、待辦事項與已知限制，可匯出 JSON / CSV / Markdown / PDF",
                },
              ].map((item) => (
                <div className="flex items-start gap-3 rounded-lg border bg-muted/20 p-3" key={item.step}>
                  <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary text-sm font-semibold text-primary-foreground">
                    {item.step}
                  </div>
                  <div className="flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-semibold">{item.title}</span>
                      <Badge variant="outline" className="font-mono text-xs">{item.page}</Badge>
                    </div>
                    <p className="mt-1 text-sm leading-6 text-muted-foreground">{item.body}</p>
                  </div>
                  <ArrowRight className="mt-1 h-4 w-4 shrink-0 text-muted-foreground" />
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </section>

      {/* Positioning */}
      <Card className="border-primary/30 bg-primary/5">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-primary">
            <CheckCircle2 className="h-4 w-4" />
            本平台定位說明（供展示時使用）
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 md:grid-cols-2">
            <div>
              <div className="mb-2 text-sm font-semibold text-foreground">本平台是</div>
              <ul className="space-y-1.5">
                {[
                  "銀行科技韌性前期盤點平台（POC）",
                  "新興科技風險治理 Intake",
                  "可解釋、可追蹤、可稽核的治理資料流",
                  "第一個場景：PQC / Quantum Readiness",
                  "業務語言與技術要求的雙向轉譯機制",
                  "跨部門責任歸屬與補件追蹤平台",
                ].map((item) => (
                  <li className="flex items-start gap-2 text-sm" key={item}>
                    <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
                    {item}
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <div className="mb-2 text-sm font-semibold text-foreground">本平台不是</div>
              <ul className="space-y-1.5">
                {[
                  "一般填報表單或一次性調查工具",
                  "資安掃描器（不取代弱點掃描或 CBOM）",
                  "CMDB、GRC 或 SIEM 的替代品",
                  "正式的量化風險評估平台（需搭配資安覆核）",
                  "多人協作或稽核系統（示範版，資料存本機）",
                  "連接任何真實公司系統（所有資料均為虛構）",
                ].map((item) => (
                  <li className="flex items-start gap-2 text-sm" key={item}>
                    <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function SectionLabel({
  icon: Icon,
  label,
  sublabel,
  color,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  sublabel: string;
  color: "rose" | "amber" | "blue" | "emerald" | "indigo";
}) {
  const colorMap = {
    rose: "border-rose-200 bg-rose-50 text-rose-800",
    amber: "border-amber-200 bg-amber-50 text-amber-800",
    blue: "border-blue-200 bg-blue-50 text-blue-800",
    emerald: "border-emerald-200 bg-emerald-50 text-emerald-800",
    indigo: "border-indigo-200 bg-indigo-50 text-indigo-800",
  };
  return (
    <div className={cn("inline-flex items-center gap-2 rounded-full border px-3 py-1 text-sm font-semibold", colorMap[color])}>
      <Icon className="h-4 w-4" />
      {label}
      <span className="font-normal opacity-75">— {sublabel}</span>
    </div>
  );
}

function WhyNowCard({
  title,
  body,
  badge,
  badgeVariant,
}: {
  title: string;
  body: string;
  badge: string;
  badgeVariant: "risk" | "warning";
}) {
  return (
    <div className="rounded-lg border bg-background p-4">
      <div className="mb-2 flex items-start justify-between gap-2">
        <div className="text-sm font-semibold leading-5">{title}</div>
        <Badge variant={badgeVariant} className="shrink-0">{badge}</Badge>
      </div>
      <p className="text-sm leading-6 text-muted-foreground">{body}</p>
    </div>
  );
}

function LeaderCard({
  icon: Icon,
  title,
  metric,
  metricLabel,
  body,
  tone,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  metric: number;
  metricLabel: string;
  body: string;
  tone: "danger" | "warn" | "default";
}) {
  const metricColor = tone === "danger" ? "text-rose-600" : tone === "warn" ? "text-amber-600" : "text-primary";
  return (
    <div className="rounded-lg border bg-background p-4">
      <div className="mb-3 flex items-center gap-2 text-sm font-semibold">
        <Icon className={cn("h-4 w-4", metricColor)} />
        {title}
      </div>
      <div className={cn("text-3xl font-semibold tabular-nums", metricColor)}>{metric}</div>
      <div className="mb-3 text-xs text-muted-foreground">{metricLabel}</div>
      <p className="text-sm leading-6 text-muted-foreground">{body}</p>
    </div>
  );
}
