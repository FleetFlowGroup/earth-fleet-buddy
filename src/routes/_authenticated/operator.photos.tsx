import { createFileRoute } from "@tanstack/react-router";
import { useCurrentUser } from "@/hooks/use-current-user";
import { useOperatorSelf, useOperatorAsset } from "@/lib/operator-data";
import { AssetPhotoGallery } from "@/lib/asset-photos";
import { Shell, Empty } from "./operator.prestart";

export const Route = createFileRoute("/_authenticated/operator/photos")({
  head: () => ({ meta: [{ title: "Photos · FleetFlow" }] }),
  component: PhotosScreen,
});

function PhotosScreen() {
  const { data: me } = useCurrentUser();
  const { data: op } = useOperatorSelf(me?.userId, me?.company?.id);
  const { data: asset } = useOperatorAsset(op?.id);
  return (
    <Shell title="Upload photos">
      {!asset || !me?.company?.id
        ? <Empty msg="No machine assigned." />
        : <AssetPhotoGallery assetId={asset.id} companyId={me.company.id} editable />}
    </Shell>
  );
}
