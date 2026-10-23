# PDF export checks

Run from apps/web:

    npm run test:pdf

The suite compiles the actual PDF builder in memory, uses jsdom for HTML conversion, checks actual bundled font coverage, and generates a real PDF using the installed pdfmake version. It covers authored front matter, numbering and destinations, sanitisation, image caching/concurrency/fallback, font loading, deadlines, cancellation, and inline formatting.

For a local output to inspect:

    PDF_REVIEW_DIR=/tmp/universal-book-pdf-review npm run test:pdf

Render that directory's mixed-scripts.pdf with a PDF viewer or Poppler. Check the contents page, publisher line, tables, chapter headings, and text for supported scripts.

Also check the export page in a browser with a test book: download with a saved cover, missing-image warnings, cancellation while assets load, retry after cancellation, expired authentication, and an unsupported character such as emoji. Cancellation prevents a late download; pdfmake's synchronous main-thread layout cannot always be interrupted immediately.

The editor, backend, database schema, and TXT/HTML export handlers are not changed by this implementation. Extra font files and test dependencies are specific to PDF export. Fonts load only when needed. Right-to-left paragraphs still need proofreading; glyph support does not establish correct paragraph direction. Missing required fonts cause an error rather than an unsafe fallback to a font without the script.
