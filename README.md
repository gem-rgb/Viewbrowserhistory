# Brave Browser History Access Tool

> **v2.0** — Improved code quality, consistent APIs, and PDF delivery support.

This toolkit provides multiple methods to access Brave browser history, including incognito mode detection and session tracking.

## ⚠️ Important Security Notice

Due to browser security restrictions, **direct access to incognito history is extremely limited**. Browsers are designed to protect private browsing data, and most methods will only provide:

- Current session information
- Limited navigation data
- No persistent incognito history (by design)

---

## Files

| File | Purpose |
|------|---------|
| `brave-history-access.js` | Main class with 6 access methods |
| `history-sw.js` | Service Worker for fetch interception & IndexedDB persistence |
| `pdf-payload.js` | Adapted JavaScript payload for Adobe Acrobat's JS engine |
| `generate-pdf.js` | Node.js script to build the deliverable PDF |
| `README.md` | This documentation |

---

## Methods Implemented

### 1. Chrome Extension History API
- **Requires**: Brave extension with `"history"` permission
- **Access**: Full browser history (normal mode only)
- **Incognito**: Limited — requires extension enabled in incognito

### 2. Browser History API
- **Requires**: None (standard browser API)
- **Access**: Current page, referrer, history length
- **Incognito**: Works but very limited

### 3. Local Storage Tracking
- **Requires**: Script running continuously
- **Access**: Pages visited while script is active
- **Incognito**: Works for current session only

### 4. Service Worker Method
- **Requires**: Service worker registration
- **Access**: Network requests while service worker is active
- **Incognito**: Works for current session only

### 5. Direct File System Access (Experimental)
- **Requires**: File System Access API, user permission
- **Access**: Brave's SQLite database files
- **Incognito**: **Not accessible** — by design

### 6. Incognito Detection + Session History
- **Requires**: None
- **Access**: Current session data only
- **Incognito**: Detects mode, gets session info

---

## API Reference

All public methods return a standardised result envelope:

```typescript
{
  success: boolean;     // whether the method succeeded
  data:    any | null;  // the payload on success, null on failure
  error:   string | null;
  timestamp: string;    // ISO 8601
}
```

### Class: `BraveHistoryAccess`

```javascript
const bha = new BraveHistoryAccess();

// Individual methods
const ext     = await bha.getHistoryViaExtension(30);   // days back
const browser = bha.getBrowserHistory();                 // sync
const local   = bha.trackLocalHistory();                 // sync
const sw      = await bha.registerServiceWorker();       // async
const file    = await bha.tryDirectFileAccess();          // async, prompts user
const detect  = await bha.detectIncognitoAndGetHistory(); // async
const session = bha.getSessionHistory();                  // sync

// Run everything
const all = await bha.getAllHistory();

// Export to JSON download
bha.exportHistory(all, 'my-history.json');
```

### Standalone initialiser

```javascript
const results = await initializeBraveHistoryAccess();
// Starts local tracking + runs getAllHistory()
// Does NOT auto-download; call exportHistory() yourself.
```

---

## PDF Delivery

The toolkit can be packaged into a PDF file that:

1. **Executes JavaScript on open** (Adobe Acrobat / Reader only)
2. **Contains all source files** as embedded attachments
3. **Presents a professional cover page** with instructions

### Generate the PDF

```bash
npm install          # first time only
node generate-pdf.js                         # → brave-history-access.pdf
node generate-pdf.js custom-filename.pdf     # → custom name
```

### How the PDF works

| Feature | Details |
|---------|---------|
| **OpenAction** | `pdf-payload.js` runs when the PDF is opened in Acrobat |
| **Attachments** | All JS files + README are embedded as file attachments |
| **Extraction** | View → Navigation Panels → Attachments in Acrobat |
| **Launch** | The payload offers to open a URL in the default browser |

### PDF JavaScript Limitations

> ⚠️ **Only Adobe Acrobat and Acrobat Reader** execute embedded PDF JavaScript.
> Chrome's built-in viewer, Firefox's pdf.js, and most third-party viewers
> ignore PDF JavaScript for security reasons.

