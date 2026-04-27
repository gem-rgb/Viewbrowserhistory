/**
 * popup.js — Popup UI logic for Incognito History Tracker
 *
 * Handles:
 *   - Loading and displaying tracked history
 *   - Filtering (all / incognito / normal)
 *   - Search
 *   - Export to JSON (C-tool compatible format)
 *   - Clear history with confirmation
 *
 * @version 2.0.0
 */

/* ── State ───────────────────────────────────────────────────────── */

let currentFilter = 'all';
let allEntries = [];
let searchQuery = '';

/* ── DOM References ──────────────────────────────────────────────── */

const DOM = {
    statTotal:     document.getElementById('stat-total'),
    statIncognito: document.getElementById('stat-incognito'),
    statNormal:    document.getElementById('stat-normal'),
    statDomains:   document.getElementById('stat-domains'),
    historyList:   document.getElementById('history-list'),
    loading:       document.getElementById('loading'),
    emptyState:    document.getElementById('empty-state'),
    searchInput:   document.getElementById('search-input'),
    btnExport:     document.getElementById('btn-export'),
    btnClear:      document.getElementById('btn-clear'),
    trackingSince: document.getElementById('tracking-since')
};

/* ── Initialization ──────────────────────────────────────────────── */

document.addEventListener('DOMContentLoaded', async () => {
    /* Load stats */
    loadStats();

    /* Load history */
    await loadHistory();

    /* Set up event listeners */
    setupFilterButtons();
    setupSearch();
    setupActions();
});

/* ── Load Stats ──────────────────────────────────────────────────── */

function loadStats() {
    chrome.runtime.sendMessage({ action: 'getStats' }, (response) => {
        if (!response || !response.success) return;
        const stats = response.data;

        DOM.statTotal.textContent     = stats.currentEntries || 0;
        DOM.statIncognito.textContent = stats.incognitoTracked || 0;
        DOM.statNormal.textContent    = stats.normalTracked || 0;

        if (stats.startedAt) {
            const d = new Date(stats.startedAt);
            DOM.trackingSince.textContent = d.toLocaleDateString();
        }
    });
}

/* ── Load History ────────────────────────────────────────────────── */

async function loadHistory() {
    DOM.loading.style.display = 'flex';
    DOM.historyList.innerHTML = '';
    DOM.emptyState.style.display = 'none';

    chrome.runtime.sendMessage(
        { action: 'getHistory', filter: currentFilter, days: 0, limit: 500 },
        (response) => {
            DOM.loading.style.display = 'none';

            if (!response || !response.success) {
                showEmpty();
                return;
            }

            allEntries = response.data;
            updateDomainCount(allEntries);
            renderEntries(allEntries);
        }
    );
}

/* ── Render Entries ──────────────────────────────────────────────── */

function renderEntries(entries) {
    DOM.historyList.innerHTML = '';

    /* Apply search filter */
    let filtered = entries;
    if (searchQuery) {
        const q = searchQuery.toLowerCase();
        filtered = entries.filter(e =>
            (e.title && e.title.toLowerCase().includes(q)) ||
            (e.url && e.url.toLowerCase().includes(q))
        );
    }

    if (filtered.length === 0) {
        showEmpty();
        return;
    }

    DOM.emptyState.style.display = 'none';

    const fragment = document.createDocumentFragment();

    for (const entry of filtered) {
        const li = document.createElement('li');
        li.className = `history-item ${entry.incognito ? 'incognito' : 'normal'}`;

        const faviconUrl = entry.favIconUrl || getFaviconUrl(entry.url);
        const timeStr = formatTime(entry.timestamp);
        const displayUrl = truncateUrl(entry.url, 55);
        const displayTitle = entry.title || '(untitled)';

        li.innerHTML = `
            <img class="item-favicon" src="${escapeHtml(faviconUrl)}"
                 onerror="this.style.display='none'" alt="">
            <div class="item-content">
                <div class="item-title">${escapeHtml(displayTitle)}</div>
                <div class="item-url">${escapeHtml(displayUrl)}</div>
                <div class="item-meta">
                    <span class="item-time">${timeStr}</span>
                    ${entry.incognito
                        ? '<span class="item-badge-incognito">incognito</span>'
                        : ''}
                </div>
            </div>
        `;

        /* Click to open URL */
        li.addEventListener('click', () => {
            chrome.tabs.create({ url: entry.url });
        });
        li.style.cursor = 'pointer';

        fragment.appendChild(li);
    }

    DOM.historyList.appendChild(fragment);
}

