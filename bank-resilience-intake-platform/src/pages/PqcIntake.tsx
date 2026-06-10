import { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  AlertTriangle, ArrowLeft, ArrowRight, Building2, CheckCircle2,
  ChevronDown, ChevronUp, ClipboardList, HelpCircle, Info,
  Lock, Send, ShieldCheck, Zap,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { saveIntakeSubmission } from "@/lib/storage";
import { generateIntakeTasks } from "@/rules/taskGenerationRules";
import { cn } from "@/lib/utils";

// ─── Types ─────────────────────────────────────────────────────────────────────

interface IntakeForm {
  // S1 – System & Business
  systemName: string;
  businessUnit: string;
  systemOwner: string;
  systemType: string;
  businessCriticality: "" | "critical" | "high" | "medium" | "low";
  affectsCustomerTx: boolean | null;
  involvesRegulatory: boolean | null;

  // S2 – Data Lifecycle
  dataRetentionYears: string;
  hasPersonalData: boolean | null;
  sensitiveDataTypes: string[];
  dataStillSensitiveAt10yr: boolean | null;
  leakageCausesHarm: boolean | null;

  // S3 – External Connections
  hasExternalExchange: boolean | null;
  externalPartyTypes: string[];
  hasBatchFile: boolean | null;
  hasRealtimeApi: boolean | null;
  hasCrossBorder: boolean | null;

  // S4 – Crypto Context
  usesHttps: boolean | null;
  hasDigitalSig: boolean | null;
  hasHsm: boolean | null;
  vendorProvidesEncryption: boolean | null;
  hasApiCertOrToken: boolean | null;

  // S5 – Vendor & Contract
  hasVendor: boolean | null;
  vendorName: string;
  contractActive: boolean | null;
  contractExpiry: string;
  contractHasSecurityClause: boolean | null;
  vendorHasRoadmap: boolean | null;
  vendorCryptoAgility: boolean | null;

  // S6 – Notes
  businessNotes: string;
  techNotes: string;
  knownRisks: string;
  securityRequests: string;
}

interface GeneratedTask {
  role: string;
  priority: "P1" | "P2" | "P3";
  title: string;
  reason: string;
}

interface IntakeValidationIssue {
  issueId: string;
  severity: "error" | "warning";
  title: string;
  message: string;
  suggestedAction: string;
}

const EMPTY: IntakeForm = {
  systemName:"", businessUnit:"", systemOwner:"", systemType:"",
  businessCriticality:"", affectsCustomerTx:null, involvesRegulatory:null,
  dataRetentionYears:"", hasPersonalData:null, sensitiveDataTypes:[],
  dataStillSensitiveAt10yr:null, leakageCausesHarm:null,
  hasExternalExchange:null, externalPartyTypes:[], hasBatchFile:null,
  hasRealtimeApi:null, hasCrossBorder:null,
  usesHttps:null, hasDigitalSig:null, hasHsm:null,
  vendorProvidesEncryption:null, hasApiCertOrToken:null,
  hasVendor:null, vendorName:"", contractActive:null, contractExpiry:"",
  contractHasSecurityClause:null, vendorHasRoadmap:null, vendorCryptoAgility:null,
  businessNotes:"", techNotes:"", knownRisks:"", securityRequests:"",
};

// ─── Scoring ───────────────────────────────────────────────────────────────────

function calcHndlScore(f: IntakeForm): number {
  let score = 0;
  const yr = parseInt(f.dataRetentionYears || "0", 10);

  // Retention (max 30)
  if (yr >= 20) score += 30;
  else if (yr >= 10) score += 25;
  else if (yr >= 5) score += 15;
  else if (yr > 0) score += 5;

  // Sensitive data types (max 25)
  score += Math.min(25, f.sensitiveDataTypes.length * 5);
  if (f.hasPersonalData) score += 4;

  // Long-term sensitivity + harm (max 10)
  if (f.dataStillSensitiveAt10yr) score += 5;
  if (f.leakageCausesHarm) score += 5;

  // External exposure (max 20)
  if (f.hasRealtimeApi) score += 12;
  if (f.hasBatchFile) score += 6;
  if (f.hasCrossBorder) score += 8;
  if (f.hasExternalExchange) score += 3;

  // Crypto signals (max 12)
  if (f.hasDigitalSig) score += 4;
  if (f.hasApiCertOrToken) score += 4;
  if (f.vendorProvidesEncryption) score += 6; // vendor-controlled = harder to migrate
  if (f.hasHsm === false) score += 2; // no HSM = weaker key protection

  // Criticality multiplier
  if (f.businessCriticality === "critical") score = Math.round(score * 1.15);
  else if (f.businessCriticality === "high") score = Math.round(score * 1.05);

  // Regulatory + customer-facing
  if (f.involvesRegulatory) score += 4;
  if (f.affectsCustomerTx) score += 3;

  return Math.min(100, score);
}

function scoreLabel(s: number): { label: string; cls: string; badgeVariant: "risk"|"warning"|"success"|"outline" } {
  if (s >= 80) return { label:"極高風險", cls:"text-rose-600",   badgeVariant:"risk" };
  if (s >= 60) return { label:"高風險",   cls:"text-orange-500", badgeVariant:"risk" };
  if (s >= 40) return { label:"中風險",   cls:"text-amber-500",  badgeVariant:"warning" };
  return              { label:"低風險",   cls:"text-emerald-600",badgeVariant:"success" };
}

const LONG_TERM_SENSITIVE_TYPES = ["保單資料", "授信資料", "醫療資料", "財務資料", "交易資料"];

function validateIntakeForm(f: IntakeForm): IntakeValidationIssue[] {
  const issues: IntakeValidationIssue[] = [];
  const hasLongTermSensitiveData = f.sensitiveDataTypes.some((type) =>
    LONG_TERM_SENSITIVE_TYPES.some((keyword) => type.includes(keyword.replace("資料", "")) || type.includes(keyword))
  );

  if (hasLongTermSensitiveData && !f.dataRetentionYears.trim()) {
    issues.push({
      issueId: "VAL-HNDL-RETENTION",
      severity: "error",
      title: "缺少資料保存年限",
      message: "此系統包含長期敏感資料，請補充資料保存年限，以利評估 HNDL 風險。",
      suggestedAction: "回到「資料生命週期與敏感度」區塊，填寫保存年限；若永久保存，請填 999。",
    });
  }

  if ((f.hasExternalExchange || f.hasRealtimeApi || f.hasBatchFile) && f.externalPartyTypes.length === 0) {
    issues.push({
      issueId: "VAL-EXT-PARTIES",
      severity: "warning",
      title: "外部串接對象未填",
      message: "此系統涉及外部串接，請補充外部對象，例如財金、聯徵、保險公司、醫療院所、政府機關或第三方 API。",
      suggestedAction: "回到「外部串接與資料交換」區塊，選擇外部對象類型。",
    });
  }

  if (f.hasVendor && !f.vendorHasRoadmap) {
    issues.push({
      issueId: "VAL-VENDOR-ROADMAP",
      severity: "warning",
      title: "供應商 PQC 遷移計畫未提供或未確認",
      message: "供應商尚未提供 PQC 遷移計畫，需確認其後量子密碼支援能力與升級時程。",
      suggestedAction: "送出後將自動產生採購待辦與供應商待辦。",
    });
  }

  if (f.hasVendor && isWithinMonths(f.contractExpiry, 6)) {
    issues.push({
      issueId: "VAL-CONTRACT-EXPIRY",
      severity: "warning",
      title: "供應商合約即將到期",
      message: "供應商合約即將到期，建議於續約或新約中納入 PQC 遷移計畫、加密調整能力與資安升級責任條款。",
      suggestedAction: "送出後將自動產生採購優先確認事項。",
    });
  }

  if ((f.hasExternalExchange || f.hasRealtimeApi || f.hasBatchFile) &&
      f.usesHttps === null && f.hasDigitalSig === null && f.hasApiCertOrToken === null) {
    issues.push({
      issueId: "VAL-EXT-CRYPTO",
      severity: "warning",
      title: "外部交換加密情境未確認",
      message: "若系統涉及跨機構資料交換，但未填是否有憑證、簽章、API token 或加密傳輸，需提示資安待確認。",
      suggestedAction: "回到「加密使用情境初步盤點」區塊補充；若不確定，可送出後由資安確認。",
    });
  }

  return issues;
}

function isWithinMonths(dateStr: string, months: number): boolean {
  if (!dateStr) return false;
  const target = new Date(dateStr);
  if (Number.isNaN(target.getTime())) return false;
  const threshold = new Date();
  threshold.setMonth(threshold.getMonth() + months);
  return target > new Date() && target <= threshold;
}

// ─── Reusable field components ────────────────────────────────────────────────

interface TooltipDef {
  why: string;
  risk: string;
  field?: string;
}

function FieldTooltip({ tip }: { tip: TooltipDef }) {
  const [open, setOpen] = useState(false);
  return (
    <span className="relative inline-block">
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        className="ml-1.5 inline-flex h-4 w-4 items-center justify-center rounded-full border border-border bg-muted text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors">
        <HelpCircle className="h-2.5 w-2.5" />
      </button>
      {open && (
        <div className="absolute left-6 top-0 z-50 w-64 rounded-lg border bg-popover p-3 shadow-lg text-xs">
          <div className="flex items-start justify-between gap-2 mb-2">
            <span className="font-semibold text-foreground">為什麼要問</span>
            <button type="button" onClick={() => setOpen(false)} className="text-muted-foreground hover:text-foreground">✕</button>
          </div>
          <p className="mb-2 text-muted-foreground leading-relaxed">{tip.why}</p>
          <div className="rounded-md bg-amber-50 border border-amber-200 px-2 py-1.5 mb-1.5">
            <span className="font-semibold text-amber-700">影響風險：</span>
            <span className="text-amber-700">{tip.risk}</span>
          </div>
          {tip.field && (
            <div className="rounded-md bg-slate-50 border border-slate-200 px-2 py-1.5">
              <span className="font-semibold text-slate-600">對應欄位：</span>
              <code className="text-slate-600">{tip.field}</code>
            </div>
          )}
        </div>
      )}
    </span>
  );
}

function FieldLabel({ label, required, tip }: { label: string; required?: boolean; tip?: TooltipDef }) {
  return (
    <div className="flex items-center gap-0.5 mb-1.5">
      <label className="text-sm font-medium">{label}</label>
      {required && <span className="ml-0.5 text-rose-500">*</span>}
      {tip && <FieldTooltip tip={tip} />}
    </div>
  );
}

function YesNoField({
  value, onChange, labels = ["是", "否", "不確定"], allowUnsure = true,
}: {
  value: boolean | null;
  onChange: (v: boolean | null) => void;
  labels?: [string, string, string];
  allowUnsure?: boolean;
}) {
  const opts: { v: boolean | null; label: string }[] = [
    { v: true, label: labels[0] },
    { v: false, label: labels[1] },
    ...(allowUnsure ? [{ v: null, label: labels[2] }] : []),
  ];
  return (
    <div className="flex flex-wrap gap-2">
      {opts.map(({ v, label }) => (
        <button
          key={String(v)}
          type="button"
          onClick={() => onChange(v)}
          className={cn(
            "rounded-full border px-4 py-1.5 text-sm font-medium transition-colors",
            value === v
              ? "border-primary bg-primary text-primary-foreground"
              : "border-border bg-background text-foreground hover:bg-muted",
          )}>
          {label}
        </button>
      ))}
    </div>
  );
}

function MultiCheckField({
  options, value, onChange,
}: {
  options: string[];
  value: string[];
  onChange: (v: string[]) => void;
}) {
  const toggle = (opt: string) =>
    onChange(value.includes(opt) ? value.filter(x => x !== opt) : [...value, opt]);
  return (
    <div className="flex flex-wrap gap-2">
      {options.map(opt => (
        <button
          key={opt}
          type="button"
          onClick={() => toggle(opt)}
          className={cn(
            "rounded-full border px-3 py-1 text-sm transition-colors",
            value.includes(opt)
              ? "border-primary bg-primary/10 text-primary font-medium"
              : "border-border bg-background text-muted-foreground hover:bg-muted",
          )}>
          {value.includes(opt) && <span className="mr-1">✓</span>}
          {opt}
        </button>
      ))}
    </div>
  );
}

function TextInput({
  value, onChange, placeholder, className,
}: {
  value: string; onChange: (v: string) => void; placeholder?: string; className?: string;
}) {
  return (
    <input
      type="text"
      value={value}
      onChange={e => onChange(e.target.value)}
      placeholder={placeholder}
      className={cn(
        "w-full rounded-md border bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40",
        className,
      )}
    />
  );
}

function NumberInput({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <input
      type="number"
      min={0}
      value={value}
      onChange={e => onChange(e.target.value)}
      placeholder={placeholder}
      className="w-32 rounded-md border bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
    />
  );
}

function TextAreaInput({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <textarea
      rows={3}
      value={value}
      onChange={e => onChange(e.target.value)}
      placeholder={placeholder}
      className="w-full rounded-md border bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 resize-none"
    />
  );
}

function SelectField({ value, onChange, options }: { value: string; onChange: (v: string) => void; options: { value: string; label: string }[] }) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map(opt => (
        <button key={opt.value} type="button" onClick={() => onChange(opt.value)}
          className={cn(
            "rounded-lg border px-3 py-2 text-sm text-left transition-colors",
            value === opt.value
              ? "border-primary bg-primary/10 text-primary font-medium"
              : "border-border bg-background text-muted-foreground hover:bg-muted",
          )}>
          {opt.label}
        </button>
      ))}
    </div>
  );
}