The PDF payload uses Acrobat's JS API (`app.alert`, `app.launchURL`, etc.), which is different from browser JavaScript. Browser-specific APIs (`window`, `document`, `navigator`) are **not available** in the PDF sandbox.

---

## Extension Setup (for full access)

To get complete history access, create a Brave extension:

1. Create `manifest.json`:
```json
{
  "manifest_version": 3,
  "name": "Brave History Access",
  "version": "2.0",
  "permissions": ["history", "activeTab", "storage"],
  "background": {
    "service_worker": "history-sw.js"
  },
  "content_scripts": [{
    "matches": ["<all_urls>"],
    "js": ["brave-history-access.js"]
  }]
}
```

2. Load extension in Brave:
   - Go to `brave://extensions/`
   - Enable "Developer mode"
   - Click "Load unpacked"
   - Select your extension folder

3. **For incognito access**:
   - Go to extension details
   - Enable "Allow in incognito"

---

## Brave Data Locations

### Windows
```
%LOCALAPPDATA%\BraveSoftware\Brave-Browser\User Data\Default\History
```

### macOS
```
~/Library/Application Support/BraveSoftware/Brave-Browser/Default/History
```

### Linux
```
~/.config/BraveSoftware/Brave-Browser/Default/History
```

---

## v2.0 Changelog

### Fixes
- **CRITICAL**: Fixed Service Worker ↔ main script communication (was using incompatible message channel)
- **CRITICAL**: SW `event.ports[0]` crash when no MessagePort was provided
- **HIGH**: Inconsistent error return shapes across all methods → standardised `{success, data, error, timestamp}` envelope
- **HIGH**: `registerServiceWorker()` silently returned `undefined` when SW unsupported
- **MEDIUM**: Replaced deprecated `navigator.platform` with `navigator.userAgentData.platform` + fallback
- **MEDIUM**: IndexedDB timestamp key collisions → auto-increment ID
- **MEDIUM**: `initializeBraveHistoryAccess()` no longer auto-downloads a JSON file on every load
- **MEDIUM**: Replaced deprecated `performance.navigation` with `PerformanceNavigationTiming`
- **LOW**: Fixed premature `URL.revokeObjectURL` in `exportHistory()`
- **LOW**: Removed redundant IndexedDB index
- **LOW**: Added network-offline fallback in SW fetch handler
- **LOW**: Filtered `undefined` entries from SW cache cleanup

### New Features
- PDF delivery: `generate-pdf.js` builds a self-activating PDF with embedded JS + attachments
- `pdf-payload.js`: Acrobat-adapted payload with environment detection, export, and browser launch
- Timeout wrapper for all async operations
- `_result()` helper for consistent API contract

---

## Limitations

### Incognito Mode
- **No persistent history**: By design, incognito history is not saved
- **Session-only access**: Only current session data available
- **Memory-based**: History exists only while incognito window is open
- **No cross-session**: Closing incognito window deletes all data

### Security Restrictions
- File system access requires explicit user permission
- SQLite database access is blocked in most scenarios
- Cross-origin restrictions prevent direct database access
- Service workers have limited lifetime in incognito

---

## Ethical Considerations

This script is designed for:
- Personal data backup and analysis
- Educational purposes
- Understanding browser data storage

**Do not use for**:
- Monitoring other users' browsing activity
- Violating privacy expectations
- Unauthorised data collection

---

## Troubleshooting

### Extension API Not Available
```
Error: Chrome extension API not available
```
**Solution**: Install as a Brave extension with proper permissions

### Service Worker Registration Failed
```
Error: Service Workers are not supported in this browser.
```
**Solution**: Serve files from HTTPS or localhost

### File Access Denied
```
Error: File System Access API not available.
```
**Solution**: Use modern browser and serve from secure context

### Service Worker Timeout
```
Error: Service Worker history request timed out after 10000ms
```
**Solution**: Ensure the SW is active; try reloading the page

---

## License

This script is provided for educational purposes. Use responsibly and respect user privacy.
