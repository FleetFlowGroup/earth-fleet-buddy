import type { CapacitorConfig } from "@capacitor/cli";

// FleetFlow iOS shell. Approach: "hosted" — the WKWebView loads the live
// TanStack Start app from https://fleetflow.group (SSR + server functions +
// Supabase auth keep working same-origin, no CORS/auth changes needed), while
// Capacitor injects native plugins (camera, push, splash, status bar) and
// StoreKit/RevenueCat. `ios-shell/` is a bundled offline fallback only.
// See docs/IOS_IAP_PLAN.md for the tradeoffs and App Store 4.2 notes.
const config: CapacitorConfig = {
  // TODO(Brody): confirm bundle id — must match the App ID you register in
  // Apple Developer → Identifiers and App Store Connect. Cannot change after release.
  appId: "group.fleetflow.app",
  appName: "FleetFlow",
  webDir: "ios-shell",
  server: {
    url: process.env.CAP_SERVER_URL ?? "https://fleetflow.group",
    // Keep navigation inside the app for our own origins only.
    allowNavigation: ["fleetflow.group", "*.fleetflow.group"],
    errorPath: "offline.html",
  },
  ios: {
    contentInset: "automatic",
    limitsNavigationsToAppBoundDomains: false,
    appendUserAgent: "FleetFlowiOS/1",
  },
  plugins: {
    SplashScreen: { launchShowDuration: 1200, launchAutoHide: true, backgroundColor: "#0b1220", showSpinner: false },
    StatusBar: { overlaysWebView: false, style: "DARK", backgroundColor: "#0b1220" },
    PushNotifications: { presentationOptions: ["badge", "sound", "alert"] },
  },
};

export default config;
