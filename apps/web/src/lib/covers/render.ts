import { CoverTheme } from './themes';

/** Output size of a saved cover. 2:3 is the standard trade-paperback ratio. */
export const COVER_WIDTH = 800;
export const COVER_HEIGHT = 1200;

export interface CoverContent {
  title: string;
  author: string;
  genre: string;
}

const MAX_TITLE_LINES = 5;

/**
 * Draws a complete cover onto a canvas at COVER_WIDTH × COVER_HEIGHT.
 *
 * Pure apart from the canvas it is handed: same inputs, same pixels. That is
 * what makes the live preview, the downloaded PNG and the saved cover identical
 * — they are all this function, called on the same canvas.
 *
 * Callers should await document.fonts.ready first (see CoverGenerator), or the
 * first frame can be measured with a fallback font and wrap differently.
 */
export function drawCover(canvas: HTMLCanvasElement, content: CoverContent, theme: CoverTheme) {
  canvas.width = COVER_WIDTH;
  canvas.height = COVER_HEIGHT;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  const W = COVER_WIDTH;
  const H = COVER_HEIGHT;
  const margin = W * 0.1;

  ctx.save();
  ctx.clearRect(0, 0, W, H);

  // ── Background ────────────────────────────────────────────────────────────
  const bg = ctx.createLinearGradient(0, 0, W * 0.25, H);
  theme.background.forEach((c, i) => bg.addColorStop(i / Math.max(1, theme.background.length - 1), c));
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);

  // A soft vignette gives the flat gradient some depth on the dark themes.
  if (theme.id !== 'minimal') {
    const v = ctx.createRadialGradient(W / 2, H * 0.42, W * 0.2, W / 2, H / 2, H * 0.75);
    v.addColorStop(0, 'rgba(255,255,255,0.06)');
    v.addColorStop(1, 'rgba(0,0,0,0.35)');
    ctx.fillStyle = v;
    ctx.fillRect(0, 0, W, H);
  }

  drawMotif(ctx, theme, W, H);

  // ── Genre label ───────────────────────────────────────────────────────────
  const genre = content.genre.trim().toUpperCase();
  if (genre) {
    ctx.fillStyle = theme.accent;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'alphabetic';
    ctx.font = `600 26px ${theme.labelFont}`;
    drawSpaced(ctx, truncate(ctx, genre, W - margin * 2, 6), W / 2, H * 0.13, 6);
  }

  // ── Title ────────────────────────────────────────────────────────────────
  const title = content.title.trim() || 'Untitled';
  const titleTop = H * 0.2;
  const titleBottom = theme.motifKind === 'sun' || theme.motifKind === 'trees' || theme.motifKind === 'waves'
    ? H * 0.6 : H * 0.68;
  const fit = fitTitle(ctx, title, theme, W - margin * 2, titleBottom - titleTop);

  ctx.fillStyle = theme.text;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  ctx.font = fit.font;
  if (theme.id !== 'minimal') {
    ctx.shadowColor = 'rgba(0,0,0,0.35)';
    ctx.shadowBlur = 12;
    ctx.shadowOffsetY = 2;
  }
  const blockHeight = fit.lines.length * fit.lineHeight;
  // Vertically centre the block in its box, nudged up so short titles sit high.
  let y = titleTop + (titleBottom - titleTop - blockHeight) * 0.4 + fit.size;
  for (const line of fit.lines) {
    ctx.fillText(line, W / 2, y);
    y += fit.lineHeight;
  }
  ctx.shadowColor = 'transparent';
  ctx.shadowBlur = 0;
  ctx.shadowOffsetY = 0;

  // ── Ornament under the title ──────────────────────────────────────────────
  const ornY = y - fit.lineHeight + fit.size * 0.55;
  ctx.strokeStyle = theme.accent;
  ctx.fillStyle = theme.accent;
  ctx.lineWidth = 3;
  if (theme.motifKind === 'rule') {
    ctx.fillRect(W / 2 - 40, ornY, 80, 6);
  } else {
    ctx.beginPath();
    ctx.moveTo(W / 2 - 90, ornY);
    ctx.lineTo(W / 2 - 16, ornY);
    ctx.moveTo(W / 2 + 16, ornY);
    ctx.lineTo(W / 2 + 90, ornY);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(W / 2, ornY - 8);
    ctx.lineTo(W / 2 + 8, ornY);
    ctx.lineTo(W / 2, ornY + 8);
    ctx.lineTo(W / 2 - 8, ornY);
    ctx.closePath();
    ctx.fill();
  }

  // ── Author ───────────────────────────────────────────────────────────────
  const author = content.author.trim().toUpperCase();
  if (author) {
    ctx.textAlign = 'center';
    ctx.textBaseline = 'alphabetic';
    ctx.font = `500 34px ${theme.labelFont}`;
    // Waves/trees/sun fill the lower third, so the author needs a backing to stay legible.
    const authorY = H * 0.9;
    const text = truncate(ctx, author, W - margin * 2, 4);
    if (theme.motifKind !== 'rule' && theme.motifKind !== 'frame') {
      const w = Math.min(W - margin, measureSpaced(ctx, text, 4) + 60);
      ctx.fillStyle = 'rgba(0,0,0,0.28)';
      roundRect(ctx, W / 2 - w / 2, authorY - 46, w, 66, 33);
      ctx.fill();
    }
    ctx.fillStyle = theme.text;
    drawSpaced(ctx, text, W / 2, authorY, 4);
  }

  ctx.restore();
}

