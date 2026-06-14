import { useEffect, useState } from "react";
import QRCode from "qrcode";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Copy, Printer, QrCode } from "lucide-react";
import { toast } from "sonner";

export function AssetQrButton({ assetId, label }: { assetId: string; label: string }) {
  const [open, setOpen] = useState(false);
  const [dataUrl, setDataUrl] = useState<string | null>(null);
  const url = typeof window !== "undefined" ? `${window.location.origin}/m/${assetId}` : `/m/${assetId}`;

  useEffect(() => {
    if (!open) return;
    QRCode.toDataURL(url, { width: 512, margin: 2, color: { dark: "#000000", light: "#ffffff" } })
      .then(setDataUrl)
      .catch(() => toast.error("Could not generate QR code"));
  }, [open, url]);

  function printIt() {
    if (!dataUrl) return;
    const w = window.open("", "_blank", "width=480,height=640");
    if (!w) return toast.error("Pop-up blocked");
    w.document.write(`<!doctype html><html><head><title>${label}</title>
      <style>body{font-family:system-ui,sans-serif;text-align:center;padding:40px}img{width:320px;height:320px}h1{font-size:22px;margin:16px 0 4px}p{color:#555;margin:0}</style>
      </head><body><img src="${dataUrl}" alt="QR"/><h1>${label}</h1><p>${url}</p></body></html>`);
    w.document.close();
    w.focus();
    setTimeout(() => w.print(), 250);
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm"><QrCode className="mr-2 size-4" />QR code</Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader><DialogTitle>{label}</DialogTitle></DialogHeader>
        <div className="grid place-items-center gap-4 py-2">
          {dataUrl ? (
            <img src={dataUrl} alt="QR code" className="size-64 rounded-md border border-border bg-white p-3" />
          ) : (
            <div className="size-64 animate-pulse rounded-md bg-muted" />
          )}
          <p className="break-all text-center text-xs text-muted-foreground">{url}</p>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => { navigator.clipboard.writeText(url); toast.success("Link copied"); }}>
              <Copy className="mr-2 size-4" />Copy link
            </Button>
            <Button size="sm" onClick={printIt}><Printer className="mr-2 size-4" />Print</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
