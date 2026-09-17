// Minimal service worker — exists only to satisfy Chrome's PWA installability
// check (a registered service worker with a fetch handler), so Android shows
// the real "Install app" prompt instead of a plain bookmark shortcut.
//
// Deliberately does NOT cache anything. This is a live dashboard with
// per-user financial/sales data behind auth — caching responses risks
// serving one daie's stale or another's cached data. Every request just
// passes straight through to the network, same as if there were no service
// worker intercepting it at all.
self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("fetch", (event) => {
  event.respondWith(fetch(event.request));
});
