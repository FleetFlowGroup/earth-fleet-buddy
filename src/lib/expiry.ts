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

// Which meter applies to an asset type.
// Trucks & road vehicles → kilometres only. Plant/machinery → engine hours only.
const KM_TYPES = new Set([
  "vehicle",
  "truck",
  "prime_mover",
  "trailer",
  "ute",
  "car",
  "dump_truck",
]);

export type MeterMode = "km" | "hours";

export function assetMeterMode(type: string | null | undefined): MeterMode {
  return type && KM_TYPES.has(type) ? "km" : "hours";
}

// Warning thresholds for upcoming services
export const SERVICE_WARN_HOURS = 50;
export const SERVICE_WARN_KM = 500;
export const SERVICE_WARN_DAYS = 14;

export type ServiceDue = {
  mode: MeterMode;
  remaining: number; // negative = overdue
  dueAt: number; // meter value at which service is due
  current: number;
  overdue: boolean;
  warning: boolean; // within threshold
  label: string; // "Due in 32 h" / "Overdue by 18 km"
  // Optional time-based component (works alongside meter-based)
  dueDate?: string | null; // ISO date for next service if time interval set
  daysRemaining?: number | null;
};

export function computeServiceDue(asset: any): ServiceDue | null {
  const mode = assetMeterMode(asset?.type);
  let result: ServiceDue | null = null;

  if (mode === "km") {
    const interval = asset.service_interval_km;
    const current = asset.odometer;
    // If we never recorded a "last service" reading, assume the cycle starts
    // from the current meter — otherwise the asset looks wildly overdue.
    const last = asset.last_service_odometer ?? current;
    if (interval != null && current != null) {
      const dueAt = Number(last) + Number(interval);
      const remaining = dueAt - Number(current);
      const overdue = remaining < 0;
      const warning = !overdue && remaining <= SERVICE_WARN_KM;
      result = {
        mode, remaining, dueAt, current: Number(current), overdue, warning,
        label: overdue
          ? `Overdue by ${Math.abs(remaining).toLocaleString()} km`
          : `Due in ${remaining.toLocaleString()} km`,
      };
    }
  } else {
    const interval = asset.service_interval_hours;
    const current = asset.engine_hours;
    const last = asset.last_service_hours ?? current;
    if (interval != null && current != null) {
      const dueAt = Number(last) + Number(interval);
      const remaining = dueAt - Number(current);
      const overdue = remaining < 0;
      const warning = !overdue && remaining <= SERVICE_WARN_HOURS;
      result = {
        mode, remaining, dueAt, current: Number(current), overdue, warning,
        label: overdue
          ? `Overdue by ${Math.abs(remaining).toFixed(0)} h`
          : `Due in ${remaining.toFixed(0)} h`,
      };
    }
  }

  // Add time-based info if available
  const days = asset.service_interval_days;
  const lastDate = asset.last_service_date;
  if (days != null && lastDate) {
    const due = new Date(lastDate);
    due.setDate(due.getDate() + Number(days));
    const dueIso = due.toISOString().slice(0, 10);
    const daysRemaining = daysUntil(dueIso);
    const dOverdue = daysRemaining < 0;
    const dWarn = !dOverdue && daysRemaining <= SERVICE_WARN_DAYS;
    if (!result) {
      result = {
        mode, remaining: daysRemaining, dueAt: 0, current: 0,
        overdue: dOverdue, warning: dWarn,
        label: dOverdue ? `Overdue by ${Math.abs(daysRemaining)} d` : `Due in ${daysRemaining} d`,
        dueDate: dueIso, daysRemaining,
      };
    } else {
      result.dueDate = dueIso;
      result.daysRemaining = daysRemaining;
      // escalate severity if time-based is worse
      if (dOverdue && !result.overdue) {
        result.overdue = true;
        result.label = `Overdue by ${Math.abs(daysRemaining)} d`;
      } else if (dWarn && !result.warning && !result.overdue) {
        result.warning = true;
      }
    }
  }
  return result;
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