// ─── Section components ───────────────────────────────────────────────────────

function Section1({ f, set }: { f: IntakeForm; set: (patch: Partial<IntakeForm>) => void }) {
  return (
    <div className="space-y-5">
      <div>
        <FieldLabel label="系統名稱" required
          tip={{ why:"用來識別本次盤點的目標系統，後續所有任務與報告都會連結到這個名稱。", risk:"若未填寫，無法建立系統與任務的追溯關係。", field:"System.systemName" }} />
        <TextInput value={f.systemName} onChange={v => set({ systemName:v })} placeholder="例：房貸授信系統、企業網銀平台…" />
      </div>
      <div className="grid gap-5 sm:grid-cols-2">
        <div>
          <FieldLabel label="所屬單位"
            tip={{ why:"不同單位的系統可能面對不同的法規要求與資料敏感程度，資安會依此調整審查優先級。", risk:"所屬單位影響監理申報義務與資料分類。", field:"System.businessUnit" }} />
          <TextInput value={f.businessUnit} onChange={v => set({ businessUnit:v })} placeholder="例：個人金融事業群、企金業務部…" />
        </div>
        <div>
          <FieldLabel label="系統負責人"
            tip={{ why:"作為本次盤點的主要聯絡窗口，後續補件任務將主要指派給此人。", risk:"無負責人會導致任務無人承接，影響遷移計畫推進。", field:"System.owner" }} />
          <TextInput value={f.systemOwner} onChange={v => set({ systemOwner:v })} placeholder="例：王大明 / ming.wang@bank.com" />
        </div>
      </div>
      <div>
        <FieldLabel label="系統類型"
          tip={{ why:"不同類型的系統在 PQC 遷移中面臨不同挑戰。例如核心銀行系統牽涉層面廣，支付系統有即時性要求。", risk:"系統類型影響遷移複雜度與業務中斷風險評估。", field:"System.systemType" }} />
        <SelectField value={f.systemType} onChange={v => set({ systemType:v })}
          options={[
            { value:"核心銀行", label:"核心銀行系統" },
            { value:"支付清算", label:"支付 / 清算系統" },
            { value:"財富管理", label:"財富管理 / 投資系統" },
            { value:"授信核貸", label:"授信 / 核貸系統" },
            { value:"保險", label:"保險 / 理賠系統" },
            { value:"監理報送", label:"監理報送 / 法規遵循" },
            { value:"客戶服務", label:"客戶服務 / 網路銀行" },
            { value:"內部工具", label:"內部工具 / 管理系統" },
            { value:"基礎設施", label:"基礎設施 / 中介平台" },
          ]}
        />
      </div>
      <div>
        <FieldLabel label="這個系統對業務的重要程度如何？" required
          tip={{ why:"業務重要性決定 PQC 遷移的優先順序與資源投入程度。重大系統一旦因量子攻擊受損，影響範圍最廣。", risk:"業務重要性是 HNDL 風險評分的關鍵乘數，也是 FSC 系統分類的依據。", field:"System.businessCriticality" }} />
        <SelectField value={f.businessCriticality} onChange={v => set({ businessCriticality: v as IntakeForm["businessCriticality"] })}
          options={[
            { value:"critical", label:"🔴 重大（核心服務，停機影響客戶或監理）" },
            { value:"high",     label:"🟠 高（重要服務，停機有業務損失）" },
            { value:"medium",   label:"🟡 中（一般業務系統，有替代方案）" },
            { value:"low",      label:"🟢 低（輔助工具，影響有限）" },
          ]}
        />
      </div>
      <div>
        <FieldLabel label="這個系統是否直接影響客戶交易或對外服務？"
          tip={{ why:"直接面向客戶的系統在發生安全問題時，損害擴散速度快、社會影響大，PQC 遷移優先級應提高。", risk:"客戶交易系統的加密漏洞可能造成立即性的財務損失與聲譽風險。", field:"affectsCustomerTx → hndlRiskScore" }} />
        <YesNoField value={f.affectsCustomerTx} onChange={v => set({ affectsCustomerTx:v })} />
      </div>
      <div>
        <FieldLabel label="這個系統是否涉及監理申報、法定資料保存或法規遵循流程？"
          tip={{ why:"涉及監理申報的系統受 FSC 直接監管，加密標準有更嚴格要求，且稽查頻率更高。", risk:"未符合 FSC 加密要求的監理系統可能面臨主動監理行動。", field:"involvesRegulatory → 監理要求優先級" }} />
        <YesNoField value={f.involvesRegulatory} onChange={v => set({ involvesRegulatory:v })} />
      </div>
    </div>
  );
}

