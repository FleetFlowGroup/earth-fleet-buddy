import { createFileRoute } from "@tanstack/react-router";
import { useCurrentUser } from "@/hooks/use-current-user";
import { useOperatorContext, useOperatorSelf, useOperatorTargetAsset } from "@/lib/operator-data";
import { AssetPhotoGallery } from "@/lib/asset-photos";
import { Shell, Empty } from "./operator.prestart";
import { Loader2 } from "lucide-react";
import { z } from "zod";

const search = z.object({ asset: z.string().uuid().optional() });

export const Route = createFileRoute("/_authenticated/operator/photos")({
  head: () => ({ meta: [{ title: "Photos · FleetFlow" }] }),
  validateSearch: search,
  component: PhotosScreen,
});

function PhotosScreen() {
  const { asset: assetOverride } = Route.useSearch();
  const { me, op, asset, state: loadState, emptyMessage } = useOperatorContext({ assetOverride });
  return (
    <Shell title="Upload photos">
      {loadState === "loading"
        ? <div className="grid place-items-center p-10"><Loader2 className="size-5 animate-spin text-muted-foreground" /></div>
        : !asset || !me?.company?.id
        ? <Empty msg={emptyMessage ?? "No machine assigned."} />
        : <AssetPhotoGallery assetId={asset.id} companyId={me.company.id} editable />}
    </Shell>
  );
}
