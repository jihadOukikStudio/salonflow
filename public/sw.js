const CACHE_NAME = "salonflow-static-v1";
const STATIC_ASSETS = [
  "/brand/salonflow-mark.svg",
  "/icons/icon-192.png",
  "/icons/icon-512.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(STATIC_ASSETS)),
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key !== CACHE_NAME)
            .map((key) => caches.delete(key)),
        ),
      ),
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;

  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return;

  // Online-first on purpose: planning, rooms and anti-overbooking must always
  // use the latest server state. Only static brand assets fall back to cache.
  if (STATIC_ASSETS.includes(url.pathname)) {
    event.respondWith(
      fetch(event.request).catch(() => caches.match(event.request)),
    );
  }
});