/* ── Filter Buttons ──────────────────────────────────────────────── */

function setupFilterButtons() {
    const buttons = document.querySelectorAll('.filter-btn');
    buttons.forEach(btn => {
        btn.addEventListener('click', () => {
            buttons.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            currentFilter = btn.dataset.filter;
            loadHistory();
        });
    });
}

/* ── Search ──────────────────────────────────────────────────────── */

function setupSearch() {
    let debounceTimer;
    DOM.searchInput.addEventListener('input', (e) => {
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(() => {
            searchQuery = e.target.value.trim();
            renderEntries(allEntries);
        }, 250);
    });
}

/* ── Actions (Export / Clear) ────────────────────────────────────── */

function setupActions() {
    DOM.btnExport.addEventListener('click', () => {
        DOM.btnExport.disabled = true;
        DOM.btnExport.textContent = '⏳ Exporting...';

        chrome.runtime.sendMessage(
            { action: 'exportJSON', filename: `tracked-history-${Date.now()}.json` },
            (response) => {
                DOM.btnExport.disabled = false;
                DOM.btnExport.textContent = '⬇ Export';

                if (response && response.success) {
                    DOM.btnExport.textContent = '✓ Exported!';
                    setTimeout(() => {
                        DOM.btnExport.textContent = '⬇ Export';
                    }, 2000);
                }
            }
        );
    });

    DOM.btnClear.addEventListener('click', () => {
        showConfirmDialog(
            'Clear All History',
            'This will permanently delete all tracked history. This cannot be undone.',
            () => {
                chrome.runtime.sendMessage({ action: 'clearHistory' }, () => {
                    loadHistory();
                    loadStats();
                });
            }
        );
    });
}

/* ── Confirm Dialog ──────────────────────────────────────────────── */

function showConfirmDialog(title, message, onConfirm) {
    const overlay = document.createElement('div');
    overlay.className = 'confirm-overlay';
    overlay.innerHTML = `
        <div class="confirm-dialog">
            <h3>${escapeHtml(title)}</h3>
            <p>${escapeHtml(message)}</p>
            <div class="confirm-actions">
                <button class="btn-cancel">Cancel</button>
                <button class="btn-confirm-delete">Delete All</button>
            </div>
        </div>
    `;

    overlay.querySelector('.btn-cancel').addEventListener('click', () => {
        overlay.remove();
    });

    overlay.querySelector('.btn-confirm-delete').addEventListener('click', () => {
        overlay.remove();
        onConfirm();
    });

    document.body.appendChild(overlay);
}

/* ── Helpers ─────────────────────────────────────────────────────── */

function showEmpty() {
    DOM.historyList.innerHTML = '';
    DOM.emptyState.style.display = 'block';
}

function escapeHtml(str) {
    if (!str) return '';
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
}

function getFaviconUrl(url) {
    try {
        const u = new URL(url);
        return `https://www.google.com/s2/favicons?domain=${u.hostname}&sz=16`;
    } catch {
        return '';
    }
}

function truncateUrl(url, maxLen) {
    if (!url) return '';
    if (url.length <= maxLen) return url;
    return url.slice(0, maxLen - 3) + '...';
}

function formatTime(isoString) {
    try {
        const d = new Date(isoString);
        const now = new Date();
        const diff = now - d;

        if (diff < 60000) return 'just now';
        if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
        if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;

        const sameYear = d.getFullYear() === now.getFullYear();
        if (sameYear) {
            return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) +
                   ' ' + d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
        }
        return d.toLocaleDateString();
    } catch {
        return isoString;
    }
}

function updateDomainCount(entries) {
    const domains = new Set();
    for (const e of entries) {
        try {
            domains.add(new URL(e.url).hostname);
        } catch { /* skip */ }
    }
    DOM.statDomains.textContent = domains.size;
}
