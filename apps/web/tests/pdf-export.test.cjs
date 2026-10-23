const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const ts = require('typescript');
const { JSDOM } = require('jsdom');
const htmlToPdfmake = require('html-to-pdfmake');
const fontkit = require('fontkit');
const root = path.join(__dirname, '..');
// Compile in memory: test the real TypeScript module without generating repo files.
const filename = path.join(root, 'src/lib/pdf-export.ts');
const compiled = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true, resolveJsonModule: true },
}).outputText;
const moduleUnderTest = new Module(filename, module);
moduleUnderTest.filename = filename;
moduleUnderTest.paths = Module._nodeModulePaths(path.dirname(filename));
moduleUnderTest._compile(compiled, filename);
const pdf = moduleUnderTest.exports;
const window = new JSDOM('').window;
const png = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/l9sAAAAASUVORK5CYII=';
const image = { dataUrl: png, width: 800, height: 1200 };
const chapter = (content, extra = {}) => ({ number: 1, title: 'Opening', content, ...extra });
const deps = (extra = {}) => ({ window, htmlToPdfmake, resolveImage: async () => null, ...extra });
const build = (book, extra) => pdf.buildBookPdf({ title: 'Test Book', ...book }, deps(extra));
function texts(node) {
  if (typeof node === 'string') return node;
  if (Array.isArray(node)) return node.map(texts).join('');
  if (!node || typeof node !== 'object') return '';
  return texts(node.text) + texts(node.stack) + texts(node.table?.body) + texts(node.ul) + texts(node.ol);
}
function nodes(node, predicate, out = []) {
  if (Array.isArray(node)) node.forEach(n => nodes(n, predicate, out));
  else if (node && typeof node === 'object') {
    if (predicate(node)) out.push(node);
    for (const v of Object.values(node)) if (typeof v === 'object') nodes(v, predicate, out);
  }
  return out;
}

test('preserves authored title/half-title/contents and sorts without mutating input', async () => {
  const chapters = [chapter('<p>Back</p>', {kind:'BACK_MATTER'}), chapter('Body'), chapter('<p>Publisher imprint</p>', {kind:'FRONT_MATTER',slug:'title-page'}), chapter('', {kind:'FRONT_MATTER',slug:'dedication'})];
  const before = JSON.stringify(chapters);
  const d = await build({ chapters });
  assert.match(texts(d.content), /Publisher imprint/);
  assert.equal(JSON.stringify(chapters), before);
  assert.deepEqual(pdf.orderSections(chapters).map(c=>c.kind||'CHAPTER'), ['FRONT_MATTER','CHAPTER','BACK_MATTER']);
  for (const slug of ['half-title','contents']) assert.equal(pdf.orderSections([chapter('Author note',{kind:'FRONT_MATTER',slug})]).length,1);
});

test('numbers heading hierarchy, resets counters, and creates resolvable subsection contents', async () => {
  const d = await build({sectionDepth:3,numbering:'DECIMAL',chapters:[chapter('<h2>First</h2><h3>Child</h3><h4>Detail</h4><h2>Second</h2><h3>Next child</h3><p>Body</p>',{number:3})]});
  const text=texts(d.content);
  for (const heading of ['3.1 First','3.1.1 Child','3.1.1.1 Detail','3.2 Second','3.2.1 Next child']) assert.ok(text.includes(heading),heading);
  const ids=new Set(nodes(d.content,n=>n.id).map(n=>n.id));
  for(const node of nodes(d.content,n=>n.pageReference||n.linkToDestination)) assert.ok(ids.has(node.pageReference||node.linkToDestination));
});

test('respects unnumbered books, depth, and front-matter headings', async () => {
  const d=await build({numbering:'NONE',sectionDepth:1,chapters:[chapter('<h2>Opening section</h2><h3>Deep section</h3>'),chapter('<h2>Preface section</h2>',{kind:'FRONT_MATTER'})]});
  const text=texts(d.content);
  assert.ok(!text.includes('1.1 Opening'));
  const toc=d.content[1];
  assert.match(texts(toc),/Opening section/);
  assert.ok(!texts(toc).includes('Deep section'));
  assert.ok(!texts(toc).includes('Preface section'));
});

