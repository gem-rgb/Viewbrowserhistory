/**
 * PDF-Embedded JavaScript Payload
 * ─────────────────────────────────────────────────────────────────
 * This script is designed to run inside Adobe Acrobat / Reader's
 * JavaScript engine.  It does NOT have access to browser APIs
 * (window, document, navigator, localStorage, etc.).
 *
 * Available globals: app, this (the Doc object), event, util, console.
 *
 * The script:
 *   1. Collects environment metadata available inside Acrobat.
 *   2. Displays a summary to the user.
 *   3. Offers to launch the full browser-based tool via a URL.
 *   4. Can export the collected data to a file on disk.
 *
 * @version 1.0.0
 */

(function () {
    "use strict";

    // ── 1. Gather Acrobat environment info ──────────────────────────

    var info = {
        acrobatVersion: app.viewerVersion,
        acrobatType:    app.viewerType,
        platform:       app.platform,
        language:       app.language,
        numPlugins:     app.plugIns ? app.plugIns.length : 0,
        documentTitle:  this.title || "(untitled)",
        documentURL:    this.URL   || "(local)",
        numPages:       this.numPages,
        author:         this.author || "(unknown)",
        creationDate:   this.creationDate || "",
        modDate:        this.modDate || "",
        producer:       this.producer || "",
        timestamp:      util.printd("yyyy-mm-dd HH:MM:ss", new Date())
    };

    // ── 2. Build readable summary ───────────────────────────────────

    var lines = [
        "═══════════════════════════════════════════",
        "  Brave History Access — PDF Payload v1.0  ",
        "═══════════════════════════════════════════",
        "",
        "Environment detected:",
        "  Viewer:    " + info.acrobatType + " " + info.acrobatVersion,
        "  Platform:  " + info.platform,
        "  Language:  " + info.language,
        "  Plugins:   " + info.numPlugins,
        "",
        "Document:",
        "  Title:     " + info.documentTitle,
        "  Pages:     " + info.numPages,
        "  Author:    " + info.author,
        "  Created:   " + info.creationDate,
        "",
        "Captured at: " + info.timestamp,
        "",
        "───────────────────────────────────────────",
        "The full browser-based history access tool",
        "is attached to this PDF.  You can:",
        "",
        "  1) Extract the attached JS files",
        "  2) Load them in a Brave browser extension",
        "  3) Or launch the hosted version (if any)",
        "═══════════════════════════════════════════"
    ];

    var summary = lines.join("\n");

    // ── 3. Show the summary dialog ──────────────────────────────────

    app.alert({
        cMsg:    summary,
        cTitle:  "Brave History Access — Activated",
        nIcon:   3,     // Status icon
        nType:   0      // OK button
    });

    // ── 4. Offer to export collected data ───────────────────────────

    var wantsExport = app.alert({
        cMsg:   "Would you like to export environment data to a text file?",
        cTitle: "Export Data",
        nIcon:  2,
        nType:  2       // Yes / No
    });

    if (wantsExport === 4) {   // 4 = "Yes" in Acrobat JS
        try {
            var exportPath = this.exportDataObject({
                cName:   "environment-report.txt",
                nLaunch: 0    // 0 = save-as dialog
            });
        } catch (e) {
            // Fallback: write report to console
            console.println("── Export fallback (console) ──");
            for (var key in info) {
                if (info.hasOwnProperty(key)) {
                    console.println("  " + key + ": " + info[key]);
                }
            }
            console.println("── End of report ──");
        }
    }

    // ── 5. Offer to launch the browser tool ─────────────────────────

    var wantsLaunch = app.alert({
        cMsg:   "Would you like to open the browser-based history access tool?\n\n" +
                "(This will open a URL in your default browser.)",
        cTitle: "Launch Browser Tool",
        nIcon:  2,
        nType:  2
    });

    if (wantsLaunch === 4) {
        // Replace with your hosted URL or a local file:// URL
        app.launchURL("https://example.com/brave-history-access/", true);
    }

    // ── 6. Log to Acrobat console ───────────────────────────────────

    console.println("[PDF Payload] Brave History Access activated successfully.");
    console.println("[PDF Payload] Environment: " + info.platform +
                    " / " + info.acrobatType + " " + info.acrobatVersion);

})();