// ── Motifs ──────────────────────────────────────────────────────────────────

function drawMotif(ctx: CanvasRenderingContext2D, theme: CoverTheme, W: number, H: number) {
  ctx.save();
  switch (theme.motifKind) {
    case 'frame': {
      ctx.strokeStyle = theme.motif;
      ctx.globalAlpha = 0.9;
      ctx.lineWidth = 3;
      ctx.strokeRect(36, 36, W - 72, H - 72);
      ctx.globalAlpha = 0.5;
      ctx.lineWidth = 1.5;
      ctx.strokeRect(50, 50, W - 100, H - 100);
      break;
    }
    case 'waves': {
      for (let i = 0; i < 5; i++) {
        const base = H * 0.68 + i * 70;
        ctx.globalAlpha = 0.12 + i * 0.1;
        ctx.fillStyle = theme.motif;
        ctx.beginPath();
        ctx.moveTo(0, H);
        ctx.lineTo(0, base);
        for (let x = 0; x <= W; x += 10) {
          ctx.lineTo(x, base + Math.sin((x / W) * Math.PI * 3 + i * 1.3) * (18 + i * 4));
        }
        ctx.lineTo(W, H);
        ctx.closePath();
        ctx.fill();
      }
      break;
    }
    case 'sun': {
      // Low enough that the sun's top stays below the title box (which ends at 0.6H).
      const cx = W / 2;
      const cy = H * 0.85;
      const r = W * 0.3;
      const glow = ctx.createRadialGradient(cx, cy, r * 0.6, cx, cy, r * 2);
      glow.addColorStop(0, 'rgba(253,186,116,0.45)');
      glow.addColorStop(1, 'rgba(253,186,116,0)');
      ctx.fillStyle = glow;
      ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = theme.motif;
      ctx.globalAlpha = 0.85;
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.fill();
      // Horizon bands cut through the sun.
      ctx.globalAlpha = 1;
      ctx.fillStyle = '#3b0a2a';
      for (let i = 0; i < 6; i++) {
        const y = cy + i * 26 + 10;
        ctx.globalAlpha = 0.25 + i * 0.12;
        ctx.fillRect(0, y, W, 6 + i * 3);
      }
      ctx.globalAlpha = 0.9;
      ctx.fillRect(0, cy + 165, W, H);
      break;
    }
    case 'trees': {
      const rows = [
        { y: H * 0.8, h: 260, color: 'rgba(5,46,22,0.55)', step: 70 },
        { y: H * 0.88, h: 300, color: 'rgba(5,46,22,0.8)', step: 90 },
        { y: H * 0.98, h: 330, color: '#04200f', step: 110 },
      ];
      rows.forEach((row, ri) => {
        ctx.fillStyle = row.color;
        for (let x = -row.step / 2 + ri * 23; x < W + row.step; x += row.step) {
          const h = row.h * (0.75 + 0.25 * Math.abs(Math.sin(x * 0.37 + ri)));
          ctx.beginPath();
          ctx.moveTo(x, row.y - h);
          ctx.lineTo(x + row.step * 0.62, row.y);
          ctx.lineTo(x - row.step * 0.62, row.y);
          ctx.closePath();
          ctx.fill();
        }
        ctx.fillRect(0, row.y - 2, W, H - row.y + 2);
      });
      break;
    }
    case 'rule': {
      ctx.fillStyle = theme.accent;
      ctx.fillRect(0, 0, W, 14);
      ctx.fillStyle = theme.motif;
      ctx.globalAlpha = 0.15;
      ctx.fillRect(W * 0.1, H * 0.84, W * 0.8, 2);
      break;
    }
  }
  ctx.restore();
}

