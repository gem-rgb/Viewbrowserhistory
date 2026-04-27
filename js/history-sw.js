/**
 * Service Worker for Brave History Access
 *
 * Intercepts fetch requests to build a navigation log, persists entries
 * in IndexedDB, and responds to messages from the main script.
 *
 * @version 2.0.0
 */

const CACHE_NAME = 'brave-history-cache-v1';

/** @type {Array<{url:string, timestamp:string, method:string, type:string}>} */
let historyLog = [];

// ─── Lifecycle Events ───────────────────────────────────────────────

self.addEventListener('install', (event) => {
    console.log('[SW] Installing…');
    self.skipWaiting();                 // Activate immediately
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => cache.addAll([]))
    );
});

self.addEventListener('activate', (event) => {
    console.log('[SW] Activating…');
    event.waitUntil(
        caches.keys()
            .then((names) => names.filter((n) => n !== CACHE_NAME))
            .then((stale) => Promise.all(stale.map((n) => caches.delete(n))))
            .then(() => self.clients.claim())     // Take control of all tabs
    );
});

// ─── Fetch: track & proxy ───────────────────────────────────────────

self.addEventListener('fetch', (event) => {
    const { url, method } = event.request;

    // Only track http(s) requests
    if (url.startsWith('http')) {
        const entry = {
            url,
            timestamp: new Date().toISOString(),
            method,
            destination: event.request.destination || 'unknown'
        };

        historyLog.push(entry);

        // Cap in-memory log at 1 000 entries
        if (historyLog.length > 1000) {
            historyLog = historyLog.slice(-1000);
        }

        // Persist asynchronously — fire-and-forget
        storeHistoryEntry(entry);
    }

    // Network-first with offline fallback
    event.respondWith(
        fetch(event.request).catch(() => caches.match(event.request))
    );
});

// ─── Message: respond to main script ────────────────────────────────

self.addEventListener('message', (event) => {
    if (!event.data) return;

    if (event.data.type === 'GET_HISTORY') {
        const response = {
            type: 'HISTORY_RESPONSE',
            history: historyLog
        };

        // Respond through the MessageChannel port if available,
        // otherwise broadcast to the requesting client.
        if (event.ports && event.ports[0]) {
            event.ports[0].postMessage(response);
        } else if (event.source) {
            event.source.postMessage(response);
        }
    }
});

// ─── IndexedDB persistence ──────────────────────────────────────────

/**
 * Open (or create) the BraveHistoryDB database.
 * Uses an auto-increment key to avoid timestamp collisions.
 *
 * @returns {Promise<IDBDatabase>}
 */
function openHistoryDB() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open('BraveHistoryDB', 2);   // v2 — new schema

        request.onerror = () => reject(request.error);
        request.onsuccess = () => resolve(request.result);

        request.onupgradeneeded = (event) => {
            const db = event.target.result;

            // Drop old store if upgrading from v1
            if (db.objectStoreNames.contains('history')) {
                db.deleteObjectStore('history');
            }

            const store = db.createObjectStore('history', {
                keyPath: 'id',
                autoIncrement: true
            });
            store.createIndex('url', 'url', { unique: false });
            store.createIndex('timestamp', 'timestamp', { unique: false });
        };
    });
}

/**
 * Persist a single history entry to IndexedDB.
 * @param {{url:string, timestamp:string, method:string, destination:string}} entry
 */
async function storeHistoryEntry(entry) {
    try {
        const db = await openHistoryDB();
        const tx = db.transaction('history', 'readwrite');
        tx.objectStore('history').add(entry);
        await new Promise((resolve, reject) => {
            tx.oncomplete = resolve;
            tx.onerror = () => reject(tx.error);
        });
    } catch (error) {
        console.error('[SW] Failed to store history entry:', error);
    }
}

/**
 * Retrieve all stored history entries.
 * @returns {Promise<Array>}
 */
async function getAllStoredHistory() {
    try {
        const db = await openHistoryDB();
        const tx = db.transaction('history', 'readonly');
        const request = tx.objectStore('history').getAll();

        return new Promise((resolve, reject) => {
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    } catch (error) {
        console.error('[SW] Failed to read stored history:', error);
        return [];
    }
}

console.log('[SW] History Service Worker loaded');