function Section2({ f, set }: { f: IntakeForm; set: (patch: Partial<IntakeForm>) => void }) {
  return (
    <div className="space-y-5">
      <div>
        <FieldLabel label="這個系統處理的資料，通常需要保存多久？" required
          tip={{ why:"資料保存年限是評估「收割現在，未來解密（HNDL）」風險的核心指標。今天被攔截的加密資料，可能在 2030–2035 年量子電腦成熟後被解密。", risk:"保存年限越長，HNDL 風險越高。10 年以上的資料面臨最直接的量子威脅。", field:"System.dataRetentionYears" }} />
        <div className="flex items-center gap-3">
          <NumberInput value={f.dataRetentionYears} onChange={v => set({ dataRetentionYears:v })} placeholder="年數" />
          <span className="text-sm text-muted-foreground">年</span>
          {parseInt(f.dataRetentionYears||"0",10) >= 10 && (
            <span className="inline-flex items-center gap-1.5 rounded-full border border-rose-200 bg-rose-50 px-3 py-1 text-xs font-semibold text-rose-700">
              <AlertTriangle className="h-3 w-3" />超過 HNDL 風險閾值
            </span>
          )}
        </div>
      </div>
      <div>
        <FieldLabel label="系統處理的資料是否包含個人資料（姓名、身分證、聯絡方式等）？"
          tip={{ why:"個資在量子解密後具備直接的法律與商業損害，是 GDPR / 個資法的保護核心對象。", risk:"個資外洩在量子時代將更難防範，且金融個資損害賠償責任可能持續多年。", field:"System.dataTypes → PII" }} />
        <YesNoField value={f.hasPersonalData} onChange={v => set({ hasPersonalData:v })} />
      </div>
      <div>
        <FieldLabel label="系統處理的資料中，是否包含以下敏感類型？（可複選）"
          tip={{ why:"金融敏感資料的量子解密後損害具不可逆性：授信記錄外洩影響信用，醫療資料外洩無法撤回，保單資料影響理賠。", risk:"敏感資料類型數量直接影響 HNDL 風險評分，也決定 PQC 遷移的優先級與資源配置。", field:"System.dataTypes" }} />
        <MultiCheckField
          options={["授信 / 房貸記錄","KYC 文件","財務報表 / 損益","交易流水","保單 / 理賠","醫療 / 健康記錄","投資 / 持倉資料","受益人資訊","企業機密文件","員工薪資資料"]}
          value={f.sensitiveDataTypes}
          onChange={v => set({ sensitiveDataTypes:v })}
        />
      </div>
      <div>
        <FieldLabel label="這些資料在 10 年後是否仍然有價值，或仍然具有敏感性？"
          tip={{ why:"HNDL 的核心風險是「未來價值」。若資料在 10 年後已無用（例如短期行銷記錄），量子解密損害有限；若仍具敏感性（例如終身房貸記錄），風險持續。", risk:"10 年後仍敏感的資料，即使目前加密，也面臨量子電腦成熟後被解密的實質威脅。", field:"→ hndlRiskScore 加分項" }} />
        <YesNoField value={f.dataStillSensitiveAt10yr} onChange={v => set({ dataStillSensitiveAt10yr:v })} />
      </div>
      <div>
        <FieldLabel label="若這個系統的資料遭到外洩，是否可能造成客戶損害、法律責任或監理風險？"
          tip={{ why:"損害可量化性是決定資源優先投入的關鍵。若外洩後有明確的賠償、訴訟或監理行動風險，代表此系統值得優先保護。", risk:"可量化損害 = 高 HNDL 業務衝擊，資安應優先關注。", field:"→ hndlRiskScore 業務衝擊項" }} />
        <YesNoField value={f.leakageCausesHarm} onChange={v => set({ leakageCausesHarm:v })} />
      </div>
    </div>
  );
}

