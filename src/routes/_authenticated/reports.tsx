import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { AppShell, PageHeader } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentUser } from "@/hooks/use-current-user";
import {
  ASSET_STATUS_LABELS,
  ASSET_TYPE_LABELS,
  COMPLIANCE_LABELS,
  daysUntil,
  expiryStatus,
  fmtDate,
} from "@/lib/expiry";
import { Download, FileBarChart, Loader2 } from "lucide-react";
import { toast } from "sonner";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

export const Route = createFileRoute("/_authenticated/reports")({
  head: () => ({ meta: [{ title: "Reports · FleetFlow" }] }),
  component: ReportsPage,
});

type ReportKind =
  | "fleet_summary"
  | "upcoming_services"
  | "overdue"
  | "registration"
  | "insurance"
  | "service_history"
  | "compliance";

const REPORT_LABELS: Record<ReportKind, string> = {
  fleet_summary: "Fleet summary",
  upcoming_services: "Upcoming services",
  overdue: "Overdue items",
  registration: "Registration report",
  insurance: "Insurance report",
  service_history: "Service history",
  compliance: "Compliance report",
};

function ReportsPage() {
  const { data: me } = useCurrentUser();
  const companyId = me?.company?.id;
  const companyName = me?.company?.name ?? "FleetFlow";
  const [kind, setKind] = useState<ReportKind>("fleet_summary");
  const [busy, setBusy] = useState(false);

  const { data: preview, isLoading } = useQuery({
    queryKey: ["report-preview", companyId, kind],
    enabled: !!companyId,
    queryFn: () => fetchReportData(companyId!, kind),
  });

  async function download() {
    if (!companyId) return;
    setBusy(true);
    try {
      const data = await fetchReportData(companyId, kind);
      generatePdf(kind, companyName, data);
    } catch (e: any) {
      toast.error(e.message ?? "Could not generate report");
    } finally {
      setBusy(false);
    }
  }

  return (
    <AppShell>
      <PageHeader
        title="Reports"
        description="Generate downloadable PDF reports for compliance, services and fleet health."
      />

      <div className="space-y-6 p-4 sm:p-8">
        <div className="surface-card flex flex-wrap items-end gap-3 p-5">
          <div className="space-y-1.5">
            <label className="text-xs text-muted-foreground">Report type</label>
            <Select value={kind} onValueChange={(v) => setKind(v as ReportKind)}>
              <SelectTrigger className="w-60"><SelectValue /></SelectTrigger>
              <SelectContent>
                {(Object.keys(REPORT_LABELS) as ReportKind[]).map((k) => (
                  <SelectItem key={k} value={k}>{REPORT_LABELS[k]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button onClick={download} disabled={busy || !companyId}>
            {busy ? <Loader2 className="mr-2 size-4 animate-spin" /> : <Download className="mr-2 size-4" />}
            Download PDF
          </Button>
        </div>

        <div className="surface-card">
          <div className="flex items-center gap-2 border-b border-border px-5 py-4">
            <FileBarChart className="size-4 text-primary" />
            <div>
              <h3 className="text-sm font-semibold">{REPORT_LABELS[kind]} preview</h3>
              <p className="text-xs text-muted-foreground">{preview?.rows.length ?? 0} rows</p>
            </div>
          </div>
          {isLoading ? (
            <div className="grid place-items-center py-12"><Loader2 className="size-5 animate-spin text-muted-foreground" /></div>
          ) : !preview?.rows.length ? (
            <div className="px-5 py-12 text-center text-sm text-muted-foreground">No data for this report yet.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-b border-border bg-muted/40 text-left text-xs uppercase text-muted-foreground">
                  <tr>{preview.head.map((h) => <th key={h} className="px-5 py-2 font-medium">{h}</th>)}</tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {preview.rows.slice(0, 50).map((r, i) => (
                    <tr key={i}>{r.map((c, j) => <td key={j} className="px-5 py-2">{c}</td>)}</tr>
                  ))}
                </tbody>
              </table>
              {preview.rows.length > 50 && (
                <div className="border-t border-border px-5 py-3 text-xs text-muted-foreground">
                  Showing first 50 of {preview.rows.length} rows — download the PDF to see all.
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </AppShell>
  );
}

type ReportData = { head: string[]; rows: string[][] };

async function fetchReportData(companyId: string, kind: ReportKind): Promise<ReportData> {
  if (kind === "fleet_summary") {
    const { data } = await (supabase as any)
      .from("assets")
      .select("name,asset_number,type,status,registration,make,model,year,odometer,engine_hours,location")
      .eq("company_id", companyId)
      .order("name");
    return {
      head: ["Name", "Asset #", "Type", "Status", "Rego", "Make/Model", "Year", "Km", "Hours", "Location"],
      rows: (data ?? []).map((a: any) => [
        a.name, a.asset_number ?? "", ASSET_TYPE_LABELS[a.type] ?? a.type,
        ASSET_STATUS_LABELS[a.status] ?? a.status ?? "", a.registration ?? "",
        [a.make, a.model].filter(Boolean).join(" "), a.year?.toString() ?? "",
        a.odometer != null ? Number(a.odometer).toLocaleString() : "",
        a.engine_hours != null ? Number(a.engine_hours).toLocaleString() : "",
        a.location ?? "",
      ]),
    };
  }

  if (kind === "service_history") {
    const { data } = await (supabase as any)
      .from("service_history")
      .select("service_date,workshop,technician,cost,odometer_at,hours_at,notes,assets(name,registration)")
      .eq("company_id", companyId)
      .order("service_date", { ascending: false });
    return {
      head: ["Date", "Asset", "Rego", "Workshop", "Technician", "Km", "Hours", "Cost"],
      rows: (data ?? []).map((s: any) => [
        fmtDate(s.service_date),
        s.assets?.name ?? "",
        s.assets?.registration ?? "",
        s.workshop ?? "",
        s.technician ?? "",
        s.odometer_at != null ? Number(s.odometer_at).toLocaleString() : "",
        s.hours_at != null ? Number(s.hours_at).toLocaleString() : "",
        s.cost != null ? `$${Number(s.cost).toLocaleString()}` : "",
      ]),
    };
  }

  // compliance / registration / insurance / upcoming / overdue all derive from compliance_records
  const { data } = await (supabase as any)
    .from("compliance_records")
    .select("type,label,expiry_date,reference,assets(name,registration,asset_number)")
    .eq("company_id", companyId)
    .order("expiry_date");

  let rows = (data ?? []) as any[];
  if (kind === "registration") rows = rows.filter((r) => r.type === "registration");
  if (kind === "insurance") rows = rows.filter((r) => r.type === "insurance");
  if (kind === "upcoming_services") rows = rows.filter((r) => r.type === "service" && expiryStatus(r.expiry_date) !== "expired");
  if (kind === "overdue") rows = rows.filter((r) => expiryStatus(r.expiry_date) === "expired");

  return {
    head: ["Asset", "Asset #", "Rego", "Item", "Label", "Reference", "Expires", "Status"],
    rows: rows.map((r: any) => {
      const status = expiryStatus(r.expiry_date);
      const days = daysUntil(r.expiry_date);
      const statusText =
        status === "expired" ? `Expired ${Math.abs(days)}d ago` :
        days === 0 ? "Due today" :
        `In ${days}d`;
      return [
        r.assets?.name ?? "",
        r.assets?.asset_number ?? "",
        r.assets?.registration ?? "",
        COMPLIANCE_LABELS[r.type] ?? r.type,
        r.label ?? "",
        r.reference ?? "",
        fmtDate(r.expiry_date),
        statusText,
      ];
    }),
  };
}

function generatePdf(kind: ReportKind, companyName: string, data: ReportData) {
  const doc = new jsPDF({ orientation: "landscape" });
  doc.setFontSize(16);
  doc.text("FleetFlow", 14, 16);
  doc.setFontSize(12);
  doc.text(REPORT_LABELS[kind], 14, 23);
  doc.setFontSize(9);
  doc.setTextColor(120);
  doc.text(`${companyName}  ·  Generated ${fmtDate(new Date())}  ·  ${data.rows.length} rows`, 14, 28);
  doc.setTextColor(0);
  autoTable(doc, {
    startY: 33,
    head: [data.head],
    body: data.rows,
    styles: { fontSize: 8, cellPadding: 2 },
    headStyles: { fillColor: [34, 211, 238], textColor: 20 },
    alternateRowStyles: { fillColor: [245, 248, 252] },
  });
  doc.save(`fleetflow-${kind}-${new Date().toISOString().slice(0, 10)}.pdf`);
}
