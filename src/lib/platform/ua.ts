// Tiny dependency-free UA parser — good enough for analytics labels.
export type UAInfo = { device: "mobile" | "tablet" | "desktop"; browser: string; os: string };

export function parseUA(ua: string): UAInfo {
  const u = ua || "";
  const isTablet = /iPad|Tablet|PlayBook|Silk|Android(?!.*Mobile)/i.test(u);
  const isMobile = /Mobi|iPhone|Android.*Mobile|Windows Phone|IEMobile|Opera Mini/i.test(u);
  const device: UAInfo["device"] = isTablet ? "tablet" : isMobile ? "mobile" : "desktop";

  let browser = "Other";
  if (/Edg\//.test(u)) browser = "Edge";
  else if (/OPR\//.test(u)) browser = "Opera";
  else if (/Chrome\//.test(u) && !/Chromium/.test(u)) browser = "Chrome";
  else if (/Firefox\//.test(u)) browser = "Firefox";
  else if (/Safari\//.test(u) && /Version\//.test(u)) browser = "Safari";

  let os = "Other";
  if (/Windows NT/.test(u)) os = "Windows";
  else if (/Mac OS X/.test(u)) os = "macOS";
  else if (/Android/.test(u)) os = "Android";
  else if (/iPhone|iPad|iPod/.test(u)) os = "iOS";
  else if (/Linux/.test(u)) os = "Linux";

  return { device, browser, os };
}

export function getOrCreateVisitorId(): string {
  if (typeof window === "undefined") return "";
  try {
    const KEY = "ff-visitor-id";
    let v = localStorage.getItem(KEY);
    if (!v) {
      v = (crypto.randomUUID?.() ?? Math.random().toString(36).slice(2) + Date.now().toString(36));
      localStorage.setItem(KEY, v);
    }
    return v;
  } catch {
    return "";
  }
}
