import type { NextConfig } from "next";

// Each build gets a version id, inlined into both the client bundle and the
// server bundle at build time. /api/version reports the server's copy, so an
// app left open on a phone across a deploy can notice it's running an old
// build and offer a refresh (src/components/update-banner.tsx).
const APP_VERSION = new Date().toISOString();

const nextConfig: NextConfig = {
  env: { APP_VERSION },
};

export default nextConfig;
