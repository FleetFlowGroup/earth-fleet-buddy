// Thin native bridge. Every function is a safe no-op on the website, so the
// web build/behaviour is unchanged. Plugins are dynamically imported only when
// running inside the Capacitor iOS shell.
import { Capacitor } from "@capacitor/core";

export const isNativeApp = (): boolean =>
  typeof window !== "undefined" && Capacitor.isNativePlatform();

export const nativePlatform = (): "ios" | "android" | "web" =>
  (typeof window === "undefined" ? "web" : (Capacitor.getPlatform() as "ios" | "android" | "web"));

/** Native camera → File (falls back to null on web so callers keep using <input type=file>). */
export async function takeNativePhoto(): Promise<File | null> {
  if (!isNativeApp()) return null;
  const { Camera, CameraResultType, CameraSource } = await import("@capacitor/camera");
  const photo = await Camera.getPhoto({ resultType: CameraResultType.Uri, source: CameraSource.Prompt, quality: 80 });
  if (!photo.webPath) return null;
  const blob = await (await fetch(photo.webPath)).blob();
  return new File([blob], `photo-${Date.now()}.${photo.format ?? "jpeg"}`, { type: blob.type || "image/jpeg" });
}

/** Ask for push permission and return the APNs token (caller stores it server-side). */
export async function registerNativePush(onToken: (token: string) => void): Promise<void> {
  if (!isNativeApp()) return;
  const { PushNotifications } = await import("@capacitor/push-notifications");
  const perm = await PushNotifications.requestPermissions();
  if (perm.receive !== "granted") return;
  await PushNotifications.addListener("registration", (t) => onToken(t.value));
  await PushNotifications.register();
}

export async function initNativeChrome(): Promise<void> {
  if (!isNativeApp()) return;
  const [{ StatusBar, Style }, { SplashScreen }] = await Promise.all([
    import("@capacitor/status-bar"),
    import("@capacitor/splash-screen"),
  ]);
  await StatusBar.setStyle({ style: Style.Dark }).catch(() => {});
  await SplashScreen.hide().catch(() => {});
}