// ── Text helpers ────────────────────────────────────────────────────────────

interface TitleFit { lines: string[]; font: string; size: number; lineHeight: number }

/** Largest font size at which the title fits the box in MAX_TITLE_LINES or fewer. */
function fitTitle(
  ctx: CanvasRenderingContext2D, title: string, theme: CoverTheme, maxWidth: number, maxHeight: number,
): TitleFit {
  const style = theme.titleItalic ? 'italic ' : '';
  const weight = theme.id === 'minimal' ? 800 : 700;
  for (let size = 104; size >= 40; size -= 4) {
    const font = `${style}${weight} ${size}px ${theme.titleFont}`;
    ctx.font = font;
    const lines = wrap(ctx, title, maxWidth);
    const lineHeight = size * 1.12;
    if (lines.length <= MAX_TITLE_LINES && lines.length * lineHeight <= maxHeight) {
      return { lines, font, size, lineHeight };
    }
  }
  // Very long titles: smallest size, cut at the line limit with an ellipsis.
  const size = 40;
  const font = `${style}${weight} ${size}px ${theme.titleFont}`;
  ctx.font = font;
  const lines = wrap(ctx, title, maxWidth);
  if (lines.length > MAX_TITLE_LINES) {
    lines.length = MAX_TITLE_LINES;
    lines[MAX_TITLE_LINES - 1] = truncate(ctx, lines[MAX_TITLE_LINES - 1] + '…', maxWidth, 0);
  }
  return { lines, font, size, lineHeight: size * 1.12 };
}

/** Greedy word wrap. Words wider than the line are broken by character. */
export function wrap(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let line = '';
  for (const word of words) {
    const candidate = line ? `${line} ${word}` : word;
    if (ctx.measureText(candidate).width <= maxWidth) {
      line = candidate;
      continue;
    }
    if (line) lines.push(line);
    if (ctx.measureText(word).width <= maxWidth) {
      line = word;
      continue;
    }
    // Break an over-long word into pieces that fit.
    let piece = '';
    for (const ch of Array.from(word)) {
      if (ctx.measureText(piece + ch).width > maxWidth && piece) {
        lines.push(piece);
        piece = ch;
      } else {
        piece += ch;
      }
    }
    line = piece;
  }
  if (line) lines.push(line);
  return lines.length ? lines : [''];
}

function measureSpaced(ctx: CanvasRenderingContext2D, text: string, spacing: number) {
  return ctx.measureText(text).width + spacing * Math.max(0, Array.from(text).length - 1);
}

/** Shortens text with an ellipsis until it fits (accounting for letter spacing). */
function truncate(ctx: CanvasRenderingContext2D, text: string, maxWidth: number, spacing: number) {
  if (measureSpaced(ctx, text, spacing) <= maxWidth) return text;
  let chars = Array.from(text.replace(/…$/, ''));
  while (chars.length > 1 && measureSpaced(ctx, chars.join('') + '…', spacing) > maxWidth) chars.pop();
  return chars.join('').trimEnd() + '…';
}

/**
 * Centered, letter-spaced text. ctx.letterSpacing isn't in every browser this
 * site supports (Safari < 17), so spacing is done by hand.
 */
function drawSpaced(ctx: CanvasRenderingContext2D, text: string, cx: number, y: number, spacing: number) {
  const chars = Array.from(text);
  const total = measureSpaced(ctx, text, spacing);
  let x = cx - total / 2;
  const align = ctx.textAlign;
  ctx.textAlign = 'left';
  for (const ch of chars) {
    ctx.fillText(ch, x, y);
    x += ctx.measureText(ch).width + spacing;
  }
  ctx.textAlign = align;
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

/** Canvas → PNG blob. */
export function canvasToPng(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('Could not render the cover'))), 'image/png');
  });
}
