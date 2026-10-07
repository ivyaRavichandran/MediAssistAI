const CACHE_NAME = 'mediassist-v3';
const ASSETS_TO_CACHE = [
    '/',
    '/index.html',
    '/manifest.json',
    '/css/styles.css',
    '/js/app.js',
    '/js/auth.js',
    '/js/firebase.js',
    '/js/prescription.js',
    '/js/medications.js',
    '/js/refills.js',
    '/js/interactions.js',
    '/js/reminders.js',
    '/js/medicine-info.js',
    '/js/wearable.js',
    '/js/push.js',
    'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css',
    'https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap'
];

// Install event
self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => {
            return cache.addAll(ASSETS_TO_CACHE);
        })
    );
    self.skipWaiting();
});

// Activate event
self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((cacheNames) => {
            return Promise.all(
                cacheNames.map((cacheName) => {
                    if (cacheName !== CACHE_NAME) {
                        return caches.delete(cacheName);
                    }
                })
            );
        })
    );
    self.clients.claim();
});

// Fetch event - Network first, fallback to cache
self.addEventListener('fetch', (event) => {
    event.respondWith(
        fetch(event.request)
            .then((response) => {
                // Clone the response before caching
                const responseClone = response.clone();
                caches.open(CACHE_NAME).then((cache) => {
                    cache.put(event.request, responseClone);
                });
                return response;
            })
            .catch(() => {
                return caches.match(event.request).then((response) => {
                    if (response) {
                        return response;
                    }
                    // Return offline page for navigation requests
                    if (event.request.mode === 'navigate') {
                        return caches.match('/index.html');
                    }
                });
            })
    );
});

// Push notifications
self.addEventListener('push', (event) => {
    let payload = {};
    if (event.data) {
        try {
            payload = event.data.json();
        } catch (e) {
            payload = { body: event.data.text() };
        }
    }

    const options = {
        body: payload.body || 'Time to take your medication!',
        icon: '/assets/images/icon.png',
        badge: '/assets/images/badge.png',
        vibrate: [200, 100, 200],
        requireInteraction: true,
        tag: payload.tag || 'medication-reminder',
        data: {
            reminderId: payload.reminderId || null,
            url: payload.url || '/'
        },
        actions: [
            { action: 'taken', title: 'Mark as Taken' },
            { action: 'snooze', title: 'Snooze 10 min' }
        ]
    };

    event.waitUntil(
        self.registration.showNotification(payload.title || 'MediAssist AI', options)
    );
});

// Notification click
self.addEventListener('notificationclick', (event) => {
    event.notification.close();

    if (event.action === 'taken') {
        // Send message to client to mark dose as taken
        event.waitUntil(
            self.clients.matchAll().then((clients) => {
                clients.forEach((client) => {
                    client.postMessage({
                        type: 'DOSE_TAKEN',
                        reminderId: event.notification.data?.reminderId
                    });
                });
            })
        );
    } else if (event.action === 'snooze') {
        // Snooze for 10 minutes
        setTimeout(() => {
            self.registration.showNotification('MediAssist AI - Snoozed Reminder', {
                body: 'Don\'t forget to take your medication!',
                icon: '/assets/images/icon.png',
                vibrate: [200, 100, 200]
            });
        }, 10 * 60 * 1000);
    } else {
        // Open the app, focusing an existing tab if one is already open.
        event.waitUntil(
            self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
                const url = event.notification.data?.url || '/';
                for (const client of clientList) {
                    if (client.url.includes(self.location.origin) && 'focus' in client) {
                        client.navigate(url);
                        return client.focus();
                    }
                }
                return self.clients.openWindow(url);
            })
        );
    }
});
