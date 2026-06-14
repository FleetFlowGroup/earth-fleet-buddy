import { createFileRoute } from "@tanstack/react-router";
import { useCurrentUser } from "@/hooks/use-current-user";
import { useOperatorSelf, useOperatorTargetAsset } from "@/lib/operator-data";
import { AssetPhotoGallery } from "@/lib/asset-photos";
import { Shell, Empty } from "./operator.prestart";
import { z } from "zod";

const search = z.object({ asset: z.string().uuid().optional() });

export const Route = createFileRoute("/_authenticated/operator/photos")({
  head: () => ({ meta: [{ title: "Photos · FleetFlow" }] }),
  validateSearch: search,
  component: PhotosScreen,
});

function PhotosScreen() {
  const { data: me } = useCurrentUser();
  const { asset: assetOverride } = Route.useSearch();
  const { data: op } = useOperatorSelf(me?.userId, me?.company?.id);
  const { data: asset } = useOperatorTargetAsset(op?.id, assetOverride);
  return (
    <Shell title="Upload photos">
      {!asset || !me?.company?.id
        ? <Empty msg="No machine assigned." />
        : <AssetPhotoGallery assetId={asset.id} companyId={me.company.id} editable />}
    </Shell>
  );
}
