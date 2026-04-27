/**
 * Brave Browser History Access Script
 *
 * Provides multiple methods to access Brave browser history,
 * including attempts to access incognito mode history.
 *
 * IMPORTANT: Due to browser security restrictions, some methods may require
 * specific permissions or extensions to work properly.
 *
 * @version 2.0.0
 */

class BraveHistoryAccess {
    constructor() {
        const platform = this._detectPlatform();
        this.isWindows = platform === 'windows';
        this.isMac = platform === 'macos';
        this.isLinux = platform === 'linux';

        /** @type {number} Default timeout for async operations (ms) */
        this.timeout = 10000;
    }

    // ─── Internal Helpers ────────────────────────────────────────────

    /**
     * Detect the operating system using modern APIs with fallback.
     * @returns {'windows'|'macos'|'linux'|'unknown'}
     * @private
     */
    _detectPlatform() {
        try {
            // Modern API (Chromium 93+)
            if (navigator.userAgentData && navigator.userAgentData.platform) {
                const p = navigator.userAgentData.platform.toLowerCase();
                if (p.includes('win')) return 'windows';
                if (p.includes('mac')) return 'macos';
                if (p.includes('linux')) return 'linux';
            }
        } catch (_) { /* fall through */ }

        // Fallback — navigator.platform is deprecated but still available
        const legacy = (navigator.platform || '').toLowerCase();
        if (legacy.includes('win')) return 'windows';
        if (legacy.includes('mac')) return 'macos';
        if (legacy.includes('linux')) return 'linux';

        return 'unknown';
    }

    /**
     * Wrap a promise with a timeout.
     * @param {Promise} promise
     * @param {number}  ms
     * @param {string}  label  — used in the timeout error message
     * @returns {Promise}
     * @private
     */
    _withTimeout(promise, ms, label = 'Operation') {
        return new Promise((resolve, reject) => {
            const timer = setTimeout(
                () => reject(new Error(`${label} timed out after ${ms}ms`)),
                ms
            );
            promise
                .then((v) => { clearTimeout(timer); resolve(v); })
                .catch((e) => { clearTimeout(timer); reject(e); });
        });
    }

    /**
     * Build a standardised result envelope.
     * Every public method returns this shape for consistency.
     *
     * @param {boolean}      success
     * @param {*}            data
     * @param {string|null}  [error=null]
     * @returns {{success:boolean, data:*, error:string|null, timestamp:string}}
     * @private
     */
    _result(success, data, error = null) {
        return {
            success,
            data,
            error,
            timestamp: new Date().toISOString()
        };
    }

    // ─── Method 1: Chrome Extension History API ─────────────────────

    /**
     * Access history through the Chrome/Brave extension history API.
     * Requires a Brave extension with the "history" permission.
     *
     * @param {number} [daysBack=30] — how many days of history to retrieve
     * @returns {Promise<{success:boolean, data:*, error:string|null, timestamp:string}>}
     */
    async getHistoryViaExtension(daysBack = 30) {
        try {
            if (typeof chrome === 'undefined' || !chrome.history) {
                return this._result(false, null,
                    'Chrome extension API not available. Install as a Brave extension with the "history" permission.');
            }

            const startTime = Date.now() - (daysBack * 24 * 60 * 60 * 1000);

            const historyItems = await new Promise((resolve, reject) => {
                chrome.history.search(
                    { text: '', startTime, maxResults: 10000 },
                    (items) => {
                        if (chrome.runtime.lastError) {
                            reject(new Error(chrome.runtime.lastError.message));
                        } else {
                            resolve(items);
                        }
                    }
                );
            });

            return this._result(true, historyItems);
        } catch (error) {
            console.error('Extension API method failed:', error);
            return this._result(false, null, error.message);
        }
    }

    // ─── Method 2: Browser History API (limited) ────────────────────

    /**
     * Gather basic information from the standard browser History & Location APIs.
     *
     * @returns {{success:boolean, data:*, error:string|null, timestamp:string}}
     */
    getBrowserHistory() {
        try {
            const data = {
                currentUrl: window.location.href,
                referrer: document.referrer,
                historyLength: window.history.length,
                historyState: window.history.state
            };

            return this._result(true, data);
        } catch (error) {
            console.error('Browser history API failed:', error);
            return this._result(false, null, error.message);
        }
    }

    // ─── Method 3: Local Storage History Tracking ───────────────────

