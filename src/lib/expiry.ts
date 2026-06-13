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
  plant_inspection: "Plant inspection",
  safety_inspection: "Safety inspection",
  operator_licence: "Operator licence",
  fire_extinguisher: "Fire extinguisher",
  warranty: "Warranty",
  other: "Other",
};

export const COMPLIANCE_OPTIONS: readonly string[] = [
  "registration",
  "insurance",
  "service",
  "inspection",
  "plant_inspection",
  "safety_inspection",
  "operator_licence",
  "fire_extinguisher",
  "warranty",
  "permit",
  "other",
];

export const ASSET_TYPE_LABELS: Record<string, string> = {
  vehicle: "Vehicle",
  truck: "Truck",
  prime_mover: "Prime mover",
  trailer: "Trailer",
  ute: "Ute",
  car: "Car",
  excavator: "Excavator",
  loader: "Loader",
  skid_steer: "Skid steer",
  dozer: "Dozer",
  grader: "Grader",
  roller: "Roller",
  water_cart: "Water cart",
  dump_truck: "Dump truck",
  generator: "Generator",
  compressor: "Compressor",
  attachment: "Attachment",
  machinery: "Machinery",
  other: "Other",
};

export const ASSET_TYPE_OPTIONS: readonly string[] = [
  "truck",
  "prime_mover",
  "trailer",
  "ute",
  "car",
  "excavator",
  "loader",
  "skid_steer",
  "dozer",
  "grader",
  "roller",
  "water_cart",
  "dump_truck",
  "generator",
  "compressor",
  "attachment",
  "vehicle",
  "machinery",
  "other",
];

export const ASSET_STATUS_LABELS: Record<string, string> = {
  active: "Active",
  workshop: "In workshop",
  broken_down: "Broken down",
  sold: "Sold",
  disposed: "Disposed",
};

export const ASSET_STATUS_OPTIONS: readonly string[] = [
  "active",
  "workshop",
  "broken_down",
  "sold",
  "disposed",
];

export function statusBadgeColor(status: string) {
  switch (status) {
    case "active": return "bg-success/15 text-success border-success/30";
    case "workshop": return "bg-warning/15 text-warning border-warning/30";
    case "broken_down": return "bg-destructive/15 text-destructive border-destructive/30";
    default: return "bg-muted text-muted-foreground border-border";
  }
}

export const DOCUMENT_CATEGORIES: readonly string[] = [
  "registration",
  "insurance",
  "service",
  "warranty",
  "manual",
  "compliance",
  "photo",
  "other",
];
