const CACHE_NAME = 'Yamirla-piano-v2';
const assetsToCache = [
  'index.html',
  'style.css',
  'app.js',
  'manifest.json'
];

// Instalación del Service Worker y guardado en caché de recursos base
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('Archivos base cacheados correctamente');
      return cache.addAll(assetsToCache);
    })
  );
  self.skipWaiting();
});

// Activación y limpieza de cachés antiguas
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            console.log('Borrando caché antigua:', key);
            return caches.delete(key);
          }
        })
      );
    })
  );
  self.clients.claim();
});

// Interceptación de peticiones (Estaticos primero + caché dinámico de muestras de audio)
self.addEventListener('fetch', (event) => {
  // Omitir peticiones a dominios externos (CDNs, PayPal, etc.)
  if (!event.request.url.startsWith(self.location.origin)) {
    return;
  }

  // Omitir peticiones que no sean GET
  if (event.request.method !== 'GET') {
    return;
  }

  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      if (cachedResponse) {
        return cachedResponse;
      }

      return fetch(event.request)
        .then((networkResponse) => {
          // Si la respuesta no es válida o no es un estado 200, la devolvemos sin cachear
          if (!networkResponse || networkResponse.status !== 200 || networkResponse.type !== 'basic') {
            return networkResponse;
          }

          // Cachear dinámicamente los samples de audio (.ogg / /sonidos/)
          if (event.request.url.includes('/sonidos/')) {
            const responseClone = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(event.request, responseClone).catch((err) => {
                console.warn('No se pudo guardar la muestra de audio en caché:', err);
              });
            });
          }

          return networkResponse;
        })
        .catch(() => {
          // Fallback en caso de estar completamente offline y navegar
          if (event.request.mode === 'navigate') {
            return caches.match('index.html');
          }
        });
    })
  );
});
