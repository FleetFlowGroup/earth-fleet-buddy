// Pure resolver for the operator portal's load state. Direct deep links
// (e.g. /operator/defect?asset=…) render before the current user, operator row
// and asset queries have resolved; treating "undefined" as "not found" flashed
// "No machine assigned" / "Operator profile not linked". Only report a missing
// operator/asset once every query it depends on has actually settled.
export type QueryLike<T> = { data: T | undefined; isPending: boolean; isError?: boolean };

export type OperatorLoadState = "loading" | "no-company" | "no-operator" | "no-asset" | "ready";

export function resolveOperatorLoadState(input: {
  me: QueryLike<{ company?: { id: string } | null } | null>;
  op: QueryLike<unknown | null>;
  asset?: QueryLike<unknown | null>;
  /** Asset supplied by ?asset= deep link; op row is not required to load it. */
  hasAssetOverride?: boolean;
  /** Screen needs an asset (prestart/defect/hours/photos) vs only an operator row (tickets). */
  needsAsset?: boolean;
}): OperatorLoadState {
  const { me, op, asset, hasAssetOverride = false, needsAsset = true } = input;
  if (me.isPending) return "loading";
  if (!me.data?.company?.id) return "no-company";

  if (!needsAsset) {
    if (op.isPending && !op.isError) return "loading";
    return op.data ? "ready" : "no-operator";
  }

  if (!hasAssetOverride) {
    if (op.isPending && !op.isError) return "loading";
    if (!op.data) return "no-operator";
  }
  if (!asset || (asset.isPending && !asset.isError)) return "loading";
  return asset.data ? "ready" : "no-asset";
}

export function operatorEmptyMessage(state: OperatorLoadState, kind: "asset" | "operator" = "asset"): string | null {
  switch (state) {
    case "no-company": return "Your account isn't linked to a company yet.";
    case "no-operator": return kind === "operator" ? "Operator profile not linked." : "Operator profile not linked, so no machine can be assigned yet.";
    case "no-asset": return "No machine assigned.";
    default: return null;
  }
}
