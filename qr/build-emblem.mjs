// Emblemat: czerwone serce + białe inicjały "B & A" (poziomo). Render do ostrego PNG.
import sharp from 'sharp';
import { writeFileSync } from 'node:fs';

const RED = '#d62828', WHITE = '#ffffff';
// czyste, symetryczne serce (bazowe 0..32 x 0..29.6), przeskalowane do 400
const heartBase = 'M23.6,0c-3.4,0-6.3,2.7-7.6,5.6C14.7,2.7,11.8,0,8.4,0C3.8,0,0,3.8,0,8.4c0,9.4,9.5,11.9,16,21.2c6.1-9.3,16-11.8,16-21.2C32,3.8,28.2,0,23.6,0z';

const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 400" width="1000" height="1000">
  <g transform="translate(0 15) scale(12.5)"><path d="${heartBase}" fill="${RED}"/></g>
  <text x="200" y="235" text-anchor="middle" font-family="Georgia,'Times New Roman',serif"
        font-size="132" font-weight="700" fill="${WHITE}">B<tspan dx="2" font-size="96" dy="-6">&amp;</tspan><tspan dx="2" dy="6">A</tspan></text>
</svg>`;

writeFileSync('qr/emblem.svg', svg, 'utf8');
await sharp(Buffer.from(svg)).png().toFile('qr/emblem.png');
console.log('emblem -> qr/emblem.png (1000x1000)');