function Section3({ f, set }: { f: IntakeForm; set: (patch: Partial<IntakeForm>) => void }) {
  return (
    <div className="space-y-5">
      <div>
        <FieldLabel label="這個系統是否會與外部機構或第三方交換資料？" required
          tip={{ why:"外部串接是最容易被攻擊者攔截資料的路徑。與外部機構的傳輸若使用現有加密，今天就可能被竊取等待未來解密。", risk:"外部 API 傳輸是 HNDL 攻擊的主要目標，也是 FSC 草案新要求的重點。", field:"System.hasExternalApi" }} />
        <YesNoField value={f.hasExternalExchange} onChange={v => set({ hasExternalExchange:v })} />
      </div>
      {f.hasExternalExchange !== false && (
        <div>
          <FieldLabel label="外部對象屬於哪些類型？（可複選）"
            tip={{ why:"不同類型的外部對象有不同的資料敏感程度。財金公司傳輸涉及帳戶資料，醫療院所傳輸涉及不可逆個資。", risk:"外部對象類型影響傳輸加密強度要求，也決定哪些補件任務需要優先執行。", field:"System.externalParties" }} />
          <MultiCheckField
            options={["財金公司（ATM / 跨行）","聯徵中心","保險公司","醫療院所","政府機關 / 聯徵","海外代理行 / 國際清算","電子支付業者","估價 / 徵信機構","第三方 API 服務商","企業 ERP / 業務系統"]}
            value={f.externalPartyTypes}
            onChange={v => set({ externalPartyTypes:v })}
          />
        </div>
      )}
      <div>
        <FieldLabel label="是否有批次檔案交換（例如每日結帳對帳、報表傳送）？"
          tip={{ why:"批次檔案傳輸通常量大且頻繁，攻擊者可系統性地攔截並累積，是 HNDL 的高效率目標。", risk:"批次檔案加密一旦被破解，可回溯解密過去所有批次資料，損害不亞於即時 API 攻擊。", field:"hasBatchFile → HNDL 暴露面" }} />
        <YesNoField value={f.hasBatchFile} onChange={v => set({ hasBatchFile:v })} />
      </div>
      <div>
        <FieldLabel label="是否有即時 API 串接（例如線上授信查詢、即時轉帳驗證）？"
          tip={{ why:"即時 API 傳輸包含完整的交易上下文，包括帳號、金額、身分資訊，是 HNDL 攻擊的最高價值目標。", risk:"即時 API 是 HNDL 風險評分中最高加分項，也是 FSC 技術要求的優先對象。", field:"System.hasExternalApi → 即時傳輸" }} />
        <YesNoField value={f.hasRealtimeApi} onChange={v => set({ hasRealtimeApi:v })} />
      </div>
      <div>
        <FieldLabel label="是否有跨境資料交換（例如海外分行、國際清算、跨國業務）？"
          tip={{ why:"跨境傳輸的路由更長、更難控制，攻擊者有更長時間進行攔截。此外，跨境資料可能同時適用多個國家的資料保護法規。", risk:"跨境傳輸 HNDL 風險高於境內傳輸，且一旦外洩涉及國際法律責任。", field:"hasCrossBorder → 跨境 HNDL 加權" }} />
        <YesNoField value={f.hasCrossBorder} onChange={v => set({ hasCrossBorder:v })} />
      </div>
    </div>
  );
}

