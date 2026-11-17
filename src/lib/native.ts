// Thin native bridge. Every function is a safe no-op on the website, so the
// web build and web behaviour stay the same. Plugins are dynamically imported
// only inside the Capacitor iOS shell.
import { Capacitor } from "@capacitor/core";
import { isFleetFlowIosUserAgent } from "@/lib/ios-store-copy";

export const isNativeApp = (): boolean =>
  typeof window !== "undefined" && Capacitor.isNativePlatform();

export const nativePlatform = (): "ios" | "android" | "web" =>
  typeof window === "undefined" ? "web" : (Capacitor.getPlatform() as "ios" | "android" | "web");

export function isAppBoundUrl(url: string): boolean {
  try {
    const parsed = new URL(url, "https://fleetflow.group");
    const host = parsed.hostname.toLowerCase();
    return host === "fleetflow.group" || host.endsWith(".fleetflow.group");
  } catch {
    return false;
  }
}

/** Open http(s) links that leave FleetFlow in SFSafariViewController on iOS. In-app routes stay in the WebView. */
export async function openExternalUrl(url: string): Promise<void> {
  if (!isNativeApp() || isAppBoundUrl(url)) {
    if (typeof window !== "undefined") window.open(url, "_blank", "noopener,noreferrer");
    return;
  }
  const { Browser } = await import("@capacitor/browser");
  await Browser.open({ url, presentationStyle: "popover" });
}

/** Native camera → File (null on web, and null when the person cancels). */
export async function takeNativePhoto(): Promise<File | null> {
  if (!isNativeApp()) return null;
  const { Camera, CameraResultType, CameraSource } = await import("@capacitor/camera");
  try {
    const photo = await Camera.getPhoto({
      resultType: CameraResultType.Uri,
      source: CameraSource.Prompt,
      quality: 80,
    });
    if (!photo.webPath) return null;
    const blob = await (await fetch(photo.webPath)).blob();
    return new File([blob], `photo-${Date.now()}.${photo.format ?? "jpeg"}`, {
      type: blob.type || "image/jpeg",
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error ?? "");
    if (/cancel/i.test(message)) return null;
    throw error;
  }
}

/** Ask for push permission and return the APNs token. Not called at launch — there is no device-token store yet. */
export async function registerNativePush(onToken: (token: string) => void): Promise<void> {
  if (!isNativeApp()) return;
  const { PushNotifications } = await import("@capacitor/push-notifications");
  const perm = await PushNotifications.requestPermissions();
  if (perm.receive !== "granted") return;
  await PushNotifications.addListener("registration", (t) => onToken(t.value));
  await PushNotifications.register();
}

export async function hapticImpact(): Promise<void> {
  if (!isNativeApp()) return;
  const { Haptics, ImpactStyle } = await import("@capacitor/haptics");
  await Haptics.impact({ style: ImpactStyle.Light }).catch(() => {});
}

/** Pull down at the top of the page to refresh. No-op on the website. */
export function bindPullToRefresh(onRefresh: () => void): () => void {
  if (!isNativeApp()) return () => {};
  let startY = 0;
  let tracking = false;
  const onStart = (event: TouchEvent) => {
    const target = event.target instanceof Element ? event.target : null;
    if (target?.closest("input, textarea, select, button, a")) return;
    if (window.scrollY > 8) return;
    startY = event.touches[0]?.clientY ?? 0;
    tracking = true;
  };
  const onEnd = (event: TouchEvent) => {
    if (!tracking) return;
    tracking = false;
    const endY = event.changedTouches[0]?.clientY ?? startY;
    if (window.scrollY <= 8 && endY - startY > 90) {
      void hapticImpact();
      onRefresh();
    }
  };
  window.addEventListener("touchstart", onStart, { passive: true });
  window.addEventListener("touchend", onEnd, { passive: true });
  return () => {
    window.removeEventListener("touchstart", onStart);
    window.removeEventListener("touchend", onEnd);
  };
}

let chromeReady = false;

export async function initNativeChrome(): Promise<void> {
  if (!isNativeApp() || chromeReady) return;
  chromeReady = true;
  document.documentElement.classList.add("ff-native");
  const [{ StatusBar, Style }, { SplashScreen }] = await Promise.all([
    import("@capacitor/status-bar"),
    import("@capacitor/splash-screen"),
  ]);
  await StatusBar.setOverlaysWebView({ overlay: false }).catch(() => {});
  await StatusBar.setBackgroundColor({ color: "#0b1220" }).catch(() => {});
  await StatusBar.setStyle({ style: Style.Dark }).catch(() => {});
  await SplashScreen.hide().catch(() => {});
  installExternalLinkGuard();
}

function installExternalLinkGuard(): void {
  document.addEventListener(
    "click",
    (event) => {
      const target = event.target instanceof Element ? event.target : null;
      const anchor = target?.closest("a");
      const href = anchor?.getAttribute("href");
      if (!href || href.startsWith("#") || href.startsWith("mailto:") || href.startsWith("tel:"))
        return;
      let url: URL;
      try {
        url = new URL(href, window.location.href);
      } catch {
        return;
      }
      if (url.protocol !== "http:" && url.protocol !== "https:") return;
      if (isAppBoundUrl(url.href)) return;
      event.preventDefault();
      void openExternalUrl(url.href);
    },
    true,
  );

  const original = window.open.bind(window);
  window.open = (url?: string | URL, target?: string, features?: string) => {
    const value = url == null ? "" : String(url);
    if (value && !isAppBoundUrl(value)) {
      void openExternalUrl(value);
      return null;
    }
    return original(url, target, features);
  };
}

export function browserLooksLikeNativeShell(): boolean {
  if (typeof navigator === "undefined") return false;
  return isNativeApp() || isFleetFlowIosUserAgent(navigator.userAgent);
}