test('sanitises renderer injection, scripts, classes, unsafe links and inline styles', async () => {
  let converted='';
  const d=await build({chapters:[chapter(`<p class="coverTitle" onclick="alert(1)" data-pdfmake='{"font":"MissingFont"}' style="font-family:Bad;position:absolute;text-align:center">Safe <strong>bold</strong></p><script>secret()</script><a href="javascript:alert(1)">Bad</a><a href="https://example.com">Good</a><svg><text>Bad SVG</text></svg>`)]},{htmlToPdfmake:(html,options)=>{converted=html;return htmlToPdfmake(html,options);}});
  assert.ok(!/data-pdfmake|onclick|class=|script|javascript:|font-family|position:|svg/.test(converted));
  assert.match(converted,/text-align:center/);
  assert.match(converted,/<strong>bold<\/strong>/);
  assert.match(converted,/href="https:\/\/example.com"/);
  assert.ok(!texts(d.content).includes('secret'));
});

test('namespaces duplicate author IDs across chapters and removes broken fragment links', async () => {
  const content='<p id="same">Target</p><a href="#same">Jump</a><a href="#missing">Broken</a>';
  const d=await build({chapters:[chapter(content),chapter(content,{number:2})]});
  const ids=nodes(d.content,n=>n.id).map(n=>n.id);
  assert.equal(new Set(ids).size,ids.length);
  const links=nodes(d.content,n=>n.linkToDestination).map(n=>n.linkToDestination);
  assert.ok(!links.includes('missing'));
  links.forEach(id=>assert.ok(ids.includes(id),id));
});

test('uses the saved cover and caches the same source across cover and chapters', async () => {
  let count=0;
  const d=await build({coverUrl:'/cover.png',chapters:[chapter('<img src="/cover.png"><img src="/cover.png">')]},{resolveImage:async()=>{count++;return image;}});
  assert.equal(count,1);
  assert.equal(d.content[0].image,png);
  assert.deepEqual(d.content[0].fit,[432,648]);
});

test('missing/unsafe images and covers fall back with useful warnings', async () => {
  const warnings=[];
  let calls=0;
  const d=await build({coverUrl:'/missing.png',chapters:[chapter('<p>Text</p><img src="javascript:bad()" alt="Diagram">')]},{resolveImage:async()=>{calls++;throw Error('Network');},options:{onWarning:m=>warnings.push(m)}});
  assert.match(texts(d.content),/\[Image: Diagram\]/);
  assert.equal(calls,1);
  assert.equal(warnings.length,2);
  assert.ok(!d.content[0].image);
});

test('limits concurrent image work to four and reports progress', async () => {
  let active=0,max=0; const progress=[];
  await build({chapters:[chapter(Array.from({length:9},(_,i)=>`<img src="/${i}.png">`).join(''))]},{resolveImage:async()=>{max=Math.max(max,++active);await new Promise(r=>setTimeout(r,2));active--;return image;},options:{onProgress:m=>progress.push(m)}});
  assert.equal(max,4);
  assert.ok(progress.includes('Loading images (9/9)…'));
});

test('rejects zero-size images and keeps empty chapters readable', async () => {
  const d=await build({chapters:[chapter('<img src="/invalid.png">'),chapter('<p><br></p>',{number:2})]},{resolveImage:async()=>({...image,width:0})});
  assert.match(texts(d.content),/Image unavailable/);
  assert.match(texts(d.content),/This chapter has not been written yet/);
});

test('deadline settles even when the operation ignores abort, and aborts its signal', async () => {
  let signal;
  await assert.rejects(pdf.withPdfDeadline(s=>{signal=s;return new Promise(()=>{});},10),/timed out/);
  assert.ok(signal.aborted);
});

