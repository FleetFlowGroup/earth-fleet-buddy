import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export async function openLicenceCertificate(path?: string | null) {
  if (!path) {
    toast.info("No certificate uploaded yet");
    return;
  }
  const { data, error } = await supabase.storage
    .from("compliance-docs")
    .createSignedUrl(path, 60 * 10);
  if (error || !data?.signedUrl) {
    toast.error(error?.message ?? "Could not open certificate");
    return;
  }
  window.open(data.signedUrl, "_blank", "noopener,noreferrer");
}
