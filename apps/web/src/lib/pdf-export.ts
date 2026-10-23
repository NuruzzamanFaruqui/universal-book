import type { Content, ContentTable, TDocumentDefinitions } from 'pdfmake/interfaces';
import fontManifest from './pdf-fonts.json';

/**
 * PDF export: cover page, table of contents, then every section of the book
 * on its own page. Built entirely in the browser with pdfmake — the API is not
 * involved beyond the usual GET /api/books/:id.
 *
 * The document is built by `buildBookPdf`, which takes its DOM and image
 * loading as arguments so it can also be run under Node (jsdom) to check the
 * output. `exportBookPdf` wires it to the browser and downloads the file.
 */

export interface PdfChapter {
  id?: string;
  number: number;
  kind?: 'FRONT_MATTER' | 'CHAPTER' | 'BACK_MATTER' | null;
  slug?: string | null;
  title?: string | null;
  subtitle?: string | null;
  content?: string | null;
}

export interface PdfBook {
  title?: string | null;
  subtitle?: string | null;
  genre?: string | null;
  coverUrl?: string | null;
  numbering?: 'NONE' | 'DECIMAL';
  sectionDepth?: number;
  user?: { name?: string | null } | null;
  chapters?: PdfChapter[] | null;
}

export interface ResolvedImage {
  /** A PNG or JPEG data URL — the only formats pdfmake can embed. */
  dataUrl: string;
  /** Natural size in CSS pixels. */
  width: number;
  height: number;
}

export interface PdfBuildDeps {
  /** The html-to-pdfmake function. */
  htmlToPdfmake: (html: string, options: Record<string, unknown>) => any;
  /** A DOM window — the browser's own, or jsdom's under Node. */
  window: any;
  /** Turns an <img> src into embeddable data. Null drops the image. */
  resolveImage: (src: string, signal?: AbortSignal) => Promise<ResolvedImage | null>;
  options?: PdfExportOptions;
}

// 6 × 9 in, the usual trade paperback trim.
const PAGE = { width: 432, height: 648 };
const MARGIN = { side: 54, top: 60, bottom: 66 };
const CONTENT_WIDTH = PAGE.width - MARGIN.side * 2;
const CONTENT_HEIGHT = PAGE.height - MARGIN.top - MARGIN.bottom;

const INK = '#1a1a1a';
const MUTED = '#6b6b6b';
const COVER_BG = '#1d2a44';
const COVER_ACCENT = '#c9a96a';

const KIND_ORDER = { FRONT_MATTER: 0, CHAPTER: 1, BACK_MATTER: 2 } as const;

/**
 * Reading order — front matter, chapters, back matter — each by number. The
 * API sorts by number alone, which interleaves the three kinds.
 *
 * Every chapter is kept, written or not. Front and back matter are kept only
 * when they have text, since a new book carries a dozen empty templates.
 */
export function orderSections(chapters: PdfChapter[] = []): PdfChapter[] {
  return chapters
    .filter(c => {
      const kind = c.kind || 'CHAPTER';
      if (kind === 'CHAPTER') return true;
      return hasText(c.content);
    })
    .sort((a, b) =>
      KIND_ORDER[a.kind || 'CHAPTER'] - KIND_ORDER[b.kind || 'CHAPTER'] || a.number - b.number);
}

