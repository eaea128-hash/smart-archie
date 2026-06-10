import { useMemo, useState } from "react";
import type { ReactNode } from "react";
import { FilterBar } from "@/components/common/FilterBar";
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  Filter,
  Languages,
  ShieldAlert,
  Users,
  X,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { loadDemoData } from "@/lib/storage";
import type { AssignedRole, System, Vendor } from "@/data/demo-data";
import { assignedRoleLabel, cryptoAgilityLabel, pqcRoadmapLabel } from "@/lib/labels";
import { explainRiskForSystem } from "@/lib/risk-rules";
import { cn } from "@/lib/utils";

type PriorityFilter = "all" | "高" | "中" | "低";
type StatusFilter = "all" | "未開始" | "待補件" | "處理中" | "已完成";
type TranslationDirection = "business_to_security" | "security_to_business" | "vendor_followup" | "quality_guardrail";

interface TranslatedTask {
  taskId: string;
  relatedSystemId: string;
  sourceSystem: string;
  triggerReason: string;
  assignedRole: AssignedRole;
  priority: Exclude<PriorityFilter, "all">;
  status: Exclude<StatusFilter, "all">;
  plainDescription: string;
  technicalDescription: string;
  suggestedAction: string;
  dueDate: string;
  direction: TranslationDirection;
}

interface Guardrail {
  id: string;
  title: string;
  severity: "error" | "warning" | "info";
  relatedSystem: string;
  targetRole: AssignedRole;
  reason: string;
  action: string;
}

const roleFilters: (AssignedRole | "all")[] = ["all", "業務", "系統Owner", "資安", "架構", "採購", "供應商"];
const priorityFilters: PriorityFilter[] = ["all", "高", "中", "低"];
const statusFilters: StatusFilter[] = ["all", "未開始", "待補件", "處理中", "已完成"];

const directionConfig: Record<TranslationDirection, { label: string; className: string }> = {
  business_to_security: { label: "業務 → 資安/架構", className: "border-blue-200 bg-blue-50 text-blue-700" },
  security_to_business: { label: "資安標籤 → 業務/PM", className: "border-violet-200 bg-violet-50 text-violet-700" },
  vendor_followup: { label: "盤點 → 採購/供應商", className: "border-amber-200 bg-amber-50 text-amber-700" },
  quality_guardrail: { label: "防呆品質控管", className: "border-rose-200 bg-rose-50 text-rose-700" },
};

const roleTone: Record<AssignedRole, string> = {
  業務: "bg-blue-100 text-blue-800",
  系統Owner: "bg-purple-100 text-purple-800",
  資安: "bg-rose-100 text-rose-800",
  架構: "bg-indigo-100 text-indigo-800",
  採購: "bg-amber-100 text-amber-800",
  供應商: "bg-slate-100 text-slate-700",
};