test('user cancellation settles pending work and prevents continuing the build', async () => {
  const controller=new AbortController();
  const pending=build({chapters:[chapter('<img src="/slow.png">')]},{resolveImage:()=>new Promise(()=>{}),options:{signal:controller.signal}});
  controller.abort();
  await assert.rejects(pending,/cancelled/);
  await assert.rejects(pdf.withPdfDeadline(()=>Promise.resolve(),100,controller.signal),/cancelled/);
});

test('URLs allow web images and safe links but reject executable/local schemes', () => {
  for(const value of ['javascript:alert(1)','file:///etc/passwd','blob:anything','data:text/html;base64,QQ==','https://user:password@example.com/x']) assert.equal(pdf.safePdfUrl(value,true),null);
  assert.equal(pdf.safePdfUrl('/uploads/image.png',true),'/uploads/image.png');
  assert.equal(pdf.safePdfUrl(png,true),png);
  assert.equal(pdf.safePdfUrl('mailto:author@example.com'),'mailto:author@example.com');
});

test('font coverage keeps mixed scripts and combining marks intact and rejects emoji explicitly', () => {
  for(const [text,family] of [['සිංහල','NotoSansSinhala'],['हिन्दी','NotoSansDevanagari'],['العربية','NotoNaskhArabic'],['中文','NotoSansSC']]) {
    const runs=pdf.pdfTextRuns(`English ${text}`);
    assert.equal(runs.map(r=>r.text).join(''),`English ${text}`);
    assert.ok(runs.some(r=>r.font===family),text);
  }
  assert.throws(()=>pdf.pdfTextRuns('😀'),/cannot display/);
});

test('coverage manifest matches the installed fonts in every supported style', () => {
  const manifest=require('../src/lib/pdf-fonts.json');
  const vfs=require('pdfmake/build/vfs_fonts');
  for(const {files,ranges} of Object.values(manifest)) {
    for(const filename of new Set(Object.values(files))) {
      const font=fontkit.create(vfs[filename]?Buffer.from(vfs[filename],'base64'):fs.readFileSync(path.join(root,'public/fonts/pdf',filename)));
      for(const [lo,hi] of ranges) for(let cp=lo;cp<=hi;cp++) assert.ok(font.hasGlyphForCodePoint(cp),`${filename}: ${cp}`);
    }
  }
});

test('plain text and safe filenames remain supported', () => {
  assert.equal(pdf.chapterHtml('Hello <crew>\nSecond & last'),'<p>Hello &lt;crew&gt;</p><p>Second &amp; last</p>');
  assert.equal(pdf.bookPdfFilename('A/B:*?'),'AB.pdf');
  assert.equal(pdf.bookPdfFilename('  '),'Untitled book.pdf');
});

test('real pdfmake generates a multipage PDF with mixed scripts, tables, contents, and authored matter', async () => {
  const pdfMake=require('pdfmake/build/pdfmake');
  const vfs=require('pdfmake/build/vfs_fonts');
  pdfMake.addVirtualFileSystem(vfs);
  const manifest=require('../src/lib/pdf-fonts.json');
  for(const [family,{files}] of Object.entries(manifest)) {
    if(family==='Roboto') continue;
    const assets=Object.fromEntries([...new Set(Object.values(files))].map(file=>[file,fs.readFileSync(path.join(root,'public/fonts/pdf',file)).toString('base64')]));
    pdfMake.addVirtualFileSystem(assets); pdfMake.addFonts({[family]:files});
  }
  const d=await build({chapters:[chapter('<p>Publisher edition 2026</p>',{kind:'FRONT_MATTER',slug:'title-page',title:'Title Page'}),chapter('<h2>Mixed scripts</h2><p>සිංහල हिन्दी 中文 العربية</p><table><tr><td>One</td><td>Two</td></tr></table><blockquote><p>Quotation</p></blockquote>'+ '<p>A paragraph for pagination. '.repeat(60)+'</p>')]});
  const buffer=await pdfMake.createPdf(d).getBuffer();
  assert.equal(Buffer.from(buffer).subarray(0,5).toString(),'%PDF-');
  assert.ok(buffer.length>5000);
  if(process.env.PDF_REVIEW_DIR) {
    fs.mkdirSync(process.env.PDF_REVIEW_DIR,{recursive:true});
    fs.writeFileSync(path.join(process.env.PDF_REVIEW_DIR,'mixed-scripts.pdf'),buffer);
  }
});

