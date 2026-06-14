import { Eye, X } from "lucide-react";
import { useNavigate } from "@tanstack/react-router";
import { useOperatorPreview, setOperatorPreview } from "@/lib/operator-preview";

export function OperatorPreviewBanner() {
  const on = useOperatorPreview();
  const navigate = useNavigate();
  if (!on) return null;

  return (
    <div className="sticky top-0 z-50 flex items-center justify-between gap-3 border-b border-warning/40 bg-warning/15 px-4 py-2 text-xs text-warning-foreground backdrop-blur">
      <div className="flex min-w-0 items-center gap-2">
        <Eye className="size-3.5 shrink-0 text-warning" />
        <span className="truncate font-medium">
          Operator preview — read-only. Forms and submissions are disabled.
        </span>
      </div>
      <button
        type="button"
        onClick={() => {
          setOperatorPreview(false);
          navigate({ to: "/dashboard" });
        }}
        className="flex shrink-0 items-center gap-1 rounded-md border border-warning/40 bg-background/60 px-2 py-1 font-semibold hover:bg-background"
      >
        <X className="size-3" /> Exit preview
      </button>
    </div>
  );
}
