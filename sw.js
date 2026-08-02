/* ===================================================
   SmartStaffs — Service Worker
   Handles: Caching, Background Sync, Push Notifications
   =================================================== */

const CACHE_NAME = 'staffsync-cache-v2';
const urlsToCache = [
  './',
  './index.html',
  './styles.css',
  './app.js'
];

// ─── Supabase config (mirrored from app.js) ─────────
const SUPABASE_URL = 'https://dkroffwlvegsrkjowljb.supabase.co';
const SUPABASE_KEY = 'sb_publishable_SZJEfW2zbYx4kiLwyqxdKg_VNONEVwA';

// ─── Install ─────────────────────────────────────────
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(urlsToCache))
  );
  self.skipWaiting();
});

// ─── Activate ────────────────────────────────────────
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// ─── Fetch (cache-first, skip Supabase) ─────────────
self.addEventListener('fetch', event => {
  if (event.request.url.includes('supabase.co') || event.request.url.includes('mixkit.co')) {
    return;
  }
  event.respondWith(
    caches.match(event.request).then(response => response || fetch(event.request))
  );
});

// ─── Background Notification Polling ─────────────────
// Store session info sent from main app
let storedSession = null;
let lastSeenNotifId = null;

self.addEventListener('message', event => {
  if (event.data && event.data.type === 'SET_SESSION') {
    storedSession = event.data.session;
    lastSeenNotifId = event.data.lastSeenId || null;
  }
  if (event.data && event.data.type === 'CLEAR_SESSION') {
    storedSession = null;
    lastSeenNotifId = null;
  }
});

// ─── Periodic Background Sync ─────────────────────────
self.addEventListener('periodicsync', event => {
  if (event.tag === 'check-notifications') {
    event.waitUntil(checkAndShowNotifications());
  }
});

// ─── Push (for future Web Push integration) ──────────
self.addEventListener('push', event => {
  let data = { title: 'SmartStaffs', body: 'You have a new notification.' };
  try { data = event.data.json(); } catch (e) {}
  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: './logo.png',
      badge: './logo.png',
      tag: 'staffsync-push',
      renotify: true,
      data: { url: './' }
    })
  );
});

// ─── Notification Click ───────────────────────────────
self.addEventListener('notificationclick', event => {
  event.notification.close();
  const targetUrl = (event.notification.data && event.notification.data.url) || './';
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(clientList => {
      for (const client of clientList) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          return client.focus();
        }
      }
      if (clients.openWindow) return clients.openWindow(targetUrl);
    })
  );
});

// ─── Core: Poll Supabase & Show Native Notification ──
async function checkAndShowNotifications() {
  // Try reading session from IndexedDB if not in memory
  const session = storedSession || (await getSessionFromIDB());
  if (!session || !session.id) return;

  try {
    const url = `${SUPABASE_URL}/rest/v1/notifications?user_id=eq.${session.id}&is_read=eq.false&order=created_at.desc&limit=5`;
    const res = await fetch(url, {
      headers: {
        'apikey': SUPABASE_KEY,
        'Authorization': `Bearer ${SUPABASE_KEY}`,
        'Content-Type': 'application/json'
      }
    });

    if (!res.ok) return;
    const notifs = await res.json();
    if (!notifs || notifs.length === 0) return;

    // Only show notifs newer than what we've already seen
    const newNotifs = lastSeenNotifId
      ? notifs.filter(n => n.id > lastSeenNotifId)
      : notifs;

    if (newNotifs.length === 0) return;

    // Check if app window is currently focused — skip native notif if open & visible
    const allClients = await clients.matchAll({ type: 'window', includeUncontrolled: true });
    const appIsVisible = allClients.some(c => !c.hidden);

    // Always update last seen
    lastSeenNotifId = notifs[0].id;
    await saveSessionToIDB(session, lastSeenNotifId);

    if (appIsVisible) return; // App is open, in-app UI handles it

    // Show native OS notification for each new item
    for (const notif of newNotifs.slice(0, 3)) {
      await self.registration.showNotification(notif.title || 'SmartStaffs', {
        body: notif.message || 'You have a new notification.',
        icon: './logo.png',
        badge: './logo.png',
        tag: `staffsync-notif-${notif.id}`,
        renotify: true,
        silent: false,
        data: { url: './', notifId: notif.id }
      });
    }
  } catch (err) {
    console.error('[SW] checkAndShowNotifications error:', err);
  }
}

// ─── IndexedDB helpers (persist session across SW restarts) ──
function openIDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open('staffsync-sw', 1);
    req.onupgradeneeded = e => {
      e.target.result.createObjectStore('session', { keyPath: 'key' });
    };
    req.onsuccess = e => resolve(e.target.result);
    req.onerror = e => reject(e.target.error);
  });
}

async function saveSessionToIDB(session, lastId) {
  try {
    const db = await openIDB();
    const tx = db.transaction('session', 'readwrite');
    tx.objectStore('session').put({ key: 'current', session, lastId });
  } catch (e) {}
}

async function getSessionFromIDB() {
  try {
    const db = await openIDB();
    return new Promise((resolve) => {
      const tx = db.transaction('session', 'readonly');
      const req = tx.objectStore('session').get('current');
      req.onsuccess = e => {
        const record = e.target.result;
        if (record) {
          storedSession = record.session;
          lastSeenNotifId = record.lastId;
          resolve(record.session);
        } else {
          resolve(null);
        }
      };
      req.onerror = () => resolve(null);
    });
  } catch (e) {
    return null;
  }
}
