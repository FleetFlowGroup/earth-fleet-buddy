import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import { useEffect, type ReactNode } from "react";

import appCss from "../styles.css?url";
import fleetflowLogo from "@/assets/fleetflow-logo.png.asset.json";
import { reportLovableError } from "../lib/lovable-error-reporting";
import { Toaster } from "@/components/ui/sonner";
import { supabase } from "@/integrations/supabase/client";
import { PresenceTracker } from "@/components/presence-tracker";
import { isMissionHost } from "@/lib/platform/host";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold brand-gradient-text">404</h1>
        <h2 className="mt-4 text-xl font-semibold">Page not found</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          The page you're looking for doesn't exist or has been moved.
        </p>
        <div className="mt-6">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Go home
          </Link>
        </div>
      </div>
    </div>
  );
}

function isChunkLoadError(error: unknown): boolean {
  const msg = error instanceof Error ? `${error.name} ${error.message}` : String(error ?? "");
  return /Importing a module script failed|Failed to fetch dynamically imported module|ChunkLoadError|Loading chunk [\d]+ failed|error loading dynamically imported module/i.test(
    msg,
  );
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  console.error(error);
  const router = useRouter();
  useEffect(() => {
    if (isChunkLoadError(error) && typeof window !== "undefined") {
      // App was redeployed; old chunks are gone. Hard reload to grab the new bundle.
      const KEY = "ff-chunk-reload";
      const last = Number(sessionStorage.getItem(KEY) ?? "0");
      if (Date.now() - last > 10_000) {
        sessionStorage.setItem(KEY, String(Date.now()));
        window.location.reload();
        return;
      }
    }
    reportLovableError(error, { boundary: "tanstack_root_error_component" });
  }, [error]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="surface-card max-w-md p-8 text-center">
        <h1 className="text-xl font-semibold tracking-tight">This page didn't load</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Something went wrong on our end. Try again, or head back home.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <button
            onClick={() => {
              if (isChunkLoadError(error) && typeof window !== "undefined") {
                window.location.reload();
                return;
              }
              router.invalidate();
              reset();
            }}
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Try again
          </button>
          <a
            href="/"
            className="inline-flex items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium transition-colors hover:bg-accent"
          >
            Go home
          </a>
        </div>
      </div>
    </div>
  );
}


export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { name: "google-site-verification", content: "7B-VRneHZDDPWU1YXzNHoJ_kSqlh15HSLNMhBBlDx14" },
      { title: "FleetFlow — Digital Pre-Starts & Fleet Management for Earthmoving Businesses" },
      {
        name: "description",
        content:
          "FleetFlow helps earthmoving, civil, and plant hire businesses replace paper pre-start books with digital inspections, fleet tracking, and compliance management — all from one platform.",
      },
      { name: "author", content: "FleetFlow" },
      { name: "theme-color", content: "#0A0F1C" },
      { property: "og:title", content: "FleetFlow — Digital Pre-Starts & Fleet Management for Earthmoving Businesses" },
      {
        property: "og:description",
        content:
          "FleetFlow helps earthmoving, civil, and plant hire businesses replace paper pre-start books with digital inspections, fleet tracking, and compliance management — all from one platform.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: "FleetFlow — Digital Pre-Starts & Fleet Management for Earthmoving Businesses" },
      {
        name: "twitter:description",
        content:
          "FleetFlow helps earthmoving, civil, and plant hire businesses replace paper pre-start books with digital inspections, fleet tracking, and compliance management — all from one platform.",
      },
      { property: "og:image", content: "https://fleetflow.group/logo.png" },
      { property: "og:image:alt", content: "FleetFlow logo" },
      { name: "twitter:image", content: "https://fleetflow.group/logo.png" },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "icon", type: "image/png", href: "/favicon.png" },
      { rel: "apple-touch-icon", href: "/favicon.png" },
      { rel: "preconnect", href: "https://czsvzcysnppmzlyfzrhv.supabase.co", crossOrigin: "anonymous" },
      { rel: "dns-prefetch", href: "https://czsvzcysnppmzlyfzrhv.supabase.co" },
    ],
    scripts: [
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@graph": [
            {
              "@type": "Organization",
              name: "FleetFlow",
              url: "https://fleetflow.group",
              logo: "https://fleetflow.group/logo.png",
              description:
                "Digital pre-starts, fleet management, and compliance for Australian earthmoving, civil, and plant hire businesses.",
            },
            { "@type": "WebSite", name: "FleetFlow", url: "https://fleetflow.group" },
          ],
        }),
      },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: ReactNode }) {
  const themeScript = `(function(){try{var t=localStorage.getItem('fleetflow-theme');if(!t){t=window.matchMedia&&window.matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light';}if(t==='dark'){document.documentElement.classList.add('dark');}document.documentElement.style.colorScheme=t;}catch(e){}})();`;
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <HeadContent />
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();
  const router = useRouter();

  // Mission subdomain: force every non-platform request to the Mission Control
  // entry. The customer marketing app is invisible here. Real access is still
  // gated by the platform_admins RPC inside /_platform.
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!isMissionHost(window.location.hostname)) return;
    const p = window.location.pathname;
    // Allow /platform/* and /auth (admins still need to sign in here).
    if (p.startsWith("/platform") || p.startsWith("/auth")) return;
    router.navigate({ to: "/platform/mission-control", replace: true });
  }, [router]);

  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event !== "SIGNED_IN" && event !== "SIGNED_OUT" && event !== "USER_UPDATED") return;
      router.invalidate();
      if (event !== "SIGNED_OUT") queryClient.invalidateQueries();
    });
    return () => sub.subscription.unsubscribe();
  }, [router, queryClient]);

  return (
    <QueryClientProvider client={queryClient}>
      <PresenceTracker />
      <Outlet />
      <Toaster richColors position="top-right" />
    </QueryClientProvider>
  );
}