function Section4({ f, set }: { f: IntakeForm; set: (patch: Partial<IntakeForm>) => void }) {
  return (
    <div className="space-y-5">
      <div className="rounded-lg border border-blue-200 bg-blue-50 p-3 text-sm text-blue-700">
        <Info className="inline mr-1.5 h-4 w-4" />
        這一區的問題用白話描述，不需要懂加密技術。回答的目的是讓資安協助盤點哪些地方可能用到加密，並評估未來更換演算法的影響範圍。
      </div>
      <div>
        <FieldLabel label="使用者是否透過 HTTPS 網站（瀏覽器鎖頭圖示）或手機 App 使用這個系統？"
          tip={{ why:"HTTPS 背後使用的 TLS 協定包含量子脆弱演算法（RSA / ECC），是 PQC 遷移的主要目標之一。", risk:"幾乎所有 HTTPS 連線都需要進行 PQC 遷移，確認此項有助於評估遷移工作量。", field:"cryptoSignals: TLS" }} />
        <YesNoField value={f.usesHttps} onChange={v => set({ usesHttps:v })} />
      </div>
      <div>
        <FieldLabel label="是否有數位簽章、電子憑證、憑證登入，或對檔案進行數位加簽？（例如電子合約、報表簽章）"
          tip={{ why:"數位簽章通常使用 RSA 或 ECC 演算法，這些在量子電腦下可能被偽造，需優先替換為後量子簽章演算法。", risk:"若簽章機制被量子破解，所有歷史文件的真實性都可能被否認，法律效力受損。", field:"cryptoSignals: RSA / ECC / PKI 簽章" }} />
        <YesNoField value={f.hasDigitalSig} onChange={v => set({ hasDigitalSig:v })} />
      </div>
      <div>
        <FieldLabel label="是否有硬體加密設備（例如加密機、HSM、金鑰保管模組）？"
          tip={{ why:"HSM 硬體對後量子演算法的支援程度因型號而異，有些需要韌體升級，有些需要全面換購，是高成本風險項目。", risk:"HSM 不支援後量子演算法是 PQC 遷移的常見阻礙，需提前評估。", field:"cryptoSignals: HSM → System.cmdbTags" }} />
        <YesNoField value={f.hasHsm} onChange={v => set({ hasHsm:v })} />
      </div>
      <div>
        <FieldLabel label="加密或安全模組是否由外部廠商提供？（例如廠商提供加解密 SDK、安全中介層）"
          tip={{ why:"若加密功能由廠商控制，本行的 PQC 遷移速度就受廠商的升級計畫限制，這是最常見的遷移阻礙。", risk:"供應商控制加密模組代表本行缺乏自主調整能力，是加密調整能力的重大缺口。", field:"vendorProvidesEncryption → 遷移可控性" }} />
        <YesNoField value={f.vendorProvidesEncryption} onChange={v => set({ vendorProvidesEncryption:v })} />
      </div>
      <div>
        <FieldLabel label="系統是否使用 API 憑證、存取金鑰（Token）、或對批次傳輸檔案進行加密？"
          tip={{ why:"API 金鑰、JWT Token、批次檔案加密都可能使用量子脆弱演算法，需列入盤點。這些通常是看不見但數量龐大的加密依存。", risk:"API 認證機制若使用 RSA 簽章，在量子環境下可能被偽造，造成未授權存取。", field:"cryptoSignals: JWT / API token / 批次加密" }} />
        <YesNoField value={f.hasApiCertOrToken} onChange={v => set({ hasApiCertOrToken:v })} />
      </div>
    </div>
  );
}

