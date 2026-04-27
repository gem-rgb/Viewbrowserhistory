# Brave Browser History Access Tool

> **v2.0** — Dual-language implementation: JavaScript (browser-based) + C (native CLI)

This toolkit provides multiple methods to access Brave browser history, including incognito mode detection and session tracking. Two independent implementations are included, each suited to different use cases.

---

## Implementations

| | JavaScript (`js/`) | C (`c/`) |
|---|---|---|
| **Approach** | Browser APIs, extensions, service workers | Direct SQLite database read |
| **Runtime** | Browser + Node.js | Native executable (no runtime) |
| **Dependencies** | `pdf-lib` (npm) | SQLite amalgamation (vendored) |
| **Strengths** | Real-time tracking, session interception | Full history access, fastest, no browser needed |
| **Output** | JSON download, PDF via Node.js | JSON file, styled PDF report |
| **Platform** | Any browser | Windows, macOS, Linux |

---

## Quick Start

### JavaScript Version

```bash
cd js/
npm install          # first time only

# Generate the PDF deliverable
node generate-pdf.js

# Or load as a Brave extension (see below)
```

### C Version

```bash
cd c/

# Windows (MinGW)
build.bat

# Linux / macOS
make

# Run
./brave-history --json history.json --pdf report.pdf --days 30
./brave-history --help
```

---

## JavaScript Version (`js/`)

### Files

| File | Purpose |
|------|---------|
| `brave-history-access.js` | Main class with 6 access methods |
| `history-sw.js` | Service Worker for fetch interception & IndexedDB persistence |
| `pdf-payload.js` | Adapted JavaScript payload for Adobe Acrobat's JS engine |
| `generate-pdf.js` | Node.js script to build the deliverable PDF |
| `package.json` | Node.js dependencies |

### Methods Implemented

1. **Chrome Extension History API** — Full browser history via extension permissions
2. **Browser History API** — Current page, referrer, history length
3. **Local Storage Tracking** — Continuous page visit logging
4. **Service Worker Interception** — Network request logging via SW
5. **File System Access API** — Experimental direct SQLite access
6. **Incognito Detection + Session History** — Multi-heuristic detection

### API Reference

All public methods return a standardised result envelope:

```typescript
{
  success: boolean;
  data:    any | null;
  error:   string | null;
  timestamp: string;    // ISO 8601
}
```

### Class: `BraveHistoryAccess`

```javascript
const bha = new BraveHistoryAccess();

const ext     = await bha.getHistoryViaExtension(30);
const browser = bha.getBrowserHistory();
const local   = bha.trackLocalHistory();
const sw      = await bha.registerServiceWorker();
const file    = await bha.tryDirectFileAccess();
const detect  = await bha.detectIncognitoAndGetHistory();
const session = bha.getSessionHistory();

const all = await bha.getAllHistory();
bha.exportHistory(all, 'my-history.json');
```

### PDF Delivery

```bash
cd js/
npm install
node generate-pdf.js                        # → brave-history-access.pdf
node generate-pdf.js custom-filename.pdf    # → custom name
```

The PDF embeds all source files as attachments and executes a JavaScript payload on open (Adobe Acrobat only).

### Extension Setup

1. Create `manifest.json` in the `js/` directory:
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

2. Load in Brave: `brave://extensions/` → Developer mode → Load unpacked → Select `js/` folder

---

## C Version (`c/`)

### Files

| File | Purpose |
|------|---------|
| `brave_history.c` | Main entry point with CLI argument parsing |
| `history_db.c/.h` | SQLite query layer for Brave's History database |
| `export_json.c/.h` | JSON export with proper string escaping |
| `export_pdf.c/.h` | Raw PDF generation (no external library) |
| `platform.c/.h` | OS detection, file paths, time utilities |
| `vendor/sqlite3.c/.h` | SQLite amalgamation (vendored, no install needed) |
| `Makefile` | Build for GCC / MinGW |
| `build.bat` | Windows build script (auto-detects GCC or MSVC) |

### How It Works

The C version takes a fundamentally different approach: it **directly reads Brave's SQLite history database** from disk. This is the most powerful method since it has unrestricted access to the full history without needing browser extensions, service workers, or special permissions.

