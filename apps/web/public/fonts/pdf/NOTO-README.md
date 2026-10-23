# Fonts used only by PDF export

These files are loaded from this app's own origin, on demand for the scripts in a book. No font CDN is contacted during export.

- Noto Sans Sinhala Regular/Bold, Noto Sans Devanagari Regular/Bold, and Noto Naskh Arabic Regular/Bold: https://github.com/notofonts/noto-fonts/tree/main/hinted/ttf (SIL Open Font License; see NOTO-OFL.txt).
- Noto Sans SC Regular: https://github.com/notofonts/noto-cjk/tree/main/Sans/SubsetOTF/SC (SIL Open Font License; see NOTO-CJK-OFL.txt).

Files were retrieved on 2026-10-23. The files are committed locally; upstream changes do not alter an existing installation.

Sinhala, Devanagari, and Arabic use the regular or bold face for italic requests because these bundles have no italic face. The Chinese bundle uses its regular face for all styles. This avoids substituting a font that lacks the script.

`src/lib/pdf-fonts.json` records the intersection of actual glyph coverage across each family's styles, including the existing Literata and pdfmake's bundled Roboto. Regenerate it from apps/web with:

    node scripts/generate-pdf-font-manifest.cjs

Glyph coverage alone is not a guarantee of language-specific typography or bidirectional layout. Representative output should be proofread when expanding language support. Characters not covered by a bundled family produce an explicit export error; they are never silently replaced by blank glyphs.
