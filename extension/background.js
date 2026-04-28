/**
 * background.js — Service Worker for Incognito History Tracker
 *
 * Runs persistently in the background. Captures all tab navigations
 * (including incognito) and stores them in chrome.storage.local.
 *
 * Integration with C tool:
 *   The extension exports data as JSON in the same envelope format
 *   used by the C tool. The C tool can import this file with --import.
 *
 * @version 2.0.0
 */

/* ── Constants ───────────────────────────────────────────────────── */

const STORAGE_KEY     = 'trackedHistory';
const STATS_KEY       = 'trackerStats';
const MAX_ENTRIES     = 50000;   /* cap to prevent storage overflow */
const FLUSH_INTERVAL  = 30000;   /* batch-write interval (ms) */

/* ── In-memory buffer for batching writes ────────────────────────── */

let pendingEntries = [];
let flushTimer = null;

/* ── Lifecycle ───────────────────────────────────────────────────── */

chrome.runtime.onInstalled.addListener((details) => {
    if (details.reason === 'install') {
        chrome.storage.local.set({
            [STORAGE_KEY]: [],
            [STATS_KEY]: {
                totalTracked: 0,
                incognitoTracked: 0,
                normalTracked: 0,
                startedAt: new Date().toISOString()
            }
        });
        console.log('[Tracker] Extension installed — history tracking active');
    }
});

/* ── Tab Navigation Tracking ─────────────────────────────────────── */

/**
 * Listen for tab updates. When a page finishes loading, record it.
 * The `tab.incognito` flag tells us if this is a private window.
 */
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
    /* Only track completed navigations with a real URL */
    if (changeInfo.status !== 'complete') return;
    if (!tab.url) return;

    /* Skip internal browser pages */
    if (tab.url.startsWith('chrome://') ||
        tab.url.startsWith('chrome-extension://') ||
        tab.url.startsWith('brave://') ||
        tab.url.startsWith('about:')) {
        return;
    }

    const entry = {
        url:        tab.url,
        title:      tab.title || '(untitled)',
        timestamp:  new Date().toISOString(),
        incognito:  tab.incognito || false,
        tabId:      tabId,
        windowId:   tab.windowId,
        favIconUrl: tab.favIconUrl || null
    };

    pendingEntries.push(entry);

    /* Schedule a flush if not already pending */
    if (!flushTimer) {
        flushTimer = setTimeout(flushToStorage, FLUSH_INTERVAL);
    }

    /* Immediate flush if buffer is getting large */
    if (pendingEntries.length >= 50) {
        flushToStorage();
    }

    /* Update badge to show tracking is active */
    const badgeText = tab.incognito ? '🔒' : '●';
    chrome.action.setBadgeText({ text: tab.incognito ? 'INC' : '', tabId });
    if (tab.incognito) {
        chrome.action.setBadgeBackgroundColor({ color: '#FF6B35', tabId });
    }
});

/* ── Batch Storage Write ─────────────────────────────────────────── */

async function flushToStorage() {
    if (flushTimer) {
        clearTimeout(flushTimer);
        flushTimer = null;
    }

    if (pendingEntries.length === 0) return;

    const batch = [...pendingEntries];
    pendingEntries = [];

    try {
        const result = await chrome.storage.local.get([STORAGE_KEY, STATS_KEY]);
        let history = result[STORAGE_KEY] || [];
        let stats   = result[STATS_KEY]   || {
            totalTracked: 0,
            incognitoTracked: 0,
            normalTracked: 0,
            startedAt: new Date().toISOString()
        };

        /* Append new entries */
        history = history.concat(batch);

        /* Enforce cap — keep most recent */
        if (history.length > MAX_ENTRIES) {
            history = history.slice(-MAX_ENTRIES);
        }

        /* Update stats */
        for (const entry of batch) {
            stats.totalTracked++;
            if (entry.incognito) {
                stats.incognitoTracked++;
            } else {
                stats.normalTracked++;
            }
        }
        stats.lastUpdated = new Date().toISOString();

        await chrome.storage.local.set({
            [STORAGE_KEY]: history,
            [STATS_KEY]: stats
        });

        console.log(`[Tracker] Flushed ${batch.length} entries (total: ${history.length})`);
    } catch (err) {
        console.error('[Tracker] Storage write failed:', err);
        /* Put entries back for retry */
        pendingEntries = batch.concat(pendingEntries);
    }
}

