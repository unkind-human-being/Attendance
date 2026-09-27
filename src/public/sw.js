// This forces Chrome to recognize the app as installable
self.addEventListener('install', (e) => {
  self.skipWaiting();
});

self.addEventListener('fetch', (e) => {
  // Chrome requires a fetch event listener to pass the PWA install criteria
});