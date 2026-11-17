import { useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { deleteOwnAccount } from "@/lib/delete-account.functions";
import {
  decideAccountDeletion,
  deletionErrorMessage,
  parseDeletionPreview,
  type AccountDeletionMode,
} from "@/lib/account-deletion";
import { useNativeShell } from "@/lib/use-native-shell";

export function DeleteAccountCard() {
  const nativeShell = useNativeShell();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const runDelete = useServerFn(deleteOwnAccount);
  const preview = useQuery({
    queryKey: ["account-deletion-preview"],
    retry: false,
    queryFn: async () => {
      const { data, error } = await (
        supabase as unknown as {
          rpc: (fn: string) => Promise<{ data: unknown; error: { message: string } | null }>;
        }
      ).rpc("preview_own_account_deletion");
      if (error) throw new Error(error.message);
      return parseDeletionPreview(data);
    },
  });
  const [open, setOpen] = useState(false);
  const [confirmation, setConfirmation] = useState("");
  const [secret, setSecret] = useState("");
  const [busy, setBusy] = useState(false);

  const facts = preview.data ?? { isPlatformAdmin: false, companies: [] };
  const decision = decideAccountDeletion({ ...facts, mode: null, nativeShell });
  const mode: AccountDeletionMode | null = decision.allowedModes[0] ?? null;
  const unavailable = preview.isError;

  async function submit() {
    if (!mode) return;
    setBusy(true);
    try {
      const { data: userData, error: userError } = await supabase.auth.getUser();
      if (userError || !userData.user?.email) throw new Error("reauth_required");
      const providers = userData.user.identities?.map((identity) => identity.provider) ?? [];
      if (providers.includes("email")) {
        const { error } = await supabase.auth.signInWithPassword({
          email: userData.user.email,
          password: secret,
        });
        if (error) throw new Error(error.message || "reauth_required");
      } else if (secret.trim().toLowerCase() !== userData.user.email.trim().toLowerCase()) {
        throw new Error("reauth_required");
      }
      await runDelete({ data: { mode, confirmation: "DELETE", reauthEmail: userData.user.email } });
      await qc.cancelQueries();
      qc.clear();
      await supabase.auth.signOut();
      toast.success("Your account has been deleted");
      navigate({ to: "/auth", replace: true });
    } catch (error) {
      toast.error(deletionErrorMessage(error));
      setBusy(false);
    }
  }

  return (
    <div className="surface-card border-destructive/40 p-6">
      <h3 className="text-sm font-semibold">Delete account</h3>
      <p className="mt-2 text-sm text-muted-foreground">
        {unavailable ? deletionErrorMessage(preview.error) : decision.message}
      </p>
      {decision.warnings.length > 0 && (
        <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-muted-foreground">
          {decision.warnings.map((warning) => (
            <li key={warning}>{warning}</li>
          ))}
        </ul>
      )}
      <p className="mt-3 text-xs text-muted-foreground">
        {nativeShell
          ? "Subscriptions billed by Apple keep renewing until you cancel them in Settings → Apple ID → Subscriptions. A subscription billed on the website is not cancelled here."
          : "Apple subscriptions are cancelled in Apple ID settings. A Paddle subscription is not cancelled by deleting your login — cancel it from Billing first if you are closing the company."}
      </p>
      <Button
        className="mt-4"
        variant="destructive"
        disabled={!mode || preview.isLoading}
        onClick={() => setOpen(true)}
      >
        Delete account
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete your FleetFlow account?</DialogTitle>
            <DialogDescription>
              {mode === "delete_companies"
                ? "This permanently deletes your login and the company you administer, including its fleet data for every member. Other people's logins are kept, but they lose that company."
                : "This permanently deletes your login and removes you from your company. Company records stay."}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="delete-confirm">Type DELETE to confirm</Label>
              <Input
                id="delete-confirm"
                value={confirmation}
                onChange={(event) => setConfirmation(event.target.value)}
                autoComplete="off"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="delete-secret">
                Re-enter your password, or your email if you use Google or Apple
              </Label>
              <Input
                id="delete-secret"
                type={secret.includes("@") ? "email" : "password"}
                value={secret}
                onChange={(event) => setSecret(event.target.value)}
                autoComplete="current-password"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)} disabled={busy}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              disabled={busy || confirmation !== "DELETE" || secret.length < 3}
              onClick={() => void submit()}
            >
              {busy && <Loader2 className="mr-2 size-4 animate-spin" />}
              Delete my account
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
