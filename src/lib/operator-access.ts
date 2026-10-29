/** UI/query gates only; database authorisation remains unchanged. */
export function canRunAdminQueries(role: string | null | undefined): boolean {
  return !!role && role !== "operator";
}

export function isOperatorPath(path: string): boolean {
  return path === "/operator" || path.startsWith("/operator/");
}

export function isSubscriptionExemptPath(path: string): boolean {
  return path.startsWith("/billing") || path.startsWith("/onboarding") || isOperatorPath(path);
}

type LoadedAccount = { hasCompany: boolean };

export function authenticatedRedirectDestination(
  role: string | null | undefined,
  path: string,
  preview: boolean,
  account?: LoadedAccount | null,
): "/onboarding" | "/operator" | undefined {
  if (account === null) return undefined;
  if (account && !account.hasCompany) {
    return path.startsWith("/onboarding") ? undefined : "/onboarding";
  }
  if (role === "operator" && !preview && !isOperatorPath(path)) return "/operator";
  return undefined;
}

export function shouldRenderAuthedOutlet(
  role: string | null | undefined,
  path: string,
  preview: boolean,
  loading = false,
  errored = false,
  account?: LoadedAccount | null,
): boolean {
  if (loading || errored || account === null) return false;
  if (account && !account.hasCompany) return path.startsWith("/onboarding");
  if (!role) return false;
  return role !== "operator" || isOperatorPath(path) || preview;
}

export function operatorPostLoginDestination(
  role: string | null | undefined,
  redirect: string | undefined,
  lastRoute: string | null,
  invite?: string,
  account?: LoadedAccount,
): string {
  if (invite) return `/join/${invite}`;
  if (account && !account.hasCompany) return "/onboarding";
  const safeRedirect = redirect?.startsWith("/") && !redirect.startsWith("//") ? redirect : undefined;
  if (role !== "operator") return safeRedirect ?? lastRoute ?? "/dashboard";
  const allowed = (path: string | null | undefined) =>
    !!path && (isOperatorPath(path) || path.startsWith("/m/"));
  if (allowed(safeRedirect)) return safeRedirect ?? "/operator";
  if (allowed(lastRoute)) return lastRoute ?? "/operator";
  return "/operator";
}