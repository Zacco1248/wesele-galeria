import sharp from 'sharp';
import { writeFileSync } from 'node:fs';

const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 92" width="1000" height="920">
  <path d="M50 88 C50 88 6 60 6 30 C6 13 19 6 30 6 C40 6 47 13 50 20 C53 13 60 6 70 6 C81 6 94 13 94 30 C94 60 50 88 50 88 Z" fill="#d6283b"/>
  <text x="30" y="52" text-anchor="middle" font-family="Cormorant Garamond, serif" font-weight="700" font-size="30" fill="#fff">B</text>
  <text x="50" y="52" text-anchor="middle" font-family="Cormorant Garamond, serif" font-weight="600" font-size="18" fill="#fff">&amp;</text>
  <text x="70" y="52" text-anchor="middle" font-family="Cormorant Garamond, serif" font-weight="700" font-size="30" fill="#fff">A</text>
</svg>`;
writeFileSync('qr/emblem.svg', svg, 'utf8');
await sharp(Buffer.from(svg)).png().toFile('qr/emblem.png');
console.log('ok');
