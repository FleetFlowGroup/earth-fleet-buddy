export const LICENCE_TYPES: { value: string; label: string }[] = [
  { value: "hr_licence", label: "HR Licence" },
  { value: "hc_licence", label: "HC Licence" },
  { value: "mc_licence", label: "MC Licence" },
  { value: "excavator_ticket", label: "Excavator Ticket" },
  { value: "loader_ticket", label: "Loader Ticket" },
  { value: "roller_ticket", label: "Roller Ticket" },
  { value: "skid_steer_ticket", label: "Skid Steer Ticket" },
  { value: "white_card", label: "White Card" },
  { value: "first_aid", label: "First Aid" },
  { value: "working_at_heights", label: "Working at Heights" },
  { value: "confined_space", label: "Confined Space" },
  { value: "hrw_licence", label: "High Risk Work Licence" },
  { value: "forklift_licence", label: "Forklift Licence" },
  { value: "crane_licence", label: "Crane Licence" },
  { value: "custom", label: "Custom Licence" },
];

export const LICENCE_LABELS: Record<string, string> = Object.fromEntries(
  LICENCE_TYPES.map((l) => [l.value, l.label]),
);

export function licenceDisplayName(type: string, name?: string | null) {
  if (type === "custom") return name || "Custom Licence";
  return LICENCE_LABELS[type] ?? name ?? type;
}

export const OPERATOR_STATUS_LABELS: Record<string, string> = {
  active: "Active",
  inactive: "Inactive",
};
