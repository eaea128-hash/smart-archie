import { useMemo, useState } from "react";
import { AlertTriangle, CalendarClock, CheckCircle2, Clock, XCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface Regulation {
  id: string;
  name: string;
  authority: string;
  region: string;
  deadline: string | null; // ISO date or null if "持續生效"
  deadlineLabel: string;
  requirement: string;
  scope: string;
  reference: string;
  status: "completed" | "overdue" | "urgent" | "pending" | "tracking";
  dataAsOf: string;        // 資料蒐集日期 ISO
  nextReviewDate: string;  // 建議複查日期 ISO
}

const REGULATIONS: Regulation[] = [
  {
    id: "reg-nist-fips",
    name: "NIST FIPS 203 / 204 / 205 定案",
    authority: "NIST（美國國家標準局）",
    region: "美國",
    deadline: "2024-08-13",
    deadlineLabel: "2024-08-13（已定案）",
    requirement: "ML-KEM（FIPS 203）、ML-DSA（FIPS 204）、SLH-DSA（FIPS 205）正式成為後量子密碼標準，各機構應以此為遷移目標基準。",
    scope: "全球適用（參考標準）",
    reference: "NIST IR 8413 / FIPS PUB 203/204/205",
    status: "completed",
    dataAsOf: "2024-08-13",
    nextReviewDate: "2025-08-01",
  },
  {
    id: "reg-tw-fsc-pqc-guide",
    name: "金管會「金融業後量子密碼遷移參考指引」正式發布",
    authority: "金融監督管理委員會（FSC）",
    region: "台灣",
    deadline: "2027-12-31",
    deadlineLabel: "短期 2027 / 中期 2029 / 長期 2035",
    requirement: "金管會 2026-06-18 正式發布七大策略方向：①PQC政策與治理 ②CBOM密碼技術清單 ③加密敏捷性 ④生態系協作 ⑤風險導向遷移優先序 ⑥採購與供應鏈管理 ⑦測試切換與營運韌性。短期（至2027）建立治理架構與盤點方法；中期（至2029）推動試辦驗證；中長期（至2035）完成高風險系統遷移。",
    scope: "台灣受監理金融機構",
    reference: "金管會 2026-06-18 新聞稿 / 金融業後量子密碼遷移參考指引 PDF",
    status: "pending",
    dataAsOf: "2026-06-18",
    nextReviewDate: "2026-12-01",
  },
  {
    id: "reg-tw-fsc-pqc",
    name: "金管會 PQC 加密資產盤點指引（前期草案）",
    authority: "金融監督管理委員會（FSC）",
    region: "台灣",
    deadline: "2025-12-31",
    deadlineLabel: "2025-12-31",
    requirement: "金融機構應完成加密資產清冊（CBOM），識別現有量子脆弱算法（RSA / ECC / TLS 1.2）分布範圍與責任歸屬。已由 2026-06-18 正式指引取代，此為前期草案參考。",
    scope: "台灣受監理金融機構",
    reference: "金融資安行動方案 2.0 / 金管會 PQC 指引草案（已由正式指引取代）",
    status: "overdue",
    dataAsOf: "2026-06-18",
    nextReviewDate: "2026-12-01",
  },
  {
    id: "reg-tw-cybersec-3",
    name: "金融資安行動方案 3.0 — PQC 遷移計畫提交",
    authority: "金融監督管理委員會（FSC）",
    region: "台灣",
    deadline: "2026-12-31",
    deadlineLabel: "2026-12-31",
    requirement: "金融機構應完成 PQC 遷移計畫書，涵蓋：優先遷移系統清單、演算法替換路線、Hybrid Mode 試點計畫、2030 達標目標。",
    scope: "台灣受監理金融機構",
    reference: "金融資安行動方案 3.0（預計 2026 公布）",
    status: "pending",
    dataAsOf: "2026-06-01",
    nextReviewDate: "2026-12-01",
  },
  {
    id: "reg-mas-trm",
    name: "MAS TRM 2021 — TLS 1.2+ 強制要求",
    authority: "MAS（新加坡金融管理局）",
    region: "新加坡",
    deadline: "2022-12-31",
    deadlineLabel: "2022-12-31（已生效）",
    requirement: "所有對外金融系統必須停用 TLS 1.0 / 1.1，強制使用 TLS 1.2 以上。2026 起建議規劃 TLS 1.3 + PQC cipher suite 混合模式。",
    scope: "新加坡受監理金融機構（含跨境業務）",
    reference: "MAS TRM 2021 §9.1.5",
    status: "completed",
    dataAsOf: "2023-01-01",
    nextReviewDate: "2026-12-01",
  },
  {
    id: "reg-eu-dora",
    name: "EU DORA — 數位韌性測試強制執行",
    authority: "歐盟 ESAs（EBA / ESMA / EIOPA）",
    region: "歐盟",
    deadline: "2025-01-17",
    deadlineLabel: "2025-01-17（已生效）",
    requirement: "金融實體必須建立 ICT 風險管理框架，包含加密韌性評估。2027 起 PQC 遷移進度預計列入威脅主導滲透測試（TLPT）範圍。",
    scope: "歐盟境內金融機構及跨境服務提供商",
    reference: "Regulation (EU) 2022/2554 DORA Art. 25",
    status: "completed",
    dataAsOf: "2025-01-17",
    nextReviewDate: "2027-01-01",
  },
  {
    id: "reg-nsa-cnsa-software",
    name: "NSA CNSA 2.0 — 軟體與雲端系統",
    authority: "NSA（美國國家安全局）",
    region: "美國",
    deadline: "2025-12-31",
    deadlineLabel: "2025-12-31",
    requirement: "美國聯邦機構及關鍵基礎設施：軟體與雲端系統應完成 PQC 算法導入規劃，新系統優先採用 ML-KEM / ML-DSA。",
    scope: "美國聯邦機構 / 國防工業供應鏈（參考基準）",
    reference: "NSA CNSA 2.0 Advisory (2022-09)",
    status: "overdue",
    dataAsOf: "2022-09-07",
    nextReviewDate: "2026-09-01",
  },
  {
    id: "reg-nsa-cnsa-network",
    name: "NSA CNSA 2.0 — 網路設備與傳輸加密",
    authority: "NSA（美國國家安全局）",
    region: "美國",
    deadline: "2026-12-31",
    deadlineLabel: "2026-12-31",
    requirement: "VPN、防火牆、路由器等網路設備應完成 PQC cipher suite 升級。IETF hybrid TLS draft 實作應於此期間完成測試。",
    scope: "美國聯邦機構（參考基準）",
    reference: "NSA CNSA 2.0 Advisory (2022-09)",
    status: "pending",
    dataAsOf: "2022-09-07",
    nextReviewDate: "2026-12-01",
  },
  {
    id: "reg-iso-18033-6",
    name: "ISO/IEC 18033-6 — PQC 加密標準定案",
    authority: "ISO / IEC JTC 1/SC 27",
    region: "國際",
    deadline: "2027-06-30",
    deadlineLabel: "2027 年（預計）",
    requirement: "後量子加密算法國際標準化預計完成，涵蓋 KEM 與簽章算法。金融機構應追蹤進度以確保 CBOM 與採購合約相容。",
    scope: "全球（ISO 成員國）",
    reference: "ISO/IEC 18033-6 DIS（草案）",
    status: "tracking",
    dataAsOf: "2026-06-01",
    nextReviewDate: "2026-12-01",
  },
  {
    id: "reg-nsa-cnsa-2030",
    name: "NSA CNSA 2.0 — 全面停用傳統算法",
    authority: "NSA（美國國家安全局）",
    region: "美國",
    deadline: "2030-01-01",
    deadlineLabel: "2030-01-01",
    requirement: "RSA、ECC、DH、DSA 等所有傳統公鑰算法應全面退場。金融機構供應鏈若有美國聯邦合約，需提前完成遷移驗證。",
    scope: "美國聯邦機構 / 關鍵基礎設施（國際金融機構參考）",
    reference: "NSA CNSA 2.0 Advisory (2022-09) — 2030 deadline",
    status: "tracking",
    dataAsOf: "2022-09-07",
    nextReviewDate: "2027-01-01",
  },
];

type StatusKey = Regulation["status"];

const STATUS_CONFIG: Record<StatusKey, { label: string; color: string; bg: string; icon: typeof CheckCircle2 }> = {
  completed: { label: "已完成", color: "text-emerald-700", bg: "bg-emerald-50 border-emerald-200", icon: CheckCircle2 },
  overdue:   { label: "已逾期", color: "text-rose-700",    bg: "bg-rose-50 border-rose-200",       icon: XCircle },
  urgent:    { label: "緊急",   color: "text-orange-700",  bg: "bg-orange-50 border-orange-200",   icon: AlertTriangle },
  pending:   { label: "待辦",   color: "text-blue-700",    bg: "bg-blue-50 border-blue-200",       icon: Clock },
  tracking:  { label: "追蹤中", color: "text-slate-600",   bg: "bg-slate-50 border-slate-200",     icon: CalendarClock },
};

function calcDaysLeft(deadline: string | null): number | null {
  if (!deadline) return null;
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const d = new Date(deadline);
  return Math.round((d.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
}

function deriveStatus(reg: Regulation): StatusKey {
  if (reg.status === "completed") return "completed";
  const days = calcDaysLeft(reg.deadline);
  if (days === null) return "tracking";
  if (days < 0) return "overdue";
  if (days <= 90) return "urgent";
  if (days <= 365) return "pending";
  return "tracking";
}

const REGIONS = ["全部", "台灣", "美國", "歐盟", "新加坡", "國際"] as const;

export function RegulatoryCountdown() {
  const [regionFilter, setRegionFilter] = useState<string>("全部");

  const regs = useMemo(() =>
    REGULATIONS.map((r) => ({ ...r, derivedStatus: deriveStatus(r), daysLeft: calcDaysLeft(r.deadline) })),
    []
  );

  const filtered = useMemo(() =>
    regionFilter === "全部" ? regs : regs.filter((r) => r.region === regionFilter),
    [regs, regionFilter]
  );

  const counts = useMemo(() => ({
    overdue:   filtered.filter((r) => r.derivedStatus === "overdue").length,
    urgent:    filtered.filter((r) => r.derivedStatus === "urgent").length,
    pending:   filtered.filter((r) => r.derivedStatus === "pending").length,
    tracking:  filtered.filter((r) => r.derivedStatus === "tracking").length,
    completed: filtered.filter((r) => r.derivedStatus === "completed").length,
  }), [filtered]);

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <CalendarClock className="h-4 w-4" />
          法規截止倒數
        </div>
        <h2 className="mt-1 text-2xl font-semibold">監理法規時程追蹤</h2>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">
          彙整台灣、美國、歐盟、新加坡等主要金融監理機關的 PQC 相關要求與截止時程，
          供主管決策與資源規劃參考。
        </p>
        <div className="mt-2 text-xs text-muted-foreground">
          資料截至 2026-06 · 含 NIST FIPS / NSA CNSA 2.0 / EU DORA / MAS TRM / 金管會指引
        </div>
      </div>

      {/* Region Filter */}
      <div className="flex flex-wrap gap-2">
        {REGIONS.map((r) => (
          <button
            key={r}
            onClick={() => setRegionFilter(r)}
            className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
              regionFilter === r
                ? "border-blue-600 bg-blue-600 text-white"
                : "border-border bg-background text-muted-foreground hover:border-blue-400 hover:text-foreground"
            }`}
          >
            {r}
          </button>
        ))}
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        {[
          { key: "overdue",   label: "已逾期", value: counts.overdue,   color: "bg-rose-50 border-rose-200 text-rose-700" },
          { key: "urgent",    label: "緊急（90天）", value: counts.urgent,    color: "bg-orange-50 border-orange-200 text-orange-700" },
          { key: "pending",   label: "待辦（1年）", value: counts.pending,   color: "bg-blue-50 border-blue-200 text-blue-700" },
          { key: "tracking",  label: "追蹤中", value: counts.tracking,  color: "bg-slate-50 border-slate-200 text-slate-600" },
          { key: "completed", label: "已完成", value: counts.completed, color: "bg-emerald-50 border-emerald-200 text-emerald-700" },
        ].map((c) => (
          <div key={c.key} className={`rounded-xl border-2 p-4 text-center ${c.color}`}>
            <div className="text-2xl font-bold">{c.value}</div>
            <div className="mt-0.5 text-xs font-medium">{c.label}</div>
          </div>
        ))}
      </div>

      {/* Overdue Alert */}
      {counts.overdue > 0 && (
        <div className="flex items-start gap-3 rounded-xl border-2 border-rose-300 bg-rose-50 p-4 text-rose-800 dark:bg-rose-950/30 dark:text-rose-300">
          <XCircle className="mt-0.5 h-5 w-5 shrink-0" />
          <div>
            <div className="font-semibold">⚠️ {counts.overdue} 項監理要求已逾期</div>
            <div className="mt-1 text-sm">加密資產盤點（CBOM）應已完成。建議立即啟動盤點並向主管報告進度缺口。</div>
          </div>
        </div>
      )}

      {/* Regulation Cards */}
      <div className="space-y-4">
        {filtered.length === 0 && (
          <div className="py-10 text-center text-sm text-muted-foreground">此地區目前無法規資料</div>
        )}
        {filtered.map((reg) => {
          const st = STATUS_CONFIG[reg.derivedStatus];
          const Icon = st.icon;
          return (
            <Card key={reg.id} className={`border-l-4 ${reg.derivedStatus === "overdue" ? "border-l-rose-500" : reg.derivedStatus === "urgent" ? "border-l-orange-500" : reg.derivedStatus === "completed" ? "border-l-emerald-500" : reg.derivedStatus === "pending" ? "border-l-blue-500" : "border-l-slate-300"}`}>
              <CardHeader className="pb-2">
                <div className="flex flex-wrap items-start gap-2">
                  <CardTitle className="text-base leading-snug">{reg.name}</CardTitle>
                  <div className="ml-auto flex shrink-0 items-center gap-2">
                    <Badge variant="outline" className="text-xs">{reg.region}</Badge>
                    <span className={`flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-medium ${st.bg} ${st.color}`}>
                      <Icon className="h-3 w-3" />
                      {st.label}
                    </span>
                  </div>
                </div>
                <div className="text-xs text-muted-foreground">{reg.authority}</div>
              </CardHeader>
              <CardContent className="space-y-3">
                {/* Countdown */}
                <div className={`flex items-center gap-3 rounded-lg border p-3 ${st.bg}`}>
                  <CalendarClock className={`h-4 w-4 shrink-0 ${st.color}`} />
                  <div>
                    <div className={`text-sm font-semibold ${st.color}`}>
                      截止日：{reg.deadlineLabel}
                    </div>
                    {reg.daysLeft !== null && reg.derivedStatus !== "completed" && (
                      <div className={`text-xs ${st.color}`}>
                        {reg.daysLeft < 0
                          ? `已逾期 ${Math.abs(reg.daysLeft)} 天`
                          : `距今 ${reg.daysLeft} 天`}
                      </div>
                    )}
                    {reg.derivedStatus === "completed" && (
                      <div className="text-xs text-emerald-600">已達成 / 已生效</div>
                    )}
                  </div>
                </div>

                {/* Requirement */}
                <div>
                  <div className="mb-1 text-xs font-semibold text-muted-foreground">要求摘要</div>
                  <p className="text-sm leading-relaxed">{reg.requirement}</p>
                </div>

                {/* Scope & Reference */}
                <div className="flex flex-wrap gap-4 text-xs text-muted-foreground">
                  <span><span className="font-medium">適用範圍：</span>{reg.scope}</span>
                  <span><span className="font-medium">法規來源：</span>{reg.reference}</span>
                </div>

                {/* Data Freshness */}
                <div className="flex flex-wrap gap-3 border-t pt-2 text-xs">
                  <span className="text-muted-foreground">
                    📅 <span className="font-medium">資料截至：</span>{reg.dataAsOf}
                  </span>
                  <span className="text-muted-foreground">
                    🔄 <span className="font-medium">建議複查：</span>{reg.nextReviewDate}
                  </span>
                  <span className="ml-auto italic text-muted-foreground/70">以官方公告為準</span>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Footer Note */}
      <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-800 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-300">
        ⚠️ <strong>免責聲明：</strong>本頁面為 POC 展示，所有法規截止日期以官方公告為準。金管會指引草案尚未正式定案，實際要求可能調整。建議定期查閱金管會官網與 NIST / NSA 最新公告。
      </div>
    </div>
  );
}
