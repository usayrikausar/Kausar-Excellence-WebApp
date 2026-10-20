import { execSync } from "node:child_process";
import type { NextConfig } from "next";

// Each build gets a version id, inlined into both the client bundle and the
// server bundle at build time. /api/version reports the server's copy, so an
// app left open on a phone across a deploy can notice it's running an old
// build and offer a refresh (src/components/update-banner.tsx).
//
// It must be the SAME value in both bundles. A `new Date()` here is not: the
// build evaluates this file separately for the server and client compiles,
// seconds apart, so the two copies never matched and the refresh banner
// showed forever. The git commit is stable across both (deploys build from a
// git checkout — scripts/deploy-prod.sh). Without git, both sides fall back
// to the same "dev" value, so the banner simply never shows.
function appVersion(): string {
  try {
    return execSync("git rev-parse HEAD", { stdio: ["ignore", "pipe", "ignore"] }).toString().trim();
  } catch {
    return "dev";
  }
}

const nextConfig: NextConfig = {
  env: { APP_VERSION: appVersion() },
};

export default nextConfig;
