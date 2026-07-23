import opentype from 'opentype.js';
import sharp from 'sharp';
import { writeFileSync, readFileSync } from 'node:fs';

const FONT = 'node_modules/@fontsource/dancing-script/files/dancing-script-latin-700-normal.woff';
const font = opentype.parse(readFileSync(FONT).buffer.slice(readFileSync(FONT).byteOffset, readFileSync(FONT).byteOffset + readFileSync(FONT).byteLength));

const HEART = '#f5a623', WHITE = '#fff';
function glyph(ch, cx, baseline, size) {
  const w = font.getAdvanceWidth(ch, size);
  return font.getPath(ch, cx - w / 2, baseline, size).toPathData(3);
}
// układ jak w SVG użytkownika: B(x30,s30), &(x50,s18), A(x70,s30), baseline y52
const b = glyph('B', 30, 55, 34);
const amp = glyph('&', 50, 53, 20);
const a = glyph('A', 70, 55, 34);

const heartPath = 'M50 88 C50 88 6 60 6 30 C6 13 19 6 30 6 C40 6 47 13 50 20 C53 13 60 6 70 6 C81 6 94 13 94 30 C94 60 50 88 50 88 Z';
const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 92" width="1000" height="920">
  <path d="${heartPath}" fill="${HEART}"/>
  <path d="${b}" fill="${WHITE}"/>
  <path d="${amp}" fill="${WHITE}"/>
  <path d="${a}" fill="${WHITE}"/>
</svg>`;
writeFileSync('qr/emblem.svg', svg, 'utf8');
await sharp(Buffer.from(svg)).png().toFile('qr/emblem.png');
console.log('emblem ok; & width:', font.getAdvanceWidth('&', 20).toFixed(1));
