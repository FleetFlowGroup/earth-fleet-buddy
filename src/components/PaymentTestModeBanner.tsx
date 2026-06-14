import { getPaddleEnvironment } from "@/lib/paddle";

export function PaymentTestModeBanner() {
  if (getPaddleEnvironment() !== "sandbox") return null;
  return (
    <div className="w-full bg-amber-100 dark:bg-amber-900/30 border-b border-amber-300 dark:border-amber-700/50 px-4 py-1.5 text-center text-xs text-amber-900 dark:text-amber-200">
      Test mode — payments here use test cards, no real money. Use card{" "}
      <code className="rounded bg-amber-200/60 dark:bg-amber-800/40 px-1">4242 4242 4242 4242</code>{" "}
      with any future expiry and CVC.
    </div>
  );
}