export function CrossFunctionalTasks() {
  const { systems, vendors } = loadDemoData();
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState<AssignedRole | "all">("all");
  const [priorityFilter, setPriorityFilter] = useState<PriorityFilter>("all");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [dismissedGuardrails, setDismissedGuardrails] = useState<Set<string>>(new Set());

  const translatedTasks = useMemo(() => buildTranslatedTasks(systems), [systems]);
  const guardrails = useMemo(() => buildGuardrails(systems, vendors).filter((item) => !dismissedGuardrails.has(item.id)), [dismissedGuardrails, systems, vendors]);

  const filteredTasks = useMemo(() => {
    const q = search.trim().toLowerCase();
    return translatedTasks.filter((task) => {
      if (roleFilter !== "all" && task.assignedRole !== roleFilter) return false;
      if (priorityFilter !== "all" && task.priority !== priorityFilter) return false;
      if (statusFilter !== "all" && task.status !== statusFilter) return false;
      if (q && !task.sourceSystem.toLowerCase().includes(q) && !task.plainDescription.toLowerCase().includes(q) && !task.technicalDescription.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [translatedTasks, search, roleFilter, priorityFilter, statusFilter]);

  const highOpen = translatedTasks.filter((task) => task.priority === "高" && task.status !== "已完成").length;
  const waiting = translatedTasks.filter((task) => task.status === "待補件").length;

  return (
    <div className="space-y-6">
      <div>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Languages className="h-4 w-4" />
          跨部門待辦 / 雙向轉譯管控
        </div>
        <h2 className="mt-1 text-2xl font-semibold">跨部門語言轉譯與待辦管控</h2>
        <p className="mt-2 max-w-4xl text-sm leading-6 text-muted-foreground">
          這不是單純任務清單，而是跨部門語言轉譯與盤點品質控管。平台把業務白話轉成資安/架構待確認項目，
          也把 CMDB 與加密技術標籤回補成業務與 PM 能理解的風險提示。
        </p>
      </div>

      <div className="grid gap-3 lg:grid-cols-2">
        <TranslationConcept
          title="業務語言轉資安待確認項目"
          from="業務填寫：保單資料、永久保存、外部醫療院所交換、供應商維護"
          to="系統產出：確認 TLS 版本、外部 API 憑證/簽章、RSA/ECC/HSM、PQC 遷移計畫、加密調整能力"
          className="border-blue-200 bg-blue-50"
        />
        <TranslationConcept
          title="資安技術標籤回補業務風險"
          from="CMDB tags：TLS 1.1、legacy certificate、external API、unknown crypto module"
          to="系統提示：可能使用舊型加密協定，若處理長期敏感資料需補充保存與外部交換情境"
          className="border-violet-200 bg-violet-50"
        />
      </div>

      <div className="grid gap-3 sm:grid-cols-4">
        <Metric value={translatedTasks.length} label="轉譯待辦" helper="含業務、資安、採購與供應商" />
        <Metric value={highOpen} label="高優先未完成" helper="需主管追蹤" tone="risk" />
        <Metric value={waiting} label="待補件" helper="供應商或內部資料缺口" tone="warning" />
        <Metric value={guardrails.length} label="防呆提示" helper="盤點品質控管" tone="warning" />
      </div>

      {guardrails.length > 0 && (
        <section className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="font-semibold">防呆提示</h3>
            <Badge variant="warning">{guardrails.length} 項</Badge>
            <span className="text-xs text-muted-foreground">偵測盤點缺漏、跨部門責任落差與業務/技術矛盾。</span>
          </div>
          <div className="grid gap-2">
            {guardrails.map((guardrail) => (
              <GuardrailBanner
                guardrail={guardrail}
                key={guardrail.id}
                onDismiss={() => setDismissedGuardrails((prev) => new Set([...prev, guardrail.id]))}
              />
            ))}
          </div>
        </section>
      )}

      <Card>
        <CardContent className="space-y-4 pt-5">
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            <Filter className="h-3.5 w-3.5" />
            篩選待辦
          </div>
          <FilterBar
            search={search}
            onSearch={setSearch}
            placeholder="搜尋系統名稱或任務說明…"
            resultCount={filteredTasks.length}
          />
          <FilterGroup label="指派角色">
            {roleFilters.map((role) => (
              <FilterChip key={role} active={roleFilter === role} onClick={() => setRoleFilter(role)}>
                {role === "all" ? "全部角色" : assignedRoleLabel[role]}
              </FilterChip>
            ))}
          </FilterGroup>
          <div className="grid gap-4 md:grid-cols-2">
            <FilterGroup label="優先級">
              {priorityFilters.map((priority) => (
                <FilterChip key={priority} active={priorityFilter === priority} onClick={() => setPriorityFilter(priority)}>
                  {priority === "all" ? "全部" : priority}
                </FilterChip>
              ))}
            </FilterGroup>
            <FilterGroup label="狀態">
              {statusFilters.map((status) => (
                <FilterChip key={status} active={statusFilter === status} onClick={() => setStatusFilter(status)}>
                  {status === "all" ? "全部" : status}
                </FilterChip>
              ))}
            </FilterGroup>
          </div>
        </CardContent>
      </Card>

      <div className="flex items-center justify-between text-sm text-muted-foreground">
        <span>顯示 <strong className="text-foreground">{filteredTasks.length}</strong> 筆待辦</span>
        {(roleFilter !== "all" || priorityFilter !== "all" || statusFilter !== "all") && (
          <Button variant="ghost" onClick={() => { setRoleFilter("all"); setPriorityFilter("all"); setStatusFilter("all"); }}>
            清除篩選
          </Button>
        )}
      </div>

      <div className="grid gap-3">
        {filteredTasks.map((task) => <TaskCard key={task.taskId} task={task} systems={systems} vendors={vendors} />)}
        {filteredTasks.length === 0 && (
          <div className="rounded-lg border border-dashed py-12 text-center text-sm text-muted-foreground">目前沒有符合條件的待辦。</div>
        )}
      </div>
    </div>
  );
}

function TranslationConcept({ title, from, to, className }: { title: string; from: string; to: string; className: string }) {
  return (
    <div className={`rounded-lg border p-4 ${className}`}>
      <div className="mb-3 flex items-center gap-2 font-semibold">
        <ArrowRight className="h-4 w-4" />
        {title}
      </div>
      <div className="space-y-2 text-sm">
        <p className="rounded-md bg-white/60 p-3 text-muted-foreground">{from}</p>
        <p className="rounded-md bg-white/70 p-3 font-medium">{to}</p>
      </div>
    </div>
  );
}

function Metric({ value, label, helper, tone = "default" }: { value: number; label: string; helper: string; tone?: "default" | "risk" | "warning" }) {
  const color = tone === "risk" ? "text-rose-600" : tone === "warning" ? "text-amber-600" : "text-foreground";
  return (
    <div className="rounded-lg border bg-card p-4">
      <div className={`text-3xl font-semibold tabular-nums ${color}`}>{value}</div>
      <div className="mt-1 text-sm font-medium">{label}</div>
      <div className="text-xs text-muted-foreground">{helper}</div>
    </div>
  );
}

function FilterGroup({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <div className="mb-1.5 text-xs text-muted-foreground">{label}</div>
      <div className="flex flex-wrap gap-1.5">{children}</div>
    </div>
  );
}

function FilterChip({ active, onClick, children }: { active: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      className={cn(
        "rounded-full border px-3 py-1 text-xs font-medium transition-colors",
        active ? "border-primary bg-primary text-primary-foreground" : "border-border bg-background hover:bg-muted/60"
      )}
      onClick={onClick}
    >
      {children}
    </button>
  );
}

function GuardrailBanner({ guardrail, onDismiss }: { guardrail: Guardrail; onDismiss: () => void }) {
  const tone = guardrail.severity === "error"
    ? "border-rose-200 bg-rose-50 text-rose-800"
    : guardrail.severity === "warning"
      ? "border-amber-200 bg-amber-50 text-amber-800"
      : "border-blue-200 bg-blue-50 text-blue-800";
  return (
    <div className={`rounded-lg border p-4 ${tone}`}>
      <div className="flex items-start gap-3">
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-semibold">{guardrail.title}</span>
            <span className="font-mono text-xs opacity-70">{guardrail.relatedSystem}</span>
            <span className={`rounded-full px-2 py-0.5 text-xs ${roleTone[guardrail.targetRole]}`}>→ {assignedRoleLabel[guardrail.targetRole]}</span>
          </div>
          <p className="mt-1 text-sm leading-6 opacity-90">{guardrail.reason}</p>
          <p className="mt-2 rounded-md bg-white/60 p-2 text-sm font-medium">{guardrail.action}</p>
        </div>
        <button className="rounded-md p-1 hover:bg-black/10" onClick={onDismiss} aria-label="Dismiss guardrail">
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

function TaskCard({ task, systems, vendors }: { task: TranslatedTask; systems: System[]; vendors: Vendor[] }) {
  const direction = directionConfig[task.direction];
  const vendorById = new Map(vendors.map((vendor) => [vendor.vendorId, vendor]));
  const sourceSystem = systems.find((system) => system.systemId === task.relatedSystemId);
  const sourceVendor = sourceSystem?.vendorId ? vendorById.get(sourceSystem.vendorId) : undefined;
  const riskExplanation = sourceSystem ? explainRiskForSystem(sourceSystem, sourceVendor ?? null) : null;
  const triggeredRules = riskExplanation?.triggeredRules.slice(0, 3) ?? [];
  return (
    <Card>
      <CardContent className="space-y-4 pt-5">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant={task.priority === "高" ? "risk" : task.priority === "中" ? "warning" : "secondary"}>{task.priority}優先</Badge>
          <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${roleTone[task.assignedRole]}`}>{assignedRoleLabel[task.assignedRole]}</span>
          <Badge variant={task.status === "已完成" ? "success" : task.status === "待補件" ? "warning" : "outline"}>{task.status}</Badge>
          <span className={`rounded-full border px-2 py-0.5 text-xs font-medium ${direction.className}`}>{direction.label}</span>
          <span className="ml-auto text-xs text-muted-foreground">到期日：{task.dueDate}</span>
        </div>

        <div>
          <h3 className="font-semibold">{task.sourceSystem}</h3>
          <div className="mt-1 font-mono text-xs text-muted-foreground">{task.relatedSystemId}</div>
        </div>

        <div className="rounded-md border bg-muted/20 p-3 text-sm text-muted-foreground">
          <strong className="text-foreground">觸發原因：</strong>{task.triggerReason}
        </div>

        <div className="rounded-lg border bg-background p-3">
          <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">觸發來源</div>
          {triggeredRules.length > 0 ? (
            <div className="space-y-2">
              {triggeredRules.map(({ rule, message }) => (
                <div className="rounded-md border bg-muted/20 px-3 py-2 text-xs leading-5" key={rule.ruleId}>
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="outline">{rule.ruleId}</Badge>
                    <span className="font-medium">{rule.name}</span>
                    <Badge variant="secondary">{rule.policySource}</Badge>
                  </div>
                  <p className="mt-1 text-muted-foreground">{message}</p>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              此待辦由雙向轉譯規則產生；尚未觸發主要風險評分規則，仍需由負責角色補件確認。
            </p>
          )}
        </div>

        <div className="grid gap-3 lg:grid-cols-2">
          <div className="rounded-lg border border-blue-100 bg-blue-50/50 p-3">
            <div className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold text-blue-700">
              <Users className="h-3.5 w-3.5" />
              白話說明
            </div>
            <p className="text-sm leading-6">{task.plainDescription}</p>
          </div>
          <div className="rounded-lg border border-slate-200 bg-slate-50/80 p-3">
            <div className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold text-slate-700">
              <ShieldAlert className="h-3.5 w-3.5" />
              技術說明
            </div>
            <p className="text-sm leading-6">{task.technicalDescription}</p>
          </div>
        </div>

        <div className="flex items-start gap-2 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm">
          <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
          <div>
            <strong className="text-emerald-700">建議動作：</strong>
            <span className="text-foreground/80"> {task.suggestedAction}</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function buildTranslatedTasks(systems: System[]): TranslatedTask[] {
  const taskRows: TranslatedTask[] = [];
  const byId = new Map(systems.map((system) => [system.systemId, system]));

  const policyClaims = byId.get("SYS-002")!;
  taskRows.push({
    taskId: "TR-BIZ-001",
    relatedSystemId: policyClaims.systemId,
    sourceSystem: policyClaims.systemName,
    triggerReason: "業務填寫：系統處理保單資料、保存年限為永久、有外部醫療院所資料交換、由外部供應商維護。",
    assignedRole: "資安",
    priority: "高",
    status: "處理中",
    plainDescription: "此系統保存保單、理賠、醫療附件與受益人資料，資料保存期很長，且會透過外部交換取得醫療相關資料。",
    technicalDescription: "請確認 TLS 是否為 1.2 以上、外部 API 或檔案交換是否使用憑證或簽章、是否涉及 RSA / ECC / HSM / XML signature。",
    suggestedAction: "資安與架構共同產出加密技術清單，並把供應商 PQC 遷移計畫與加密調整能力證據列為必填。",
    dueDate: "2026-06-30",
    direction: "business_to_security",
  });

  const wealth = byId.get("SYS-003")!;
  taskRows.push({
    taskId: "TR-TECH-001",
    relatedSystemId: wealth.systemId,
    sourceSystem: wealth.systemName,
    triggerReason: "CMDB / crypto signals 顯示 ECC certificate、JWT RS256，且系統含高資產客戶交易摘要。",
    assignedRole: "業務",
    priority: "中",
    status: "未開始",
    plainDescription: "此系統可能依賴未來需替換的憑證或簽章演算法。若資料保存超過量子威脅時間窗，業務需重新確認資料價值與保存必要性。",
    technicalDescription: "ECC certificate 與 JWT RS256 都屬於需納入 PQC 遷移盤點的密碼相依性；需確認是否有客戶交易或監理申報流程。",
    suggestedAction: "業務補充資料保存依據、外部合作方與交易流程重要性，供資安調整 HNDL 優先排序。",
    dueDate: "2026-07-15",
    direction: "security_to_business",
  });

  const credit = byId.get("SYS-005")!;
  taskRows.push({
    taskId: "TR-TECH-002",
    relatedSystemId: credit.systemId,
    sourceSystem: credit.systemName,
    triggerReason: "CMDB tags 顯示 unknown crypto module、legacy certificate 與 external API。",
    assignedRole: "系統Owner",
    priority: "高",
    status: "待補件",
    plainDescription: "系統使用的加密模組與舊憑證來源不明，且會與外部信用資料交換中心介接，盤點資料不足會導致風險低估。",
    technicalDescription: "需確認 mTLS 憑證演算法、CA 來源、legacy certificate 是否仍在服務中，以及 unknown crypto module 的責任歸屬。",
    suggestedAction: "系統Owner 補上加密模組清單與外部介接責任歸屬，資安再判斷是否升級為高風險。",
    dueDate: "2026-07-08",
    direction: "security_to_business",
  });

  const corporate = byId.get("SYS-007")!;
  taskRows.push({
    taskId: "TR-VND-001",
    relatedSystemId: corporate.systemId,
    sourceSystem: corporate.systemName,
    triggerReason: "供應商 EnterpriseBanking Corp 已部分提供 PQC 遷移計畫，但 PKI 遷移證據尚未完整。",
    assignedRole: "架構",
    priority: "高",
    status: "處理中",
    plainDescription: "企業網銀是核心企業交易通道，供應商已提供一部分準備度回覆，但仍需確認本系統特定 PKI 與簽核流程。",
    technicalDescription: "需確認 PKI signing、RSA-2048、mTLS 是否支援 hybrid mode，並確認憑證換發、測試窗口與 rollback plan。",
    suggestedAction: "架構團隊建立系統特定加密依賴清單，並把可重複引用的供應商欄位同步到供應商準備度頁。",
    dueDate: "2026-06-28",
    direction: "business_to_security",
  });

  const medical = byId.get("SYS-011")!;
  taskRows.push({
    taskId: "TR-VND-002",
    relatedSystemId: medical.systemId,
    sourceSystem: medical.systemName,
    triggerReason: "供應商 MediClaim Exchange Ltd 未提供 PQC 遷移計畫，且加密調整能力狀態為不支援。",
    assignedRole: "採購",
    priority: "高",
    status: "待補件",
    plainDescription: "醫療理賠資料具有長期價值且涉及外部醫療院所交換，如果供應商無法提供遷移計畫，系統後續遷移會被卡住。",
    technicalDescription: "XML signature、mTLS、RSA certificate 需確認可替換性；供應商需提出遷移計畫、支援演算法與升級時程。",
    suggestedAction: "採購發函要求供應商在 2026-07-15 前補件；逾期升級為替代供應商評估。",
    dueDate: "2026-06-25",
    direction: "vendor_followup",
  });

  const documentExchange = byId.get("SYS-012")!;
  taskRows.push({
    taskId: "TR-GUARD-001",
    relatedSystemId: documentExchange.systemId,
    sourceSystem: documentExchange.systemName,
    triggerReason: "CMDB tag 顯示 legacy certificate 與 TLS 1.1，但業務重要性標示為低。",
    assignedRole: "系統Owner",
    priority: "中",
    status: "未開始",
    plainDescription: "雖然業務認為此平台風險低，但文件交換與電子簽章若使用舊憑證，仍可能成為 PQC 遷移缺口。",
    technicalDescription: "TLS 1.1 與 legacy certificate 需升級或確認退場時程；若簽章使用 RSA/ECDSA，也需納入後量子簽章遷移評估。",
    suggestedAction: "系統Owner 補充電子簽章演算法清單；資安確認是否調整風險等級。",
    dueDate: "2026-08-15",
    direction: "quality_guardrail",
  });

  return taskRows;
}

function buildGuardrails(systems: System[], vendors: Vendor[]): Guardrail[] {
  const rows: Guardrail[] = [
    {
      id: "G-001",
      title: "敏感資料保存年限必填",
      severity: "error",
      relatedSystem: "盤點草稿 / 保單理賠系統",
      targetRole: "業務",
      reason: "資料類型包含保單與醫療資料時，保存年限不可空白。若保存年限未知，HNDL 風險會被低估。",
      action: "請業務補填保存年限；若為永久保存，系統將自動提高 HNDL 優先級。",
    },
    {
      id: "G-002",
      title: "外部 API 需填外部對象",
      severity: "warning",
      relatedSystem: "盤點草稿 / 外部 API 欄位",
      targetRole: "系統Owner",
      reason: "若 hasExternalApi = true 但 externalParties 空白，資安無法判斷傳輸路徑、憑證責任與供應商依賴。",
      action: "請補上外部機構、供應商或 API 對象名稱，並標示資料交換格式。",
    },
  ];

  vendors
    .filter((vendor) => vendor.pqcRoadmapStatus === "未提供")
    .forEach((vendor) => {
      rows.push({
        id: `G-VENDOR-${vendor.vendorId}`,
        title: "供應商未提供 PQC 遷移計畫",
        severity: "error",
        relatedSystem: vendor.vendorName,
        targetRole: "採購",
        reason: `${vendor.vendorName} 尚未提供 PQC 遷移計畫，影響 ${vendor.relatedSystemCount} 個關聯系統。`,
        action: "請採購與供應商補件，要求遷移計畫、支援演算法、升級時程與合約升級責任。",
      });
    });

  systems
    .filter((system) => system.businessCriticality === "low" && [...system.cmdbTags, ...system.cryptoSignals].some((item) => item.toLowerCase().includes("legacy") || item.includes("TLS 1.1")))
    .forEach((system) => {
      rows.push({
        id: `G-LEGACY-${system.systemId}`,
        title: "低風險填報與舊型加密標籤矛盾",
        severity: "warning",
        relatedSystem: `${system.systemId} / ${system.systemName}`,
        targetRole: "系統Owner",
        reason: "CMDB 或 crypto signals 顯示舊憑證 / TLS 1.1，但業務重要性標示為低，可能低估 PQC 遷移風險。",
        action: "請系統Owner 補充實際使用情境，資安確認是否調整為中風險或納入補件清單。",
      });
    });

  return rows;
}