function Section5({ f, set }: { f: IntakeForm; set: (patch: Partial<IntakeForm>) => void }) {
  return (
    <div className="space-y-5">
      <div>
        <FieldLabel label="這個系統是否由外部廠商開發或維護？" required
          tip={{ why:"委外廠商的加密能力直接影響本行 PQC 遷移可行性。若廠商無法配合升級，本行的遷移計畫將受阻。", risk:"供應商依賴是 PQC 遷移中最常見的非技術阻礙，FSC 外包要點要求評估廠商技術韌性。", field:"System.vendorId" }} />
        <YesNoField value={f.hasVendor} onChange={v => set({ hasVendor:v })} labels={["是，有委外廠商","否，自行開發維護","部分委外"]} />
      </div>
      {f.hasVendor !== false && (
        <>
          <div>
            <FieldLabel label="供應商名稱"
              tip={{ why:"記錄廠商名稱以便後續追蹤，一個廠商可能服務多個系統，整合追蹤可減少重複詢問。", risk:"供應商資料缺失會導致採購團隊無法有效跟進 PQC 遷移計畫要求。", field:"Vendor.vendorName" }} />
            <TextInput value={f.vendorName} onChange={v => set({ vendorName:v })} placeholder="例：IBM、精誠資訊、凌群電腦…" />
          </div>
          <div className="grid gap-5 sm:grid-cols-2">
            <div>
              <FieldLabel label="與供應商的合約目前是否仍有效？"
                tip={{ why:"合約狀態決定是否能立即要求供應商配合 PQC 升級，過期合約需要重新談判。", risk:"合約失效代表本行對供應商沒有約束力，PQC 遷移需求可能被忽視。", field:"contractActive" }} />
              <YesNoField value={f.contractActive} onChange={v => set({ contractActive:v })} labels={["有效","已過期","不確定"]} />
            </div>
            <div>
              <FieldLabel label="合約到期日（大約）"
                tip={{ why:"合約到期時是納入 PQC 技術條款的最佳時機，需提前規劃談判策略。", risk:"若合約在 2026 前到期，可在續約時加入 PQC 條款；否則需另行補充協議。", field:"contractExpiry" }} />
              <input
                type="date"
                value={f.contractExpiry}
                onChange={e => set({ contractExpiry:e.target.value })}
                className="rounded-md border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
              />
            </div>
          </div>
          <div>
            <FieldLabel label="合約中是否包含資安升級義務或加密演算法替換責任條款？"
              tip={{ why:"加密技術升級條款是要求供應商執行 PQC 遷移的法律依據。若缺乏此條款，本行要求升級時可能遭廠商拒絕或需要另行支付費用。", risk:"合約缺乏技術升級條款，是 PQC 遷移中最常見的法律風險，FSC 外包要點要求此項。", field:"Vendor.contractUpgradeClause" }} />
            <YesNoField value={f.contractHasSecurityClause} onChange={v => set({ contractHasSecurityClause:v })} labels={["有此條款","沒有此條款","不清楚"]} />
          </div>
          <div>
            <FieldLabel label="供應商是否有提供後量子遷移計畫？"
              tip={{ why:"PQC 遷移計畫是評估供應商準備度的核心文件，若未提供，代表供應商可能尚未開始規劃，本行遷移時程將受阻。", risk:"供應商無遷移計畫是嚴重的供應鏈 PQC 風險信號，需要立即啟動追蹤。", field:"Vendor.pqcRoadmapStatus" }} />
            <YesNoField value={f.vendorHasRoadmap} onChange={v => set({ vendorHasRoadmap:v })} labels={["已提供","尚未提供","不清楚"]} />
          </div>
          <div>
            <FieldLabel label="供應商的系統是否支援「加密敏捷性」？（即可以在不停機的情況下替換加密演算法）"
              tip={{ why:"加密調整能力是指系統架構能夠在不中斷服務的情況下替換演算法。缺乏此能力代表遷移時需停機或大規模改版，成本與風險倍增。", risk:"缺乏加密調整能力的系統在 PQC 遷移時面臨停機風險，需提前評估替代策略。", field:"Vendor.cryptoAgilityStatus" }} />
            <YesNoField value={f.vendorCryptoAgility} onChange={v => set({ vendorCryptoAgility:v })} labels={["支援（可熱升級）","不支援（需停機改版）","不確定"]} />
          </div>
        </>
      )}
    </div>
  );
}

function Section6({ f, set }: { f: IntakeForm; set: (patch: Partial<IntakeForm>) => void }) {
  return (
    <div className="space-y-5">
      <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700">
        <CheckCircle2 className="inline mr-1.5 h-4 w-4" />
        前期盤點主要欄位已完成。這一區可補充任何想讓資安團隊知道的事項，以下欄位均為非必填。
      </div>
      <div>
        <FieldLabel label="業務備註"
          tip={{ why:"任何業務角度的背景資訊，都有助於資安更準確地評估風險與遷移時機。", risk:"業務背景資訊可協助資安避免誤判風險等級。" }} />
        <TextAreaInput value={f.businessNotes} onChange={v => set({ businessNotes:v })}
          placeholder="例：這個系統預計在 Q3 進行改版，可以同時納入加密升級。" />
      </div>
      <div>
        <FieldLabel label="技術備註（如有技術人員協助填寫）"
          tip={{ why:"若系統開發或維護人員有額外的技術細節，可協助資安更快完成密碼技術盤點（CBOM）。", risk:"技術細節有助於縮短後續資安審查時間。", field:"System.cryptoSignals / cmdbTags" }} />
        <TextAreaInput value={f.techNotes} onChange={v => set({ techNotes:v })}
          placeholder="例：使用 OpenSSL 1.1.1，TLS 1.2，JWT RS256 簽章，HSM 型號為 Thales Luna 7…" />
      </div>
      <div>
        <FieldLabel label="已知風險或特別需要關注的事項"
          tip={{ why:"若填寫人員已知有特定的資安問題或脆弱點，提早告知可讓資安優先處理。", risk:"已知風險若未揭露可能導致評估遺漏。" }} />
        <TextAreaInput value={f.knownRisks} onChange={v => set({ knownRisks:v })}
          placeholder="例：廠商曾表示 HSM 不支援後量子演算法，需要更換設備。" />
      </div>
      <div>
        <FieldLabel label="希望資安團隊協助確認的事項"
          tip={{ why:"若有具體問題希望資安協助釐清，請列出，資安將在後續審查中優先回應。", risk:"明確的問題有助於縮短審查週期。" }} />
        <TextAreaInput value={f.securityRequests} onChange={v => set({ securityRequests:v })}
          placeholder="例：不確定這個系統的 TLS 設定是否符合最新 FSC 要求，希望資安協助確認。" />
      </div>
    </div>
  );
}

