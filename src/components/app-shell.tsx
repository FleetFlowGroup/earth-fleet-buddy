import { Link, useRouterState, useNavigate } from "@tanstack/react-router";
import {
  LayoutDashboard,
  Truck,
  Users,
  Settings,
  LogOut,
  Menu,
  X,
  FileBarChart,
  IdCard,
  CreditCard,
  Eye,
  Inbox,
  ClipboardCheck,
} from "lucide-react";
import { useState, type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { useCurrentUser } from "@/hooks/use-current-user";
import { ThemeToggle } from "@/components/theme-toggle";
import { NotificationsBell } from "@/components/notifications-bell";
import { navFor, ROLE_LABELS } from "@/lib/permissions";
import { PaymentTestModeBanner } from "@/components/PaymentTestModeBanner";
import { setOperatorPreview } from "@/lib/operator-preview";
import { useIsPlatformAdmin } from "@/hooks/use-is-platform-admin";


const ICONS: Record<string, typeof LayoutDashboard> = {
  "/dashboard": LayoutDashboard,
  "/assets": Truck,
  "/operators": IdCard,
  "/admin/prestarts": ClipboardCheck,
  "/reports": FileBarChart,
  "/team": Users,
  "/billing": CreditCard,
  "/settings": Settings,
};

export function AppShell({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { data: me } = useCurrentUser();
  const path = useRouterState({ select: (s) => s.location.pathname });

  async function signOut() {
    await qc.cancelQueries();
    qc.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  return (
    <div className="flex min-h-screen bg-background text-foreground">
      <aside className="hidden w-64 shrink-0 border-r border-sidebar-border bg-sidebar lg:flex lg:flex-col">
        <SidebarInner path={path} onSignOut={signOut} company={me?.company?.name} role={me?.role} email={me?.email} />
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <PaymentTestModeBanner />
        <header className="sticky top-0 z-20 flex h-14 items-center justify-between gap-3 border-b border-border bg-background/80 px-4 backdrop-blur lg:hidden">
          <Link to="/dashboard" className="flex items-center gap-2">
            <div className="grid size-7 place-items-center rounded-md bg-gradient-to-br from-primary to-primary/70 text-primary-foreground">
              <Truck className="size-4" />
            </div>
            <span className="text-sm font-semibold">FleetFlow</span>
          </Link>
          <div className="flex items-center gap-1">
            <NotificationsBell />
            <ThemeToggle />
            <Button variant="ghost" size="icon" onClick={() => setOpen(true)} aria-label="Open menu">
              <Menu className="size-5" />
            </Button>
          </div>
        </header>

        {open && (
          <div className="fixed inset-0 z-40 lg:hidden">
            <div className="absolute inset-0 bg-black/60" onClick={() => setOpen(false)} />
            <aside className="absolute left-0 top-0 flex h-full w-72 flex-col border-r border-sidebar-border bg-sidebar">
              <div className="flex justify-end p-2">
                <Button variant="ghost" size="icon" onClick={() => setOpen(false)}><X className="size-5" /></Button>
              </div>
              <SidebarInner path={path} onSignOut={signOut} onNavigate={() => setOpen(false)} company={me?.company?.name} role={me?.role} email={me?.email} />
            </aside>
          </div>
        )}

        <main className="min-w-0 flex-1">{children}</main>
      </div>
    </div>
  );
}

function SidebarInner({
  path,
  onSignOut,
  onNavigate,
  company,
  role,
  email,
}: {
  path: string;
  onSignOut: () => void;
  onNavigate?: () => void;
  company?: string;
  role?: string | null;
  email?: string;
}) {
  return (
    <div className="flex h-full flex-col">
      <div className="flex h-16 items-center justify-between gap-2 border-b border-sidebar-border px-5">
        <div className="flex items-center gap-2 min-w-0">
          <div className="grid size-8 shrink-0 place-items-center rounded-md bg-gradient-to-br from-primary to-primary/70 text-primary-foreground">
            <Truck className="size-4" />
          </div>
          <div className="min-w-0">
            <div className="truncate text-sm font-semibold leading-tight">FleetFlow</div>
            {company && <div className="truncate text-[11px] text-muted-foreground">{company}</div>}
          </div>
        </div>
        <div className="flex items-center gap-1">
          <NotificationsBell />
          <ThemeToggle />
        </div>
      </div>

      <nav className="flex-1 space-y-1 px-3 py-4 text-sm">
        {navFor(role as any).map((item) => {
          const active = path === item.to || path.startsWith(item.to + "/");
          const Icon = ICONS[item.to] ?? LayoutDashboard;
          return (
            <Link
              key={item.to}
              to={item.to}
              onClick={onNavigate}
              className={`flex items-center gap-3 rounded-md px-3 py-2 transition ${
                active
                  ? "bg-sidebar-accent text-sidebar-accent-foreground"
                  : "text-sidebar-foreground hover:bg-sidebar-accent/60"
              }`}
            >
              <Icon className="size-4" />
              {item.label}
            </Link>
          );
        })}
        <PlatformAdminNav email={email} path={path} onNavigate={onNavigate} />
      </nav>

      <div className="border-t border-sidebar-border p-3">
        <div className="rounded-md bg-sidebar-accent/40 px-3 py-2">
          <div className="truncate text-xs font-medium">{email}</div>
          <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{role ? (ROLE_LABELS[role] ?? role) : "—"}</div>
        </div>
        {(role === "admin" || role === "manager") && (
          <Button
            asChild
            variant="outline"
            size="sm"
            className="mt-2 w-full justify-start"
            onClick={() => setOperatorPreview(true)}
          >
            <Link to="/operator">
              <Eye className="mr-2 size-4" /> Preview operator view
            </Link>
          </Button>
        )}
        <Button
          onClick={onSignOut}
          variant="ghost"
          size="sm"
          className="mt-2 w-full justify-start text-muted-foreground hover:text-foreground"
        >
          <LogOut className="mr-2 size-4" /> Sign out
        </Button>
      </div>
    </div>
  );
}

function PlatformAdminNav({ email, path, onNavigate }: { email?: string; path: string; onNavigate?: () => void }) {
  const isPlatformAdmin = (email ?? "").toLowerCase() === PLATFORM_ADMIN_EMAIL;
  const { data: newCount } = useQuery({
    queryKey: ["contact-enquiries-new-count"],
    enabled: isPlatformAdmin,
    refetchInterval: 60_000,
    queryFn: async () => {
      const { count, error } = await supabase
        .from("contact_enquiries")
        .select("id", { count: "exact", head: true })
        .eq("status", "new");
      if (error) throw error;
      return count ?? 0;
    },
  });
  if (!isPlatformAdmin) return null;
  const to = "/admin/enquiries";
  const active = path === to || path.startsWith(to + "/");
  return (
    <Link
      to={to}
      onClick={onNavigate}
      className={`mt-3 flex items-center justify-between gap-3 rounded-md px-3 py-2 transition ${
        active
          ? "bg-sidebar-accent text-sidebar-accent-foreground"
          : "text-sidebar-foreground hover:bg-sidebar-accent/60"
      }`}
    >
      <span className="flex items-center gap-3">
        <Inbox className="size-4" />
        Enquiries
      </span>
      {!!newCount && newCount > 0 && (
        <span className="rounded-full bg-primary px-2 py-0.5 text-[10px] font-semibold text-primary-foreground">
          {newCount}
        </span>
      )}
    </Link>
  );
}

export function PageHeader({
  title,
  description,
  actions,
}: {
  title: string;
  description?: string;
  actions?: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-3 border-b border-border bg-background/60 px-4 py-5 sm:px-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
        {description && <p className="mt-1 text-sm text-muted-foreground">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}