1. **Locates** Brave's `History` database using OS-specific paths
2. **Copies** it to a temp location (Brave locks the file while running)
3. **Queries** the `urls` table via SQLite for full browsing history
4. **Exports** results to JSON and/or a styled multi-page PDF

### Building

**Windows (MinGW — recommended):**
```bash
cd c/
build.bat
```

**Windows (MSVC):**
```bash
cd c/
cl /O2 /Fe:brave-history.exe brave_history.c history_db.c export_json.c export_pdf.c platform.c vendor\sqlite3.c shell32.lib ole32.lib
```

**Linux / macOS:**
```bash
cd c/
make
```

### Usage

```bash
# Show help
brave-history --help

# Run with defaults (prints summary to console)
brave-history

# Export last 30 days to JSON
brave-history --json history.json --days 30

# Generate styled PDF report
brave-history --pdf report.pdf

# Full export (both formats)
brave-history --json history.json --pdf report.pdf --days 90

# Use a specific database file
brave-history --db /path/to/History --json out.json
```

### Output Format (JSON)

```json
{
  "success": true,
  "timestamp": "2025-04-27T13:41:27Z",
  "error": null,
  "stats": {
    "total_urls": 3776,
    "total_visits": 15420,
    "unique_domains": 245,
    "earliest_visit": "2025-03-28T10:15:00Z",
    "latest_visit": "2025-04-27T13:38:10Z",
    "most_visited_url": "https://example.com",
    "most_visited_title": "Example",
    "most_visited_count": 342
  },
  "data": [
    {
      "url": "https://...",
      "title": "Page Title",
      "visit_count": 5,
      "typed_count": 2,
      "last_visit_time": "2025-04-27T13:38:10Z"
    }
  ]
}
```

### PDF Report

The generated PDF includes:
- **Cover page** — Dark header with orange accent, summary statistics, methodology description
- **History listing** — Paginated table with URL, title, visit count, and date
- **Alternating row colors** for readability
- **Professional footer** with page numbers

---

## Brave Data Locations

| OS | Path |
|----|------|
| **Windows** | `%LOCALAPPDATA%\BraveSoftware\Brave-Browser\User Data\Default\History` |
| **macOS** | `~/Library/Application Support/BraveSoftware/Brave-Browser/Default/History` |
| **Linux** | `~/.config/BraveSoftware/Brave-Browser/Default/History` |

---

## ⚠️ Security Notice

Due to browser security restrictions, the **JavaScript version** has limited access to incognito history. Browsers are designed to protect private browsing data:

- No persistent incognito history (by design)
- Session-only access while running
- Memory-based — closing incognito deletes all data

The **C version** can access all *normal mode* history but **cannot** access incognito history either — it is never written to disk.

---

## Ethical Considerations

This toolkit is designed for:
- Personal data backup and analysis
- Educational purposes
- Understanding browser data storage

**Do not use for:**
- Monitoring other users' browsing activity
- Violating privacy expectations
- Unauthorised data collection

---

## Troubleshooting

### JavaScript Version

| Error | Solution |
|-------|----------|
| `Chrome extension API not available` | Install as a Brave extension with proper permissions |
| `Service Workers not supported` | Serve files from HTTPS or localhost |
| `File System Access API not available` | Use modern browser, serve from secure context |
| `Service Worker history request timed out` | Ensure the SW is active; reload the page |

### C Version

| Error | Solution |
|-------|----------|
| `Brave Browser history database not found` | Ensure Brave is installed; use `--db` to specify path |
| `Cannot copy history database` | Close Brave browser, or manually copy the History file |
| `No C compiler found` (build.bat) | Install MinGW-w64 or Visual Studio Build Tools |
| Linker errors on Linux | Ensure `-lpthread -ldl -lm` flags (handled by Makefile) |

---

## v2.0 Changelog

### JavaScript
- Fixed Service Worker ↔ main script communication
- Standardised `{success, data, error, timestamp}` envelope
- PDF delivery: `generate-pdf.js` with embedded JS + attachments
- Timeout wrapper for async operations
- Replaced deprecated APIs

### C (New)
- Direct SQLite database reader — full history access
- JSON export matching JS version's envelope format
- Styled multi-page PDF report generation (raw PDF, no library)
- Cross-platform: Windows, macOS, Linux
- Zero runtime dependencies (SQLite vendored)

---

## License

This toolkit is provided for educational purposes. Use responsibly and respect user privacy.