// ─── Result screen ────────────────────────────────────────────────────────────

function ResultScreen({ f, hndlScore, tasks, onReset }: {
  f: IntakeForm;
  hndlScore: number;
  tasks: GeneratedTask[];
  onReset: () => void;
}) {
  const navigate = useNavigate();
  const sc = scoreLabel(hndlScore);
  const [expanded, setExpanded] = useState<string | null>(null);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4 flex items-start gap-3">
        <CheckCircle2 className="h-6 w-6 shrink-0 text-emerald-600 mt-0.5" />
        <div>
          <div className="font-semibold text-emerald-800">盤點資料已送出並儲存</div>
          <div className="text-sm text-emerald-700 mt-0.5">
            系統「{f.systemName}」的盤點資料已記錄，已自動產生 {tasks.length} 筆跨部門待辦任務。
          </div>
        </div>
      </div>

      {/* HNDL Score */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Zap className="h-4 w-4" />HNDL 風險評分結果
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-end gap-4 mb-4">
            <div className={cn("text-5xl font-bold tabular-nums", sc.cls)}>{hndlScore}</div>
            <div className="mb-1">
              <Badge variant={sc.badgeVariant}>{sc.label}</Badge>
              <div className="mt-1 text-xs text-muted-foreground">滿分 100 分</div>
            </div>
          </div>
          <div className="h-3 rounded-full bg-muted overflow-hidden mb-4">
            <div
              className={cn("h-full rounded-full transition-all",
                hndlScore >= 80 ? "bg-rose-500" :
                hndlScore >= 60 ? "bg-orange-400" :
                hndlScore >= 40 ? "bg-amber-400" : "bg-emerald-400")}
              style={{ width:`${hndlScore}%` }}
            />
          </div>
          <div className="grid gap-2 sm:grid-cols-3 text-xs text-muted-foreground">
            {[
              { label:"資料保存年限", value: f.dataRetentionYears ? `${f.dataRetentionYears} 年` : "未填" },
              { label:"敏感資料類型", value: `${f.sensitiveDataTypes.length} 項` },
              { label:"外部 API 串接", value: f.hasRealtimeApi ? "有即時 API" : f.hasBatchFile ? "批次交換" : "無" },
            ].map(({ label, value }) => (
              <div key={label} className="rounded-md border bg-muted/20 px-3 py-2">
                <div className="text-muted-foreground">{label}</div>
                <div className="mt-0.5 font-medium text-foreground">{value}</div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Generated tasks */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <ClipboardList className="h-4 w-4" />已產生 {tasks.length} 筆跨部門待辦任務
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {tasks.map((task, i) => (
            <div key={i} className="rounded-lg border bg-background">
              <button type="button" className="w-full text-left px-4 py-3 flex items-start gap-3"
                onClick={() => setExpanded(expanded === `t${i}` ? null : `t${i}`)}>
                <span className={cn("rounded-full border px-2 py-0.5 text-xs font-semibold shrink-0 mt-0.5",
                  task.priority === "P1" ? "border-rose-200 bg-rose-50 text-rose-700" :
                  task.priority === "P2" ? "border-amber-200 bg-amber-50 text-amber-700" :
                  "border-slate-200 bg-slate-50 text-slate-600")}>
                  {task.priority}
                </span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={cn("rounded-full px-2 py-0.5 text-xs font-medium",
                      task.role === "資安" ? "bg-rose-100 text-rose-700" :
                      task.role === "業務" ? "bg-blue-100 text-blue-700" :
                      task.role === "採購" ? "bg-amber-100 text-amber-700" :
                      task.role === "架構" ? "bg-purple-100 text-purple-700" :
                      "bg-slate-100 text-slate-700")}>
                      {task.role}
                    </span>
                  </div>
                  <p className="mt-0.5 text-sm font-medium">{task.title}</p>
                </div>
                {expanded === `t${i}` ? <ChevronUp className="h-4 w-4 shrink-0 text-muted-foreground mt-0.5" /> : <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground mt-0.5" />}
              </button>
              {expanded === `t${i}` && (
                <div className="border-t px-4 py-3 text-sm text-muted-foreground bg-muted/10">
                  <span className="font-medium text-foreground">觸發原因：</span>{task.reason}
                </div>
              )}
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Actions */}
      <div className="flex flex-wrap items-center gap-3">
        <Button onClick={() => navigate("/report")}>
          <ShieldCheck className="mr-2 h-4 w-4" />前往 Evidence Pack 查看證據包
        </Button>
        <Button variant="outline" onClick={() => navigate("/tasks")}>
          <ClipboardList className="mr-2 h-4 w-4" />查看跨部門待辦任務
        </Button>
        <Button variant="outline" onClick={onReset}>
          <ArrowLeft className="mr-2 h-4 w-4" />再填一份
        </Button>
      </div>
    </div>
  );
}

// ─── Main wizard ──────────────────────────────────────────────────────────────

const SECTIONS = [
  { num: 1, title:"系統與業務屬性",         icon: Building2 },
  { num: 2, title:"資料生命週期與敏感度",   icon: Lock },
  { num: 3, title:"外部串接與資料交換",     icon: ArrowRight },
  { num: 4, title:"加密使用情境初步盤點",   icon: ShieldCheck },
  { num: 5, title:"供應商與合約",           icon: ClipboardList },
  { num: 6, title:"補充說明",               icon: Info },
];

export function PqcIntake() {
  const [step, setStep]       = useState(1);
  const [form, setForm]       = useState<IntakeForm>(EMPTY);
  const [submitted, setSubmitted] = useState(false);
  const [hndlScore, setHndlScore] = useState(0);
  const [tasks, setTasks]     = useState<GeneratedTask[]>([]);

  const set = (patch: Partial<IntakeForm>) => setForm(prev => ({ ...prev, ...patch }));
  const validationIssues = validateIntakeForm(form);
  const blockingIssues = validationIssues.filter((issue) => issue.severity === "error");

  const submit = () => {
    if (blockingIssues.length > 0) {
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }

    const score = calcHndlScore(form);
    const generatedTasks = generateIntakeTasks(form, score);

    saveIntakeSubmission(form, score, generatedTasks);

    setHndlScore(score);
    setTasks(generatedTasks);
    setSubmitted(true);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const reset = () => {
    setForm(EMPTY);
    setStep(1);
    setSubmitted(false);
    setHndlScore(0);
    setTasks([]);
  };

  if (submitted) {
    return (
      <div className="space-y-2">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <ClipboardList className="h-4 w-4" />PQC Intake 前期盤點
        </div>
        <h2 className="text-2xl font-semibold">盤點資料已送出</h2>
        <div className="mt-4">
          <ResultScreen f={form} hndlScore={hndlScore} tasks={tasks} onReset={reset} />
        </div>
      </div>
    );
  }

  const cur = SECTIONS[step - 1];
  const CurIcon = cur.icon;
  const isLast = step === 6;

  return (
    <div className="space-y-6 max-w-3xl">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <ClipboardList className="h-4 w-4" />PQC Intake 前期盤點
        </div>
        <h2 className="mt-1 text-2xl font-semibold">後量子密碼遷移前期盤點表</h2>
        <p className="mt-1 text-sm text-muted-foreground max-w-2xl">
          本頁以業務情境呈現，不需要資安技術背景。填寫約需 5–10 分鐘，送出後系統將產生初步風險評分與跨部門待辦任務。
        </p>
      </div>

      {/* Progress */}
      <div className="space-y-2">
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>第 {step} / 6 區</span>
          <span>{Math.round((step / 6) * 100)}% 完成</span>
        </div>
        <div className="h-2 rounded-full bg-muted overflow-hidden">
          <div className="h-full rounded-full bg-primary transition-all" style={{ width:`${(step / 6) * 100}%` }} />
        </div>
        <div className="hidden sm:flex gap-1">
          {SECTIONS.map(s => (
            <button type="button" key={s.num} onClick={() => s.num < step && setStep(s.num)}
              className={cn("flex-1 rounded-md px-2 py-1.5 text-center text-xs transition-colors truncate",
                s.num === step ? "bg-primary text-primary-foreground font-medium" :
                s.num < step  ? "bg-secondary text-primary cursor-pointer hover:bg-secondary/80" :
                "bg-muted/40 text-muted-foreground cursor-default")}>
              {s.title}
            </button>
          ))}
        </div>
      </div>

      {/* Section card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10">
              <CurIcon className="h-4 w-4 text-primary" />
            </div>
            <div>
              <div className="text-xs font-normal text-muted-foreground">第 {step} 區 / 6</div>
              {cur.title}
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {step === 1 && <Section1 f={form} set={set} />}
          {step === 2 && <Section2 f={form} set={set} />}
          {step === 3 && <Section3 f={form} set={set} />}
          {step === 4 && <Section4 f={form} set={set} />}
          {step === 5 && <Section5 f={form} set={set} />}
          {step === 6 && <Section6 f={form} set={set} />}
        </CardContent>
      </Card>

      {validationIssues.length > 0 && (
        <Card className={cn(blockingIssues.length ? "border-rose-200" : "border-amber-200")}>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <AlertTriangle className={cn("h-4 w-4", blockingIssues.length ? "text-rose-600" : "text-amber-600")} />
              盤點品質防呆提示
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {validationIssues.map((issue) => (
              <div
                className={cn(
                  "rounded-lg border p-3",
                  issue.severity === "error" ? "border-rose-200 bg-rose-50" : "border-amber-200 bg-amber-50"
                )}
                key={issue.issueId}
              >
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant={issue.severity === "error" ? "risk" : "warning"}>
                    {issue.severity === "error" ? "需修正" : "可送出但需追蹤"}
                  </Badge>
                  <span className="text-sm font-semibold">{issue.title}</span>
                </div>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">{issue.message}</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  <span className="font-medium text-foreground">建議動作：</span>{issue.suggestedAction}
                </p>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Navigation */}
      <div className="flex items-center justify-between">
        <Button variant="outline" onClick={() => setStep(s => Math.max(1, s - 1))} disabled={step === 1}>
          <ArrowLeft className="mr-2 h-4 w-4" />上一區
        </Button>

        <div className="flex gap-1">
          {SECTIONS.map(s => (
            <div key={s.num}
              className={cn("h-2 w-2 rounded-full transition-colors",
                s.num === step ? "bg-primary" :
                s.num < step  ? "bg-primary/40" : "bg-muted")} />
          ))}
        </div>

        {isLast ? (
          <Button onClick={submit} disabled={!form.systemName.trim() || blockingIssues.length > 0}>
            <Send className="mr-2 h-4 w-4" />送出盤點資料
          </Button>
        ) : (
          <Button onClick={() => setStep(s => Math.min(6, s + 1))}>
            下一區<ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        )}
      </div>
    </div>
  );
}
