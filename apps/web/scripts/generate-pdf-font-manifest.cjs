// Run after changing PDF fonts: node scripts/generate-pdf-font-manifest.cjs
const fs = require('node:fs');
const path = require('node:path');
const fontkit = require('fontkit');
const root = path.join(__dirname, '..');
const fontDir = path.join(root, 'public/fonts/pdf');
const vfs = require('pdfmake/build/vfs_fonts');
const styles = (regular, bold, italic = regular, bolditalic = bold) => ({ normal: regular, bold, italics: italic, bolditalics: bolditalic });
const families = {
  Literata: styles('literata-latin-400-normal.woff', 'literata-latin-700-normal.woff', 'literata-latin-400-italic.woff', 'literata-latin-700-italic.woff'),
  Roboto: styles('Roboto-Regular.ttf', 'Roboto-Medium.ttf', 'Roboto-Italic.ttf', 'Roboto-MediumItalic.ttf'),
  NotoSansSinhala: styles('NotoSansSinhala-Regular.ttf', 'NotoSansSinhala-Bold.ttf'),
  NotoSansDevanagari: styles('NotoSansDevanagari-Regular.ttf', 'NotoSansDevanagari-Bold.ttf'),
  NotoNaskhArabic: styles('NotoNaskhArabic-Regular.ttf', 'NotoNaskhArabic-Bold.ttf'),
  NotoSansSC: styles('NotoSansSC-Regular.otf', 'NotoSansSC-Regular.otf'),
};
const manifest = {};
for (const [family, files] of Object.entries(families)) {
  const fonts = [...new Set(Object.values(files))].map(file => fontkit.create(vfs[file] ? Buffer.from(vfs[file], 'base64') : fs.readFileSync(path.join(fontDir, file))));
  const points = fonts[0].characterSet.filter(cp => fonts.every(f => f.hasGlyphForCodePoint(cp))).sort((a,b) => a-b);
  const ranges = [];
  for (const point of points) {
    const last = ranges.at(-1);
    if (last && last[1] + 1 === point) last[1] = point;
    else ranges.push([point, point]);
  }
  manifest[family] = { files, ranges };
}
fs.writeFileSync(path.join(root, 'src/lib/pdf-fonts.json'), JSON.stringify(manifest) + '\n');