test('right-to-left content reports the renderer limitation', async () => {
  const warnings=[];
  await build({chapters:[chapter('<p>هذه جملة عربية</p>')]},{options:{onWarning:m=>warnings.push(m)}});
  assert.ok(warnings.some(w=>w.includes('paragraph direction')));
});

test('font loading requests only used families and fails explicitly on missing assets', async () => {
  const originalFetch=global.fetch;
  const requested=[]; const loaded=[];
  try {
    global.fetch=async src=>{requested.push(src);return new Response(fs.readFileSync(path.join(root,'public',src)),{status:200});};
    await pdf.loadPdfFonts({addVirtualFileSystem:()=>{},addFonts:fonts=>loaded.push(...Object.keys(fonts))},{content:[{text:[{text:'සිංහල',font:'NotoSansSinhala'}]}]});
    assert.deepEqual(loaded,['NotoSansSinhala']);
    assert.equal(requested.length,2);
    assert.ok(requested.every(p=>p.includes('NotoSansSinhala')));
    global.fetch=async()=>new Response('',{status:404});
    await assert.rejects(pdf.loadPdfFonts({},{content:[{text:[{text:'සිංහල',font:'NotoSansSinhala'}]}]}),/could not be loaded/);
  } finally {global.fetch=originalFetch;}
});

test('cancelling image decode settles and releases its temporary URL', async () => {
  const originalFetch=global.fetch, originalImage=global.Image;
  const originalCreate=URL.createObjectURL, originalRevoke=URL.revokeObjectURL;
  const controller=new AbortController(); const revoked=[];
  try {
    global.fetch=async()=>new Response(Buffer.from('mock-image'),{headers:{'Content-Type':'image/svg+xml'}});
    URL.createObjectURL=blob=>{assert.equal(blob.type,'image/svg+xml');return 'blob:review-image';};
    URL.revokeObjectURL=url=>revoked.push(url);
    global.Image=class {
      set src(value) {if(value) setImmediate(()=>controller.abort());}
    };
    await assert.rejects(pdf.loadImageInBrowser('/image.png',controller.signal),/cancelled/);
    assert.deepEqual(revoked,['blob:review-image']);
  } finally {
    global.fetch=originalFetch;global.Image=originalImage;
    URL.createObjectURL=originalCreate;URL.revokeObjectURL=originalRevoke;
  }
});

test('font substitution preserves bold, italic, underline, and links on inline leaves', async () => {
  const d=await build({chapters:[chapter('<p><strong>Bold English සිංහල</strong> <em>Italic हिन्दी</em> <u>Underlined</u> <a href="https://example.com">Linked 中文</a></p>')]});
  const leaf=nodes(d.content,n=>typeof n.text==='string');
  assert.ok(leaf.some(n=>n.text.includes('Bold English')&&n.bold));
  assert.ok(leaf.some(n=>n.text.includes('සිංහල')&&n.bold&&n.font==='NotoSansSinhala'));
  assert.ok(leaf.some(n=>n.text.includes('हिन्दी')&&n.italics));
  assert.ok(leaf.some(n=>n.text.includes('Underlined')&&[].concat(n.decoration||[]).includes('underline')));
  assert.ok(leaf.some(n=>n.text.includes('中文')&&n.link==='https://example.com'));
});
