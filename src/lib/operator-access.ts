/** UI/query gates only; database authorisation remains unchanged. */
export function canRunAdminQueries(role: string | null | undefined): boolean {
  return !!role && role !== "operator";
}

export function shouldRenderAuthedOutlet(
  role: string | null | undefined,
  path: string,
  preview: boolean,
  loading = false,
  errored = false,
): boolean {
  if (loading || errored || !role) return false;
  return role !== "operator" || path.startsWith("/operator") || preview;
}

export function operatorPostLoginDestination(
  role: string | null | undefined,
  redirect: string | undefined,
  lastRoute: string | null,
  invite?: string,
): string {
  if (invite) return `/join/${invite}`;
  const safeRedirect = redirect?.startsWith("/") && !redirect.startsWith("//") ? redirect : undefined;
  if (role !== "operator") return safeRedirect ?? lastRoute ?? "/dashboard";
  const allowed = (path: string | null | undefined) =>
    !!path && (path.startsWith("/operator") || path.startsWith("/m/"));
  if (allowed(safeRedirect)) return safeRedirect ?? "/operator";
  if (allowed(lastRoute)) return lastRoute ?? "/operator";
  return "/operator";
}