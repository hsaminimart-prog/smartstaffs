/* ===================================================
   SmartStaffs — Service Worker v3
   Background notification delivery even when app is closed
   =================================================== */

const CACHE_NAME = 'staffsync-cache-v3';
const urlsToCache = ['./', './index.html', './styles.css', './app.js'];

const SUPABASE_URL = 'https://dkroffwlvegsrkjowljb.supabase.co';
const SUPABASE_KEY = 'sb_publishable_SZJEfW2zbYx4kiLwyqxdKg_VNONEVwA';

// ─── Session state ────────────────────────────────────
let storedSession = null;
let lastSeenTimestamp = null; // ISO string — use created_at not UUID for comparison
let _pollTimer = null;

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
  // Start polling loop once activated
  startPolling();
});

// ─── Fetch ───────────────────────────────────────────
self.addEventListener('fetch', event => {
  if (
    event.request.url.includes('supabase.co') ||
    event.request.url.includes('mixkit.co') ||
    event.request.url.includes('unpkg.com')
  ) {
    return;
  }
  event.respondWith(
    caches.match(event.request).then(r => r || fetch(event.request))
  );
});

// ─── Messages from main app ───────────────────────────
self.addEventListener('message', event => {
  const data = event.data;
  if (!data) return;

  if (data.type === 'SET_SESSION') {
    storedSession = data.session;
    startPolling(); // restart poll with new session
  }

  if (data.type === 'CLEAR_SESSION') {
    storedSession = null;
    lastSeenTimestamp = null;
    stopPolling();
  }

  // Main page asks SW to show a notification directly
  if (data.type === 'SHOW_NOTIFICATION') {
    self.registration.showNotification(data.title || 'SmartStaffs', {
      body: data.body || '',
      icon: './logo.png',
      badge: './logo.png',
      tag: data.tag || 'staffsync-notif',
      renotify: true,
      data: { url: './' }
    });
  }
});

// ─── Periodic Background Sync (Chrome PWA only) ──────
self.addEventListener('periodicsync', event => {
  if (event.tag === 'check-notifications') {
    event.waitUntil(checkAndShowNotifications());
  }
});

// ─── Push (future Web Push integration) ──────────────
self.addEventListener('push', event => {
  let d = { title: 'SmartStaffs', body: 'You have a new notification.' };
  try { d = event.data.json(); } catch (e) {}
  event.waitUntil(
    self.registration.showNotification(d.title, {
      body: d.body,
      icon: './logo.png',
      badge: './logo.png',
      tag: 'staffsync-push',
      renotify: true,
      data: { url: './' }
    })
  );
});

// ─── Notification click → open app ───────────────────
self.addEventListener('notificationclick', event => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || './';
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(list => {
      for (const c of list) {
        if ('focus' in c) return c.focus();
      }
      if (clients.openWindow) return clients.openWindow(url);
    })
  );
});

// ─── Polling Engine ───────────────────────────────────
// The SW keeps itself alive by scheduling recurring checks.
// When the app page is open, the main thread handles notifications;
// the SW only fires native popups when no app window is visible.

function startPolling() {
  stopPolling(); // clear any existing timer
  schedulePoll();
}

function stopPolling() {
  if (_pollTimer) {
    clearTimeout(_pollTimer);
    _pollTimer = null;
  }
}

function schedulePoll() {
  // Poll every 60 seconds
  _pollTimer = setTimeout(async () => {
    await checkAndShowNotifications();
    schedulePoll(); // schedule next
  }, 60 * 1000);
}

// ─── Core: fetch Supabase & show notifications ────────
async function checkAndShowNotifications() {
  // Try to get session — first from memory, then from IndexedDB
  let session = storedSession;
  if (!session) {
    session = await getSessionFromIDB();
  }
  if (!session || !session.id) return;

  // Get lastSeen from memory or IDB
  if (!lastSeenTimestamp) {
    const idbData = await getIDBData();
    if (idbData) lastSeenTimestamp = idbData.lastSeen;
  }

  // Check if any app window is currently visible
  const allClients = await clients.matchAll({ type: 'window', includeUncontrolled: true });
  const appIsVisible = allClients.some(c => !c.hidden && c.visibilityState !== 'hidden');
  if (appIsVisible) return; // In-app UI is handling it

  try {
    // Build query — only unread notifications newer than last seen
    let query = `user_id=eq.${session.id}&is_read=eq.false&order=created_at.desc&limit=5`;
    if (lastSeenTimestamp) {
      // URL-encode the timestamp filter
      const ts = encodeURIComponent(lastSeenTimestamp);
      query += `&created_at=gt.${ts}`;
    }

    const res = await fetch(`${SUPABASE_URL}/rest/v1/notifications?${query}`, {
      headers: {
        'apikey': SUPABASE_KEY,
        'Authorization': `Bearer ${SUPABASE_KEY}`,
        'Accept': 'application/json'
      }
    });

    if (!res.ok) return;
    const notifs = await res.json();
    if (!notifs || notifs.length === 0) return;

    // Update last seen to newest notification
    lastSeenTimestamp = notifs[0].created_at;
    await saveIDBData(session, lastSeenTimestamp);

    // Show native OS notifications (up to 3)
    for (let i = 0; i < Math.min(notifs.length, 3); i++) {
      const n = notifs[i];
      await self.registration.showNotification(n.title || 'SmartStaffs', {
        body: n.message || 'You have a new notification.',
        icon: './logo.png',
        badge: './logo.png',
        tag: `staffsync-${n.id}`,
        renotify: true,
        silent: false,
        data: { url: './' }
      });
    }
  } catch (err) {
    console.error('[SW] checkAndShowNotifications:', err);
  }
}

// ─── IndexedDB — persist session & lastSeen ──────────
function openIDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open('staffsync-sw', 2);
    req.onupgradeneeded = e => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains('data')) {
        db.createObjectStore('data', { keyPath: 'key' });
      }
    };
    req.onsuccess = e => resolve(e.target.result);
    req.onerror = () => reject(req.error);
  });
}

async function saveIDBData(session, lastSeen) {
  try {
    const db = await openIDB();
    const tx = db.transaction('data', 'readwrite');
    tx.objectStore('data').put({ key: 'sw_state', session, lastSeen });
  } catch (e) {}
}

async function getIDBData() {
  try {
    const db = await openIDB();
    return new Promise(resolve => {
      const tx = db.transaction('data', 'readonly');
      const req = tx.objectStore('data').get('sw_state');
      req.onsuccess = e => resolve(e.target.result || null);
      req.onerror = () => resolve(null);
    });
  } catch (e) { return null; }
}

async function getSessionFromIDB() {
  const d = await getIDBData();
  if (d) {
    storedSession = d.session;
    lastSeenTimestamp = d.lastSeen;
    return d.session;
  }
  return null;
}
