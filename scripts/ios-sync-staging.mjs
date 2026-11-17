import { spawnSync } from "node:child_process";

const server = process.env.CAP_SERVER_URL ?? "";
const supabaseHost = process.env.CAP_SUPABASE_HOST ?? "";

if (!server.startsWith("https://") || server.includes("fleetflow.group")) {
  console.error(
    "Refusing to sync. Set CAP_SERVER_URL to the staging https origin. It must not be fleetflow.group.",
  );
  process.exit(1);
}
if (!supabaseHost || supabaseHost.includes("czsvzcysnppmzlyfzrhv") || supabaseHost.includes("fleetflow.group")) {
  console.error(
    "Refusing to sync. Set CAP_SUPABASE_HOST to the staging Supabase hostname. Do not use the production project.",
  );
  process.exit(1);
}

const result = spawnSync("npx", ["cap", "sync", "ios"], { stdio: "inherit", env: process.env });
process.exit(result.status ?? 1);
