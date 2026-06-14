// Minimal HTML canvas signature pad. Exposes a ref handle with toDataURL/clear.
import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Eraser } from "lucide-react";

export type SignaturePadHandle = {
  isEmpty: () => boolean;
  toBlob: () => Promise<Blob | null>;
  clear: () => void;
};

export const SignaturePad = forwardRef<SignaturePadHandle, { height?: number }>(
  function SignaturePad({ height = 160 }, ref) {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const drawingRef = useRef(false);
    const lastRef = useRef<{ x: number; y: number } | null>(null);
    const [dirty, setDirty] = useState(false);

    useEffect(() => {
      const c = canvasRef.current!;
      const dpr = window.devicePixelRatio || 1;
      const resize = () => {
        const rect = c.getBoundingClientRect();
        c.width = Math.floor(rect.width * dpr);
        c.height = Math.floor(rect.height * dpr);
        const ctx = c.getContext("2d")!;
        ctx.scale(dpr, dpr);
        ctx.lineCap = "round";
        ctx.lineJoin = "round";
        ctx.strokeStyle = "#111";
        ctx.lineWidth = 2;
      };
      resize();
      window.addEventListener("resize", resize);
      return () => window.removeEventListener("resize", resize);
    }, []);

    function pos(e: PointerEvent | React.PointerEvent) {
      const c = canvasRef.current!;
      const rect = c.getBoundingClientRect();
      return { x: (e as PointerEvent).clientX - rect.left, y: (e as PointerEvent).clientY - rect.top };
    }
    function down(e: React.PointerEvent) {
      (e.target as Element).setPointerCapture(e.pointerId);
      drawingRef.current = true;
      lastRef.current = pos(e);
    }
    function move(e: React.PointerEvent) {
      if (!drawingRef.current) return;
      const p = pos(e);
      const ctx = canvasRef.current!.getContext("2d")!;
      ctx.beginPath();
      ctx.moveTo(lastRef.current!.x, lastRef.current!.y);
      ctx.lineTo(p.x, p.y);
      ctx.stroke();
      lastRef.current = p;
      if (!dirty) setDirty(true);
    }
    function up() {
      drawingRef.current = false;
      lastRef.current = null;
    }

    function clear() {
      const c = canvasRef.current!;
      const ctx = c.getContext("2d")!;
      ctx.clearRect(0, 0, c.width, c.height);
      setDirty(false);
    }

    useImperativeHandle(ref, () => ({
      isEmpty: () => !dirty,
      clear,
      toBlob: () =>
        new Promise<Blob | null>((resolve) => {
          canvasRef.current!.toBlob((b) => resolve(b), "image/png");
        }),
    }));

    return (
      <div className="space-y-2">
        <div className="rounded-md border border-border bg-white" style={{ height }}>
          <canvas
            ref={canvasRef}
            onPointerDown={down}
            onPointerMove={move}
            onPointerUp={up}
            onPointerLeave={up}
            className="h-full w-full touch-none rounded-md"
          />
        </div>
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>{dirty ? "Signed" : "Sign with your finger or mouse"}</span>
          <Button type="button" variant="ghost" size="sm" onClick={clear}>
            <Eraser className="mr-1 size-3.5" /> Clear
          </Button>
        </div>
      </div>
    );
  },
);