/** `[book-title].pdf`, minus the characters Windows and macOS reject. */
export function bookPdfFilename(title?: string | null): string {
  const safe = (title || '')
    .replace(/[\\/:*?"<>|\u0000-\u001f]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/[. ]+$/, '')
    .slice(0, 150);
  return `${safe || 'Untitled book'}.pdf`;
}

/**
 * Chapter content as HTML. The editor and AI store HTML; imported .txt books
 * store plain text, where a line break is a paragraph.
 */
export function chapterHtml(content?: string | null): string {
  const raw = content || '';
  // Only tags the editor or AI produce count: an imported "<crew>" is text.
  if (/<\/?(p|h[1-6]|br|div|strong|em|b|i|u|s|ul|ol|li|blockquote|img|a|span|hr|table|pre|code)\b[^>]*>/i.test(raw)) return raw;
  return raw
    .split(/\n+/)
    .map(line => line.trim())
    .filter(Boolean)
    .map(line => `<p>${escapeHtml(line)}</p>`)
    .join('');
}

function hasText(content?: string | null): boolean {
  return !!content && (/<img\b/i.test(content) || content.replace(/<[^>]*>|&nbsp;/g, '').trim().length > 0);
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

export interface PdfExportOptions {
  signal?: AbortSignal;
  onProgress?: (message: string) => void;
  onWarning?: (message: string) => void;
}

function cancelled(signal?: AbortSignal): void {
  if (signal?.aborted) throw new Error('PDF export cancelled.');
}

/** Bounds the whole operation, including decoding/body reads, not just fetch. */
export async function withPdfDeadline<T>(
  operation: (signal: AbortSignal) => Promise<T>,
  milliseconds: number,
  signal?: AbortSignal,
): Promise<T> {
  cancelled(signal);
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout>;
  let abort: () => void = () => {};
  const deadline = new Promise<never>((_, reject) => {
    abort = () => { controller.abort(); reject(new Error('PDF export cancelled.')); };
    signal?.addEventListener('abort', abort, { once: true });
    timer = setTimeout(() => {
      controller.abort();
      reject(new Error('PDF export timed out. Please try again.'));
    }, milliseconds);
  });
  try {
    return await Promise.race([Promise.resolve().then(() => operation(controller.signal)), deadline]);
  } finally {
    clearTimeout(timer!);
    signal?.removeEventListener('abort', abort);
  }
}

/** Only URLs that can be safely embedded or linked from a PDF are retained. */
export function safePdfUrl(raw: string, image = false): string | null {
  const value = raw.trim();
  if (!value || /[\u0000-\u0020\u007f]/.test(value)) return null;
  if (image && /^data:image\/(?:png|jpeg|gif|webp);base64,[a-z0-9+/=]+$/i.test(value)) return value;
  if (!image && value.startsWith('#')) return value;
  try {
    const url = new URL(value, 'https://pdf.invalid/');
    if (url.username || url.password) return null;
    if (['https:', 'http:'].includes(url.protocol) || (!image && url.protocol === 'mailto:')) return value;
  } catch { /* Invalid URL. */ }
  return null;
}

/** Rebuild a small HTML vocabulary; author HTML cannot set pdfmake properties. */
export function sanitisePdfHtml(body: HTMLElement, prefix: string): void {
  const allowed = new Set('P H1 H2 H3 H4 H5 H6 BR DIV STRONG EM B I U S UL OL LI BLOCKQUOTE IMG A SPAN HR TABLE THEAD TBODY TFOOT TR TD TH PRE CODE SUB SUP'.split(' '));
  body.querySelectorAll('script,style,iframe,object,embed,svg,math,link,meta,base,form,input,button,textarea,select,video,audio,source').forEach(el => el.remove());
  const ids = new Map<string, string>();
  for (const el of Array.from(body.querySelectorAll('*'))) {
    if (!allowed.has(el.tagName)) { el.replaceWith(...Array.from(el.childNodes)); continue; }
    const attributes = new Map(Array.from(el.attributes).map(a => [a.name, a.value]));
    for (const a of Array.from(el.attributes)) el.removeAttribute(a.name);
    const originalId = attributes.get('id');
    if (originalId && !ids.has(originalId)) {
      const id = `${prefix}-anchor-${ids.size + 1}`;
      ids.set(originalId, id); el.id = id;
    }
    if (el.tagName === 'IMG') {
      const src = safePdfUrl(attributes.get('src') || '', true);
      if (src) el.setAttribute('src', src);
      el.setAttribute('alt', attributes.get('alt') || '');
    }
    if (el.tagName === 'A') {
      const href = safePdfUrl(attributes.get('href') || '');
      if (href) el.setAttribute('href', href);
    }
    if (['TD', 'TH'].includes(el.tagName)) {
      for (const name of ['colspan', 'rowspan']) {
        const value = Number(attributes.get(name));
        if (Number.isInteger(value) && value > 0 && value <= 20) el.setAttribute(name, String(value));
      }
    }
    if (el.tagName === 'OL' && /^-?\d{1,5}$/.test(attributes.get('start') || '')) el.setAttribute('start', attributes.get('start')!);
    const align = /(?:^|;)\s*text-align\s*:\s*(left|right|center|justify)\s*(?:;|$)/i.exec(attributes.get('style') || '');
    if (align) el.setAttribute('style', `text-align:${align[1].toLowerCase()}`);
  }
  body.querySelectorAll('a[href^="#"]').forEach(a => {
    const target = ids.get(a.getAttribute('href')!.slice(1));
    if (target) a.setAttribute('href', `#${target}`); else a.removeAttribute('href');
  });
}

type FontName = keyof typeof fontManifest;
const FONT_NAMES = Object.keys(fontManifest) as FontName[];
const IGNORABLE = /^[\s\u200b-\u200f\u202a-\u202e\u2060-\u206f\ufe00-\ufe0f]*$/;
function covers(font: FontName, text: string): boolean {
  const ranges: number[][] = fontManifest[font].ranges;
  return Array.from(text).every(c => IGNORABLE.test(c) || ranges.some(([lo, hi]) => c.codePointAt(0)! >= lo && c.codePointAt(0)! <= hi));
}

/** Existing public helper, now based on the actual font files. */
export function pickFont(texts: string[]): 'Literata' | 'Roboto' {
  return texts.every(t => covers('Literata', t)) ? 'Literata' : 'Roboto';
}

/** Keep grapheme clusters intact so combining marks stay with their base. */
export function pdfTextRuns(text: string): { text: string; font: FontName }[] {
  const runs: { text: string; font: FontName }[] = [];
  const segments = new Intl.Segmenter(undefined, { granularity: 'grapheme' }).segment(text);
  for (const { segment } of Array.from(segments)) {
    const font = FONT_NAMES.find(name => covers(name, segment));
    if (!font) {
      const codes = Array.from(segment).map(c => `U+${c.codePointAt(0)!.toString(16).toUpperCase()}`).join(' ');
      throw new Error(`PDF export cannot display “${segment}” (${codes}) yet. Please remove or replace this character and try again.`);
    }
    const previous = runs[runs.length - 1];
    if (previous?.font === font) previous.text += segment;
    else runs.push({ text: segment, font });
  }
  return runs;
}

/** pdfmake flattens nested inline arrays, so keep formatting on each leaf. */
function fontInlines(value: any, inherited: Record<string, any> = {}): any[] {
  if (typeof value === 'string') return pdfTextRuns(value).map(run => ({ ...inherited, ...run }));
  if (Array.isArray(value)) return value.flatMap(part => fontInlines(part, inherited));
  if (!value || typeof value !== 'object') return [];
  if (value.text !== undefined) {
    const properties = { ...inherited, ...value };
    delete properties.text;
    const runs = fontInlines(value.text, properties);
    // An inline anchor belongs on its first fragment only.
    runs.slice(1).forEach(run => { delete run.id; });
    return runs;
  }
  applyPdfFonts(value);
  return [{ ...inherited, ...value }];
}

function applyPdfFonts(node: any): void {
  if (Array.isArray(node)) { node.forEach(applyPdfFonts); return; }
  if (!node || typeof node !== 'object') return;
  if (typeof node.text === 'string') {
    const runs = pdfTextRuns(node.text);
    if (runs.length === 1) node.font = runs[0].font;
    else node.text = runs;
  } else if (Array.isArray(node.text)) node.text = fontInlines(node.text);
  for (const key of ['stack', 'ul', 'ol', 'columns']) if (Array.isArray(node[key])) applyPdfFonts(node[key]);
  if (node.table?.body) applyPdfFonts(node.table.body);
}

/** Fits an image inside the text block without ever enlarging it. */
function imageSize(img: ResolvedImage): { width: number; height: number } {
  // CSS pixels to points.
  const w = img.width * 0.75;
  const h = img.height * 0.75;
  const scale = Math.min(1, CONTENT_WIDTH / w, (CONTENT_HEIGHT * 0.8) / h);
  return { width: Math.max(1, w * scale), height: Math.max(1, h * scale) };
}

/**
 * Walks html-to-pdfmake output: sizes images from what was loaded, and marks
 * headings so `pageBreakBefore` can keep them off the bottom of a page.
 */
function finishNodes(node: any, sizes: Map<string, { width: number; height: number }>): void {
  if (Array.isArray(node)) { node.forEach(n => finishNodes(n, sizes)); return; }
  if (!node || typeof node !== 'object') return;

  if (typeof node.image === 'string') {
    const size = sizes.get(node.image);
    delete node.fit;
    if (size) { node.width = size.width; node.height = size.height; }
    node.alignment = 'center';
    node.margin = [0, 6, 0, 12];
  }
  if (typeof node.nodeName === 'string' && /^H[1-6]$/.test(node.nodeName)) node.headlineLevel = 1;
  // html-to-pdfmake hands the blockquote style to its paragraphs, whose own
  // margins then win; the indent has to sit on the quote itself.
  if (node.nodeName === 'BLOCKQUOTE') node.margin = [18, 2, 18, 4];

  for (const key of ['stack', 'text', 'ul', 'ol', 'columns']) {
    if (Array.isArray(node[key])) finishNodes(node[key], sizes);
  }
  if (node.table?.body) node.table.body.forEach((row: any) => finishNodes(row, sizes));
}

/** The pdfmake document definition for a whole book. */
export async function buildBookPdf(book: PdfBook, deps: PdfBuildDeps): Promise<TDocumentDefinitions> {
  const options = deps.options || {};
  cancelled(options.signal);
  options.onProgress?.('Preparing your book…');
  const title = (book.title || '').trim() || 'Untitled book';
  const author = (book.user?.name || '').trim();
  const genre = (book.genre || '').trim();
  const sections = orderSections(book.chapters || []);

  // Parse every section first: the font choice depends on all of the text.
  const parsed = sections.map(section => {
    cancelled(options.signal);
    const doc = new deps.window.DOMParser().parseFromString(
      `<!DOCTYPE html><body>${chapterHtml(section.content)}</body>`, 'text/html');
    sanitisePdfHtml(doc.body, `pdf-section-${sections.indexOf(section) + 1}`);
    return { section, body: doc.body as HTMLElement };
  });

  const bookTexts = [
    title, book.subtitle || '', author, genre,
    ...parsed.flatMap(p => [p.section.title || '', p.section.subtitle || '', p.body.textContent || '']),
  ];
  const font = pickFont(bookTexts);
  if (bookTexts.some(text => /[\u0590-\u08ff]/.test(text))) {
    options.onWarning?.('Right-to-left text needs proofreading: this PDF renderer does not fully support paragraph direction.');
  }

  const cache = new Map<string, ResolvedImage | null>();
  const sizes = new Map<string, { width: number; height: number }>();
  const coverSrc = book.coverUrl ? safePdfUrl(book.coverUrl, true) : null;
  const sources = Array.from(new Set([
    ...(coverSrc ? [coverSrc] : []),
    ...parsed.flatMap(({ body }) => Array.from(body.querySelectorAll('img')).map(img => img.getAttribute('src') || '').filter(Boolean)),
  ]));
  let next = 0;
  let complete = 0;
  await Promise.all(Array.from({ length: Math.min(4, sources.length) }, async () => {
    while (next < sources.length) {
      cancelled(options.signal);
      const src = sources[next++];
      let loaded: ResolvedImage | null = null;
      try { loaded = await withPdfDeadline(signal => deps.resolveImage(src, signal), 15000, options.signal); }
      catch { cancelled(options.signal); }
      if (loaded && (!Number.isFinite(loaded.width) || !Number.isFinite(loaded.height) || loaded.width <= 0 || loaded.height <= 0)) loaded = null;
      cache.set(src, loaded);
      options.onProgress?.(`Loading images (${++complete}/${sources.length})…`);
    }
  }));
  for (const { body } of parsed) {
    for (const img of Array.from(body.querySelectorAll('img'))) {
      const loaded = cache.get(img.getAttribute('src') || '');
      if (loaded) {
        sizes.set(loaded.dataUrl, imageSize(loaded));
        img.setAttribute('src', loaded.dataUrl);
      } else {
        const note = body.ownerDocument.createElement('p');
        note.className = 'pdf-missing-image';
        note.textContent = img.getAttribute('alt') ? `[Image: ${img.getAttribute('alt')}]` : '[Image unavailable]';
        img.replaceWith(note);
        options.onWarning?.('An image could not be loaded. Its description is included in the PDF.');
      }
    }
  }
  const savedCover = coverSrc ? cache.get(coverSrc) : null;
  if (book.coverUrl && !savedCover) options.onWarning?.('The saved cover could not be loaded. A text cover was used.');

  const htmlOptions = {
    window: deps.window,
    removeExtraBlanks: true,
    // Pasted HTML carries fonts pdfmake does not have (and would throw on) and
    // sizes that fight the book's typography.
    ignoreStyles: ['font-family', 'font-size', 'line-height', 'background-color'],
    defaultStyles: {
      h1: { fontSize: 17, bold: true, margin: [0, 14, 0, 6] },
      h2: { fontSize: 14.5, bold: true, margin: [0, 12, 0, 5] },
      h3: { fontSize: 12.5, bold: true, margin: [0, 10, 0, 4] },
      h4: { fontSize: 11.5, bold: true, italics: true, margin: [0, 8, 0, 3] },
      h5: { fontSize: 11, bold: true, margin: [0, 8, 0, 3] },
      h6: { fontSize: 11, bold: true, margin: [0, 8, 0, 3] },
      p: { margin: [0, 0, 0, 6], alignment: 'justify' },
      a: { color: '#1f3a8a', decoration: 'underline' },
      ul: { margin: [12, 0, 0, 8] },
      ol: { margin: [12, 0, 0, 8] },
      li: { margin: [0, 0, 0, 3] },
      blockquote: { italics: true, color: '#3d3d3d' },
      table: { margin: [0, 4, 0, 10] },
    },
  };

  const toc: ContentTable['table']['body'] = [];
  const body: Content[] = [];

  parsed.forEach(({ section, body: html }, i) => {
    cancelled(options.signal);
    const id = `pdf-section-${i + 1}`;
    const isChapter = (section.kind || 'CHAPTER') === 'CHAPTER';
    const label = isChapter ? `Chapter ${section.number}` : '';
    const heading = (section.title || '').trim() || (isChapter ? '' : 'Untitled');

    toc.push(isChapter
      ? [
          { text: label, style: 'tocLabel', linkToDestination: id },
          { text: heading, style: 'tocTitle', linkToDestination: id },
          { pageReference: id, style: 'tocPage' },
        ]
      : [
          { text: heading, style: 'tocTitle', colSpan: 2, linkToDestination: id },
          {},
          { pageReference: id, style: 'tocPage' },
        ]);

    const counters = [0, 0, 0];
    const depth = Math.max(0, Math.min(3, book.sectionDepth ?? 3));
    const headings: { id: string; title: string; level: number }[] = [];
    for (const h of Array.from(html.querySelectorAll('h2,h3,h4'))) {
      const level = Number(h.tagName[1]) - 1;
      if (!isChapter || level > depth || !h.textContent?.trim()) continue;
      counters[level - 1]++;
      counters.fill(0, level);
      const number = book.numbering !== 'NONE' ? `${[section.number, ...counters.slice(0, level)].join('.')} ` : '';
      if (number) h.prepend(html.ownerDocument.createTextNode(number));
      h.id ||= `${id}-heading-${headings.length + 1}`;
      headings.push({ id: h.id, title: h.textContent || '', level });
    }
    for (const h of headings) toc.push([
      { text: h.title, colSpan: 2, margin: [h.level * 12, 0, 8, 5], linkToDestination: h.id, fontSize: 9 }, {},
      { pageReference: h.id, style: 'tocPage' },
    ]);
    const content = deps.htmlToPdfmake(html.innerHTML, htmlOptions);
    finishNodes(content, sizes);

    // pdfmake only resolves ids on text nodes, so the id goes on the first line
    // of the heading rather than on the stack.
    body.push({
      pageBreak: 'before',
      stack: [
        label ? { id, text: label.toUpperCase(), style: 'chapterLabel' } : '',
        heading ? { id: label ? undefined : id, text: heading, style: 'chapterTitle' } : '',
        section.subtitle ? { text: section.subtitle, style: 'chapterSubtitle' } : '',
        { canvas: [{ type: 'line', x1: 0, y1: 0, x2: 40, y2: 0, lineWidth: 0.8, lineColor: COVER_ACCENT }], margin: [0, 4, 0, 26] },
        hasText(html.innerHTML)
          ? content
          : { text: 'This chapter has not been written yet.', italics: true, color: MUTED },
      ],
    });
  });

  const cover: Content = savedCover ? {
    image: savedCover.dataUrl,
    fit: [PAGE.width, PAGE.height],
    absolutePosition: { x: (PAGE.width - Math.min(PAGE.width, PAGE.height * savedCover.width / savedCover.height)) / 2, y: 0 },
  } : {
    stack: [
      genre ? { text: genre.toUpperCase(), style: 'coverGenre' } : '',
      { text: title, style: 'coverTitle' },
      book.subtitle ? { text: book.subtitle, style: 'coverSubtitle' } : '',
      { canvas: [{ type: 'line', x1: 0, y1: 0, x2: 60, y2: 0, lineWidth: 1, lineColor: COVER_ACCENT }], alignment: 'center', margin: [0, 26, 0, 26] },
      author ? { text: author, style: 'coverAuthor' } : '',
    ],
    margin: [0, 130, 0, 0],
  };

  const contents: Content = {
    pageBreak: 'before',
    stack: [
      { text: 'Contents', style: 'chapterTitle', margin: [0, 0, 0, 24] },
      toc.length
        ? { table: { widths: ['auto', '*', 'auto'], body: toc, dontBreakRows: true }, layout: 'noBorders' }
        : { text: 'This book has no chapters yet.', italics: true, color: MUTED },
    ],
  };

  const documentContent = [cover, contents, ...body];
  applyPdfFonts(documentContent);
  return {
    info: { title, author: author || undefined, subject: genre || undefined, creator: 'Universal Book' },
    pageSize: PAGE,
    pageMargins: [MARGIN.side, MARGIN.top, MARGIN.side, MARGIN.bottom],
    defaultStyle: { font, fontSize: 10, lineHeight: 1.12, color: INK },
    content: documentContent,
    // A full-bleed colour behind the cover; every other page is plain.
    background: (page: number) => page === 1
      ? { canvas: [{ type: 'rect', x: 0, y: 0, w: PAGE.width, h: PAGE.height, color: COVER_BG }] }
      : null,
    // Page numbers match the table of contents, which counts the cover as 1.
    footer: (page: number) => page === 1
      ? null
      : { text: String(page), alignment: 'center', fontSize: 9, color: MUTED, margin: [0, 26, 0, 0] },
    // Never leave a heading alone at the foot of a page. pdfmake also reports a
    // contents-page number as sitting on the page it points to, so only nodes
    // below the heading count as following it.
    pageBreakBefore: (node: any, nodes: any) =>
      node.headlineLevel === 1 &&
      !nodes.getFollowingNodesOnPage().some((n: any) => n.startPosition.top > node.startPosition.top),
    styles: {
      coverGenre: { fontSize: 10, characterSpacing: 2.5, color: COVER_ACCENT, alignment: 'center', margin: [0, 0, 0, 22] },
      coverTitle: { fontSize: 30, bold: true, color: '#ffffff', alignment: 'center', lineHeight: 1.1 },
      coverSubtitle: { fontSize: 14, italics: true, color: '#d9dee8', alignment: 'center', margin: [0, 12, 0, 0] },
      coverAuthor: { fontSize: 14, color: '#ffffff', alignment: 'center', characterSpacing: 1 },
      chapterLabel: { fontSize: 9.5, characterSpacing: 2, color: MUTED, margin: [0, 40, 0, 6] },
      chapterTitle: { fontSize: 22, bold: true, lineHeight: 1.15 },
      chapterSubtitle: { fontSize: 13, italics: true, color: MUTED, margin: [0, 6, 0, 0] },
      tocLabel: { fontSize: 10, color: MUTED, margin: [0, 1, 10, 7] },
      tocTitle: { fontSize: 11, margin: [0, 0, 8, 7] },
      tocPage: { fontSize: 11, alignment: 'right', margin: [0, 0, 0, 7] },
      'pdf-missing-image': { italics: true, color: MUTED, alignment: 'center' },
    },
  };
}

/** Read assets with a byte limit, including responses without Content-Length. */
async function fetchPdfAsset(src: string, signal: AbortSignal, maxBytes: number): Promise<{ bytes: Uint8Array; contentType: string }> {
  const res = await fetch(src, { signal });
  if (!res.ok) throw new Error(`PDF asset could not be loaded (${res.status}).`);
  const contentType = res.headers.get('content-type') || '';
  if (Number(res.headers.get('content-length')) > maxBytes) throw new Error('PDF asset is too large.');
  if (!res.body) {
    const bytes = new Uint8Array(await res.arrayBuffer());
    if (bytes.length > maxBytes) throw new Error('PDF asset is too large.');
    return { bytes, contentType };
  }
  const reader = res.body.getReader();
  const parts: Uint8Array[] = [];
  let length = 0;
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      length += value.length;
      if (length > maxBytes) { await reader.cancel(); throw new Error('PDF asset is too large.'); }
      parts.push(value);
    }
  } finally { reader.releaseLock(); }
  const bytes = new Uint8Array(length);
  let offset = 0;
  for (const part of parts) { bytes.set(part, offset); offset += part.length; }
  return { bytes, contentType };
}

/** The caller's deadline covers fetching, body reads and image decoding. */
export async function loadImageInBrowser(src: string, signal?: AbortSignal): Promise<ResolvedImage | null> {
  return withPdfDeadline(async innerSignal => {
    const { bytes, contentType } = await fetchPdfAsset(src, innerSignal, 15 * 1024 * 1024);
    const url = URL.createObjectURL(new Blob([bytes as BlobPart], { type: contentType }));
    const img = new Image();
    let stop: () => void = () => {};
    try {
      await new Promise<void>((resolve, reject) => {
        stop = () => { img.src = ''; reject(new Error('Image loading cancelled.')); };
        innerSignal.addEventListener('abort', stop, { once: true });
        img.onload = () => resolve();
        img.onerror = () => reject(new Error('Image could not be decoded.'));
        if (innerSignal.aborted) stop(); else img.src = url;
      });
      if (!img.naturalWidth || !img.naturalHeight) return null;
      const scale = Math.min(1, 1600 / Math.max(img.naturalWidth, img.naturalHeight));
      const canvas = document.createElement('canvas');
      canvas.width = Math.max(1, Math.round(img.naturalWidth * scale));
      canvas.height = Math.max(1, Math.round(img.naturalHeight * scale));
      const ctx = canvas.getContext('2d');
      if (!ctx) return null;
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      return { dataUrl: canvas.toDataURL('image/jpeg', 0.9), width: img.naturalWidth, height: img.naturalHeight };
    } finally {
      innerSignal.removeEventListener('abort', stop);
      img.onload = img.onerror = null;
      URL.revokeObjectURL(url);
    }
  }, 15000, signal);
}

function usedFonts(node: any, fonts = new Set<FontName>()): Set<FontName> {
  if (Array.isArray(node)) node.forEach(n => usedFonts(n, fonts));
  else if (node && typeof node === 'object') {
    if (node.font && FONT_NAMES.includes(node.font)) fonts.add(node.font);
    for (const value of Object.values(node)) if (typeof value === 'object') usedFonts(value, fonts);
  }
  return fonts;
}

/** Fetch only the families this book uses; scripts never depend on a CDN. */
export async function loadPdfFonts(pdfMake: any, definition: TDocumentDefinitions, options: PdfExportOptions = {}): Promise<void> {
  const fonts = usedFonts(definition.content);
  if (definition.defaultStyle?.font) fonts.add(definition.defaultStyle.font as FontName);
  await Promise.all(Array.from(fonts).filter(font => font !== 'Roboto').map(async font => {
    const files = fontManifest[font].files;
    const entries = await Promise.all(Array.from(new Set(Object.values(files))).map(async filename => {
      const { bytes } = await withPdfDeadline(signal => fetchPdfAsset(`/fonts/pdf/${filename}`, signal, 20 * 1024 * 1024), 15000, options.signal);
      let binary = '';
      for (let i = 0; i < bytes.length; i += 0x8000) binary += String.fromCharCode(...Array.from(bytes.subarray(i, i + 0x8000)));
      return [filename, btoa(binary)];
    }));
    pdfMake.addVirtualFileSystem(Object.fromEntries(entries));
    pdfMake.addFonts({ [font]: files });
  }));
}

/** Render once, then trigger download only if the operation is still active. */
export async function exportBookPdf(book: PdfBook, options: PdfExportOptions = {}): Promise<void> {
  cancelled(options.signal);
  options.onProgress?.('Loading PDF tools…');
  const [{ default: pdfMake }, { default: vfs }, { default: htmlToPdfmake }] = await withPdfDeadline(() => Promise.all([
    import('pdfmake/build/pdfmake'), import('pdfmake/build/vfs_fonts'), import('html-to-pdfmake'),
  ]), 30000, options.signal);
  pdfMake.addVirtualFileSystem(vfs);
  const definition = await withPdfDeadline(signal => buildBookPdf(book, {
    htmlToPdfmake, window, resolveImage: loadImageInBrowser, options: { ...options, signal },
  }), 90000, options.signal);
  options.onProgress?.('Loading fonts…');
  await loadPdfFonts(pdfMake, definition, options);
  cancelled(options.signal);
  options.onProgress?.('Rendering your PDF…');
  // pdfmake runs on the main thread; cancellation prevents download even when
  // an in-progress synchronous layout cannot be interrupted immediately.
  const blob = await withPdfDeadline(() => pdfMake.createPdf(definition).getBlob(), 120000, options.signal);
  cancelled(options.signal);
  const url = URL.createObjectURL(blob as Blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = bookPdfFilename(book.title);
  document.body.appendChild(anchor);
  try { anchor.click(); } finally {
    anchor.remove();
    setTimeout(() => URL.revokeObjectURL(url), 30000);
  }
  options.onProgress?.('PDF download started.');
}
