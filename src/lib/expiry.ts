import { differenceInCalendarDays, format, parseISO } from "date-fns";

export type ExpiryStatus = "expired" | "critical" | "soon" | "ok";

export function daysUntil(date: string | Date): number {
  const d = typeof date === "string" ? parseISO(date) : date;
  return differenceInCalendarDays(d, new Date());
}

export function expiryStatus(date: string | Date): ExpiryStatus {
  const d = daysUntil(date);
  if (d < 0) return "expired";
  if (d <= 7) return "critical";
  if (d <= 30) return "soon";
  return "ok";
}

export function statusColor(status: ExpiryStatus) {
  switch (status) {
    case "expired":
      return "bg-destructive/15 text-destructive border-destructive/30";
    case "critical":
      return "bg-destructive/10 text-destructive border-destructive/25";
    case "soon":
      return "bg-warning/15 text-warning border-warning/30";
    default:
      return "bg-success/15 text-success border-success/30";
  }
}

export function statusLabel(status: ExpiryStatus, days: number) {
  if (status === "expired") return `Expired ${Math.abs(days)}d ago`;
  if (days === 0) return "Due today";
  if (days === 1) return "Due tomorrow";
  return `In ${days}d`;
}

export function fmtDate(d: string | Date) {
  const x = typeof d === "string" ? parseISO(d) : d;
  return format(x, "d MMM yyyy");
}

export const COMPLIANCE_LABELS: Record<string, string> = {
  registration: "Registration",
  insurance: "Insurance",
  service: "Service",
  inspection: "Inspection",
  permit: "Permit",
  other: "Other",
};

export const ASSET_TYPE_LABELS: Record<string, string> = {
  vehicle: "Vehicle",
  machinery: "Machinery",
  trailer: "Trailer",
  other: "Other",
};
