import { Link } from "@tanstack/react-router";
import { Bell, CheckCircle2, AlertTriangle, Clock } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { useCurrentUser } from "@/hooks/use-current-user";
import { useNotifications } from "@/lib/notifications";
import { formatDistanceToNow } from "date-fns";

export function NotificationsBell() {
  const { data: me } = useCurrentUser();
  const { data: notifs } = useNotifications(me?.company?.id);
  const items = notifs ?? [];
  const urgent = items.filter((n) => n.tone === "danger").length;

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative" aria-label="Notifications">
          <Bell className="size-5" />
          {urgent > 0 && (
            <span className="absolute -right-0.5 -top-0.5 grid min-w-4 size-4 place-items-center rounded-full bg-destructive px-1 text-[10px] font-bold text-destructive-foreground">
              {urgent > 9 ? "9+" : urgent}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-[340px] p-0">
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <div>
            <div className="text-sm font-semibold">Notifications</div>
            <div className="text-[11px] text-muted-foreground">{items.length} item{items.length === 1 ? "" : "s"}</div>
          </div>
        </div>
        <div className="max-h-[60vh] overflow-y-auto">
          {items.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-2 px-4 py-10 text-center">
              <CheckCircle2 className="size-6 text-success" />
              <div className="text-sm font-medium">All caught up</div>
              <p className="text-xs text-muted-foreground">Nothing needs your attention.</p>
            </div>
          ) : (
            <ul className="divide-y divide-border">
              {items.slice(0, 20).map((n) => {
                const dot = n.tone === "danger" ? "bg-destructive" : n.tone === "warning" ? "bg-warning" : n.tone === "success" ? "bg-success" : "bg-primary";
                const inner = (
                  <div className="flex gap-3 px-4 py-3 hover:bg-accent/40">
                    <span className={`mt-1 size-2 shrink-0 rounded-full ${dot}`} />
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-medium">{n.title}</div>
                      <div className="truncate text-xs text-muted-foreground">{n.detail}</div>
                      {n.when && <div className="mt-0.5 text-[10px] text-muted-foreground"><Clock className="mr-0.5 inline size-2.5" />{formatDistanceToNow(new Date(n.when), { addSuffix: true })}</div>}
                    </div>
                  </div>
                );
                return (
                  <li key={n.id}>
                    {n.to ? <Link {...(n.to as any)}>{inner}</Link> : inner}
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
