const CACHE_NAME = 'expensync-v1';
const ASSETS = [
  '/',
  '/index.html',
  '/css/styles.css',
  '/css/theme.css',
  '/js/app.js',
  '/js/utils.js',
  '/js/models/schema.js',
  '/js/views/Dashboard.js',
  '/js/views/AddExpense.js',
  '/js/views/Settlements.js',
  'https://cdn.jsdelivr.net/npm/chart.js',
  'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css',
  'https://fonts.googleapis.com/css2?family=DM+Mono:ital,wght@0,400;0,500;1,400&family=Syne:wght@400;500;600;700;800&display=swap'
];

// Install Event
self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS);
    })
  );
});

// Activate Event
self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))
      );
    })
  );
});

// Fetch Event (Network First for API, Cache First for Assets)
self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);

  // If calling local API, try network first
  if (url.origin === location.origin && url.pathname.startsWith('/api')) {
    e.respondWith(
      fetch(e.request).catch(() => caches.match(e.request))
    );
  } else {
    // For static assets, try cache first
    e.respondWith(
      caches.match(e.request).then((res) => {
        return res || fetch(e.request);
      })
    );
  }
});