/* ── Message Handler (from popup and content scripts) ────────────── */

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    switch (request.action) {
        case 'getHistory':
            handleGetHistory(request, sendResponse);
            return true;  /* async response */

        case 'getStats':
            handleGetStats(sendResponse);
            return true;

        case 'exportJSON':
            handleExportJSON(request, sendResponse);
            return true;

        case 'clearHistory':
            handleClearHistory(sendResponse);
            return true;

        case 'contentData':
            handleContentData(request, sender);
            break;

        default:
            break;
    }
});

async function handleGetHistory(request, sendResponse) {
    /* Flush any pending entries first */
    await flushToStorage();

    const result = await chrome.storage.local.get([STORAGE_KEY]);
    let history = result[STORAGE_KEY] || [];

    /* Apply filters */
    if (request.filter === 'incognito') {
        history = history.filter(e => e.incognito);
    } else if (request.filter === 'normal') {
        history = history.filter(e => !e.incognito);
    }

    if (request.days > 0) {
        const cutoff = new Date();
        cutoff.setDate(cutoff.getDate() - request.days);
        history = history.filter(e => new Date(e.timestamp) >= cutoff);
    }

    /* Return most recent first */
    history.reverse();

    if (request.limit > 0) {
        history = history.slice(0, request.limit);
    }

    sendResponse({ success: true, data: history, count: history.length });
}

async function handleGetStats(sendResponse) {
    await flushToStorage();
    const result = await chrome.storage.local.get([STORAGE_KEY, STATS_KEY]);
    const history = result[STORAGE_KEY] || [];
    const stats   = result[STATS_KEY]   || {};
    stats.currentEntries = history.length;
    sendResponse({ success: true, data: stats });
}

async function handleExportJSON(request, sendResponse) {
    await flushToStorage();

    const result = await chrome.storage.local.get([STORAGE_KEY, STATS_KEY]);
    const history = result[STORAGE_KEY] || [];
    const stats   = result[STATS_KEY]   || {};

    /* Build the export envelope (matches C tool format) */
    const exportData = {
        success: true,
        timestamp: new Date().toISOString(),
        error: null,
        source: 'incognito-history-tracker-extension',
        version: '2.0.0',
        stats: {
            total_urls: history.length,
            total_incognito: history.filter(e => e.incognito).length,
            total_normal: history.filter(e => !e.incognito).length,
            tracking_started: stats.startedAt || 'unknown',
            last_updated: stats.lastUpdated || 'unknown'
        },
        data: history.map(e => ({
            url: e.url,
            title: e.title,
            timestamp: e.timestamp,
            incognito: e.incognito,
            visit_count: 1,
            typed_count: 0,
            last_visit_time: e.timestamp
        }))
    };

    const jsonStr = JSON.stringify(exportData, null, 2);
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);

    const filename = request.filename || `tracked-history-${Date.now()}.json`;

    try {
        await chrome.downloads.download({
            url: url,
            filename: filename,
            saveAs: true
        });
        sendResponse({ success: true, count: history.length });
    } catch (err) {
        sendResponse({ success: false, error: err.message });
    }
}

async function handleClearHistory(sendResponse) {
    await chrome.storage.local.set({
        [STORAGE_KEY]: [],
        [STATS_KEY]: {
            totalTracked: 0,
            incognitoTracked: 0,
            normalTracked: 0,
            startedAt: new Date().toISOString()
        }
    });
    sendResponse({ success: true });
}

/**
 * Handle enrichment data from content scripts (page metadata).
 */
function handleContentData(request, sender) {
    if (!request.metadata) return;

    /* Find and enrich the matching entry in pending buffer */
    for (let i = pendingEntries.length - 1; i >= 0; i--) {
        if (pendingEntries[i].tabId === sender.tab?.id) {
            pendingEntries[i].description = request.metadata.description || '';
            pendingEntries[i].keywords    = request.metadata.keywords || '';
            break;
        }
    }
}

/* ── Flush on navigation commit (MV3 has no 'suspend' event) ─────── */

/**
 * MV3 service workers are terminated after ~30s of inactivity.
 * There is no 'suspend' lifecycle event. Instead, we flush
 * aggressively: immediately when buffer hits 5 entries, and
 * on a short 5s timer as fallback for stragglers.
 */
chrome.webNavigation?.onCommitted?.addListener(() => {
    if (pendingEntries.length >= 5) {
        flushToStorage();
    }
});

console.log('[Tracker] Background service worker loaded');