    /**
     * Track navigation by appending to a localStorage log.
     * Only useful if this script runs continuously across pages.
     *
     * @returns {{success:boolean, data:*, error:string|null, timestamp:string}}
     */
    trackLocalHistory() {
        try {
            let history = JSON.parse(localStorage.getItem('braveHistoryTrack') || '[]');

            const currentEntry = {
                url: window.location.href,
                title: document.title,
                timestamp: new Date().toISOString(),
                referrer: document.referrer
            };

            // Avoid consecutive duplicates
            if (!history.length || history[history.length - 1].url !== currentEntry.url) {
                history.push(currentEntry);

                // Keep only last 1000 entries
                if (history.length > 1000) {
                    history = history.slice(-1000);
                }

                localStorage.setItem('braveHistoryTrack', JSON.stringify(history));
            }

            return this._result(true, history);
        } catch (error) {
            console.error('Local history tracking failed:', error);
            return this._result(false, null, error.message);
        }
    }

    // ─── Method 4: Service Worker ───────────────────────────────────

    /**
     * Register the companion service worker and request its tracked history.
     * Uses a MessageChannel for reliable two-way communication with the SW.
     *
     * @returns {Promise<{success:boolean, data:*, error:string|null, timestamp:string}>}
     */
    async registerServiceWorker() {
        if (!('serviceWorker' in navigator)) {
            return this._result(false, null, 'Service Workers are not supported in this browser.');
        }

        try {
            const registration = await navigator.serviceWorker.register('/history-sw.js');
            console.log('Service Worker registered:', registration.scope);

            // Wait for the SW to become active
            const sw = registration.active
                || registration.waiting
                || registration.installing;

            if (!sw) {
                return this._result(false, null, 'Service Worker could not activate.');
            }

            // If still installing, wait for it to activate
            if (sw.state !== 'activated') {
                await new Promise((resolve) => {
                    sw.addEventListener('statechange', function handler() {
                        if (sw.state === 'activated' || sw.state === 'redundant') {
                            sw.removeEventListener('statechange', handler);
                            resolve();
                        }
                    });
                });
            }

            // Use a MessageChannel for reliable communication
            const history = await this._withTimeout(
                new Promise((resolve) => {
                    const channel = new MessageChannel();
                    channel.port1.onmessage = (event) => {
                        if (event.data && event.data.type === 'HISTORY_RESPONSE') {
                            resolve(event.data.history);
                        }
                    };
                    navigator.serviceWorker.controller?.postMessage(
                        { type: 'GET_HISTORY' },
                        [channel.port2]
                    );
                }),
                this.timeout,
                'Service Worker history request'
            );

            return this._result(true, history);
        } catch (error) {
            console.error('Service Worker method failed:', error);
            return this._result(false, null, error.message);
        }
    }

    // ─── Method 5: Native File System Access (experimental) ────────

    /**
     * Attempt to read Brave's SQLite history database via the
     * File System Access API. Requires explicit user permission.
     *
     * @returns {Promise<{success:boolean, data:*, error:string|null, timestamp:string}>}
     */
    async tryDirectFileAccess() {
        if (!('showDirectoryPicker' in window)) {
            return this._result(false, null, 'File System Access API not available.');
        }

        try {
            const dirHandle = await window.showDirectoryPicker();
            const bravePaths = this.getBraveDataPaths();

            for (const path of bravePaths) {
                try {
                    const fileHandle = await dirHandle.getFileHandle(path);
                    const file = await fileHandle.getFile();

                    return this._result(true, {
                        fileName: file.name,
                        size: file.size,
                        lastModified: new Date(file.lastModified).toISOString()
                    });
                } catch (_) {
                    // Path not found — try next
                    continue;
                }
            }

            return this._result(false, null, 'No Brave history files found in the selected directory.');
        } catch (error) {
            console.error('Direct file access failed:', error);
            return this._result(false, null, error.message);
        }
    }

    /**
     * Return an array of relative paths to the Brave history DB
     * based on the detected operating system.
     *
     * @returns {string[]}
     */
    getBraveDataPaths() {
        if (this.isWindows) {
            return [
                'BraveSoftware/Brave-Browser/User Data/Default/History',
                'BraveSoftware/Brave-Browser/User Data/Default/History Journal'
            ];
        }
        if (this.isMac) {
            return [
                'Library/Application Support/BraveSoftware/Brave-Browser/Default/History'
            ];
        }
        // Linux / fallback
        return [
            '.config/BraveSoftware/Brave-Browser/Default/History'
        ];
    }

    // ─── Method 6: Incognito Detection + Session History ────────────

    /**
     * Detect incognito mode and gather available history through all methods.
     *
     * @returns {Promise<{success:boolean, data:*, error:string|null, timestamp:string}>}
     */
    async detectIncognitoAndGetHistory() {
        try {
            const isIncognito = await this.detectIncognito();

            if (isIncognito) {
                console.log('Incognito mode detected');
                const sessionHistory = this.getSessionHistory();

                return this._result(true, {
                    isIncognito: true,
                    sessionHistory: sessionHistory.data,
                    message: 'Limited history available in incognito mode'
                });
            }

            console.log('Normal mode detected');
            const [ext, browser, local] = await Promise.allSettled([
                this.getHistoryViaExtension(),
                Promise.resolve(this.getBrowserHistory()),   // wrap sync in promise
                Promise.resolve(this.trackLocalHistory())    // wrap sync in promise
            ]);

            return this._result(true, {
                isIncognito: false,
                extensionHistory: ext.status === 'fulfilled' ? ext.value : null,
                browserHistory: browser.status === 'fulfilled' ? browser.value : null,
                localHistory: local.status === 'fulfilled' ? local.value : null
            });
        } catch (error) {
            console.error('Incognito detection failed:', error);
            return this._result(false, null, error.message);
        }
    }

