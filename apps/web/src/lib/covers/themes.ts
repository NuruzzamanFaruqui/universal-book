/**
 * The five cover themes. Pure data, so the renderer, the theme picker and any
 * future server-side renderer all read the same values.
 */

export type CoverThemeId = 'dark' | 'ocean' | 'sunset' | 'forest' | 'minimal';

export type CoverMotif = 'frame' | 'waves' | 'sun' | 'trees' | 'rule';

export interface CoverTheme {
  id: CoverThemeId;
  name: string;
  /** Background gradient, top to bottom. */
  background: string[];
  /** Title and author colour. */
  text: string;
  /** Genre label, ornament and motif colour. */
  accent: string;
  /** Secondary motif colour (waves, trees, sun glow). */
  motif: string;
  motifKind: CoverMotif;
  titleFont: string;
  labelFont: string;
  /** Title in italics, for the softer themes. */
  titleItalic?: boolean;
}

const SERIF = "Georgia, 'Times New Roman', Times, serif";
const SANS = "'Helvetica Neue', Helvetica, Arial, sans-serif";

export const COVER_THEMES: CoverTheme[] = [
  {
    id: 'dark', name: 'Dark',
    background: ['#0b1120', '#111827', '#1f2937'],
    text: '#f8fafc', accent: '#d4a64a', motif: '#d4a64a', motifKind: 'frame',
    titleFont: SERIF, labelFont: SANS,
  },
  {
    id: 'ocean', name: 'Ocean',
    background: ['#082f49', '#0c4a6e', '#0e7490'],
    text: '#f0f9ff', accent: '#7dd3fc', motif: '#38bdf8', motifKind: 'waves',
    titleFont: SERIF, labelFont: SANS,
  },
  {
    id: 'sunset', name: 'Sunset',
    background: ['#3b0a2a', '#9a3412', '#f59e0b'],
    text: '#fff7ed', accent: '#fde68a', motif: '#fdba74', motifKind: 'sun',
    titleFont: SERIF, labelFont: SANS, titleItalic: true,
  },
  {
    id: 'forest', name: 'Forest',
    background: ['#0f2a1d', '#14532d', '#1a3a2a'],
    text: '#f0fdf4', accent: '#bbf7d0', motif: '#052e16', motifKind: 'trees',
    titleFont: SERIF, labelFont: SANS,
  },
  {
    id: 'minimal', name: 'Minimal',
    background: ['#fafaf9', '#f5f5f4'],
    text: '#1c1917', accent: '#b91c1c', motif: '#1c1917', motifKind: 'rule',
    titleFont: SANS, labelFont: SANS,
  },
];

export const DEFAULT_THEME: CoverThemeId = 'dark';

export function getTheme(id: string | undefined): CoverTheme {
  return COVER_THEMES.find((t) => t.id === id) ?? COVER_THEMES[0];
}
