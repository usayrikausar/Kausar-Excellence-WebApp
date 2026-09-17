// Re-asserts minInstances=1 on the Next.js SSR Cloud Function after every
// hosting deploy. Firebase's own tooling refuses to set this in
// firebase.json's frameworksBackend config ("Function ssrkausarexcellenceweba
// has minInstances set and is in a rewrite pinTags=true. These features are
// not currently compatible with each other."), so it has to be applied
// out-of-band via the Cloud Functions v2 API directly. Because a fresh
// `firebase deploy` doesn't know about this setting, it's not preserved
// automatically — this script (called by deploy-prod.sh after every hosting
// deploy) is what keeps it from silently reverting to the scale-to-zero
// default and reintroducing cold starts.
//
// Usage:
//   node scripts/ensure-min-instances.mjs <path to service-account.json>

import { readFileSync } from "node:fs";
import { GoogleAuth } from "google-auth-library";

const keyPath = process.argv[2];
if (!keyPath) {
  console.error("Usage: node scripts/ensure-min-instances.mjs <path to service-account.json>");
  process.exit(1);
}
const serviceAccount = JSON.parse(readFileSync(keyPath, "utf8"));
if (serviceAccount.project_id !== "kausar-excellence-web-app") {
  console.error(`Refusing to run: key belongs to project "${serviceAccount.project_id}", expected "kausar-excellence-web-app".`);
  process.exit(1);
}

const FUNCTION_NAME = `projects/${serviceAccount.project_id}/locations/us-central1/functions/ssrkausarexcellenceweba`;
const TARGET_MIN_INSTANCES = 1;

const auth = new GoogleAuth({ credentials: serviceAccount, scopes: ["https://www.googleapis.com/auth/cloud-platform"] });
const client = await auth.getClient();
const token = await client.getAccessToken();

const getRes = await fetch(`https://cloudfunctions.googleapis.com/v2/${FUNCTION_NAME}`, {
  headers: { Authorization: `Bearer ${token.token}` },
});
if (!getRes.ok) {
  console.error(`Failed to read function config: ${getRes.status} ${await getRes.text()}`);
  process.exit(1);
}
const fn = await getRes.json();
const current = fn.serviceConfig?.minInstanceCount ?? 0;

if (current === TARGET_MIN_INSTANCES) {
  console.log(`minInstances already ${TARGET_MIN_INSTANCES} — nothing to do.`);
  process.exit(0);
}

console.log(`minInstances is ${current}, setting to ${TARGET_MIN_INSTANCES}...`);
const patchRes = await fetch(
  `https://cloudfunctions.googleapis.com/v2/${FUNCTION_NAME}?updateMask=serviceConfig.minInstanceCount`,
  {
    method: "PATCH",
    headers: { Authorization: `Bearer ${token.token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ serviceConfig: { minInstanceCount: TARGET_MIN_INSTANCES } }),
  },
);
if (!patchRes.ok) {
  console.error(`Failed to update minInstances: ${patchRes.status} ${await patchRes.text()}`);
  process.exit(1);
}
console.log("Update submitted (this triggers a rebuild — takes a few minutes to fully apply).");