    /**
     * Detect whether the browser is in incognito / private mode.
     * Uses multiple heuristics; no single method is 100 % reliable.
     *
     * @returns {Promise<boolean>}
     */
    async detectIncognito() {
        // Heuristic 1 — Storage quota (Chromium-based)
        try {
            if (navigator.storage && navigator.storage.estimate) {
                const { quota } = await navigator.storage.estimate();
                // Incognito Chromium caps quota much lower than normal mode
                if (quota < 120_000_000) return true;
            }
        } catch (_) { /* fall through */ }

        // Heuristic 2 — IndexedDB access (Firefox)
        try {
            const testDb = indexedDB.open('__incognito_test__');
            await new Promise((resolve, reject) => {
                testDb.onerror = () => reject();
                testDb.onsuccess = () => {
                    testDb.result.close();
                    indexedDB.deleteDatabase('__incognito_test__');
                    resolve();
                };
            });
        } catch (_) {
            return true;
        }

        return false;
    }

    /**
     * Get current session information (works in both normal & incognito).
     *
     * @returns {{success:boolean, data:*, error:string|null, timestamp:string}}
     */
    getSessionHistory() {
        try {
            const session = {
                currentUrl: window.location.href,
                title: document.title,
                referrer: document.referrer,
                timestamp: new Date().toISOString(),
                userAgent: navigator.userAgent,
                windowCount: window.length,
                historyLength: window.history.length
            };

            // Modern Navigation Timing API
            const navEntries = performance.getEntriesByType('navigation');
            if (navEntries.length) {
                session.navigationType = navEntries[0].type;        // 'navigate', 'reload', etc.
                session.redirectCount = navEntries[0].redirectCount;
            }

            return this._result(true, session);
        } catch (error) {
            console.error('Session history error:', error);
            return this._result(false, null, error.message);
        }
    }

    // ─── Aggregator ─────────────────────────────────────────────────

    /**
     * Run all available history-access methods and return combined results.
     *
     * @returns {Promise<{success:boolean, data:*, error:string|null, timestamp:string}>}
     */
    async getAllHistory() {
        console.log('Attempting to access Brave browser history…');

        const methods = {};

        methods.incognito = await this.detectIncognitoAndGetHistory();
        methods.serviceWorker = await this.registerServiceWorker();
        methods.directFileAccess = await this.tryDirectFileAccess();

        return this._result(true, methods);
    }

    // ─── Export ──────────────────────────────────────────────────────

    /**
     * Download the provided history data as a JSON file.
     *
     * @param {*}      historyData
     * @param {string} [filename='brave-history-export.json']
     */
    exportHistory(historyData, filename = 'brave-history-export.json') {
        try {
            const dataStr = JSON.stringify(historyData, null, 2);
            const dataBlob = new Blob([dataStr], { type: 'application/json' });
            const objectUrl = URL.createObjectURL(dataBlob);

            const link = document.createElement('a');
            link.href = objectUrl;
            link.download = filename;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);

            // Defer revocation so the browser has time to start the download
            setTimeout(() => URL.revokeObjectURL(objectUrl), 5000);

            console.log('History exported successfully to', filename);
        } catch (error) {
            console.error('Export failed:', error);
        }
    }
}

// ─── Initialization ─────────────────────────────────────────────────

/**
 * Initialize the Brave History Access system.
 * Starts local tracking and collects all available history.
 * Does NOT auto-export; call `exportHistory()` explicitly when needed.
 *
 * @returns {Promise<object|null>}
 */
async function initializeBraveHistoryAccess() {
    const historyAccess = new BraveHistoryAccess();

    try {
        console.log('Initializing Brave History Access…');

        // Start local tracking immediately
        historyAccess.trackLocalHistory();

        // Gather all available history
        const allHistory = await historyAccess.getAllHistory();

        console.log('History access results:', allHistory);

        // Return results — caller decides whether to export
        return allHistory;
    } catch (error) {
        console.error('Initialization failed:', error);
        return null;
    }
}

// Auto-initialize when loaded in a browser context
if (typeof window !== 'undefined') {
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initializeBraveHistoryAccess);
    } else {
        initializeBraveHistoryAccess();
    }
}

// CommonJS export
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { BraveHistoryAccess, initializeBraveHistoryAccess };
}
