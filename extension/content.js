/**
 * content.js — Content script for Incognito History Tracker
 *
 * Runs in the context of every web page. Extracts page metadata
 * (description, keywords, Open Graph data) and sends it to the
 * background service worker for enrichment.
 *
 * @version 2.0.0
 */

(function () {
    'use strict';

    /* ── Extract page metadata ───────────────────────────────────── */

    function getMetaContent(name) {
        const el = document.querySelector(
            `meta[name="${name}"], meta[property="${name}"]`
        );
        return el ? el.getAttribute('content') || '' : '';
    }

    function extractMetadata() {
        return {
            description: getMetaContent('description') ||
                         getMetaContent('og:description') || '',
            keywords:    getMetaContent('keywords') || '',
            ogTitle:     getMetaContent('og:title') || '',
            ogImage:     getMetaContent('og:image') || '',
            ogType:      getMetaContent('og:type') || '',
            canonical:   (() => {
                const link = document.querySelector('link[rel="canonical"]');
                return link ? link.href : '';
            })(),
            lang:        document.documentElement.lang || ''
        };
    }

    /* ── Send metadata to background ─────────────────────────────── */

    /* Wait a moment for the page to fully render */
    setTimeout(() => {
        try {
            const metadata = extractMetadata();

            /* Only send if we have something useful */
            if (metadata.description || metadata.keywords || metadata.ogTitle) {
                chrome.runtime.sendMessage({
                    action: 'contentData',
                    metadata: metadata
                });
            }
        } catch (e) {
            /* Silently fail — content script errors shouldn't break pages */
        }
    }, 1000);

})();
