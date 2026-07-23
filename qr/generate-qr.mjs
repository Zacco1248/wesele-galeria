#!/usr/bin/env node
/**
 * Generator kodów QR na winietki weselne.
 *
 * Tworzy plik SVG (wektor, do druku w dowolnej rozdzielczości) oraz PNG w
 * wysokiej rozdzielczości. Kod używa korekcji błędów H (~30%), więc w środku
 * można umieścić logo/inicjały bez utraty skanowalności. Markery pozycjonujące
 * w narożnikach i strefa ciszy (quiet zone) pozostają nienaruszone.
 *
 * Użycie:
 *   node qr/generate-qr.mjs --url https://wesele.moneylet.pl
 *   node qr/generate-qr.mjs --url https://wesele.moneylet.pl --logo ./logo.png \
 *        --fg "#3a322b" --bg "#faf6f0" --label "Zeskanuj i dodaj zdjęcia"
 *
 * Winietki spersonalizowane (parametr ?g=Imię w URL, po jednym pliku na gościa):
 *   node qr/generate-qr.mjs --url https://wesele.moneylet.pl --names "Basia,Marek,Ola i Tomek"
 *   node qr/generate-qr.mjs --url https://wesele.moneylet.pl --names-file goscie.txt
 *
 * Wynik trafia do qr/out/.
 */
import QRCode from 'qrcode';
import sharp from 'sharp';
import { readFileSync, mkdirSync, writeFileSync, existsSync } from 'node:fs';
import { extname, join } from 'node:path';

const args = parseArgs(process.argv.slice(2));

const url = args.url;
if (!url) {
	console.error('Brak parametru --url. Przykład:\n  node qr/generate-qr.mjs --url https://wesele.moneylet.pl');
	process.exit(1);
}

const opts = {
	fg: args.fg || '#3a322b',
	bg: args.bg || '#ffffff',
	pngSize: Number.parseInt(args.size || '2000', 10),
	margin: Number.parseInt(args.margin || '4', 10), // quiet zone in modules
	logoPath: args.logo || null,
	logoScale: Number.parseFloat(args['logo-scale'] || '0.24'), // logo width as fraction of QR (max ~0.30 for ECC H)
	label: args.label || null
};

const outDir = args.out || join('qr', 'out');
mkdirSync(outDir, { recursive: true });

const logoDataUri = opts.logoPath ? loadLogo(opts.logoPath) : null;

const names = getNames(args);

if (names.length === 0) {
	await generate(url, join(outDir, 'qr-galeria'));
	console.log(`\nGotowe → ${outDir}/qr-galeria.svg + .png`);
} else {
	for (const name of names) {
		const target = new URL(url);
		target.searchParams.set('g', name);
		const slug = name.toLowerCase().replace(/[^a-z0-9ąćęłńóśźż]+/gi, '-').replace(/^-|-$/g, '');
		await generate(target.toString(), join(outDir, `qr-${slug || 'gosc'}`), name);
	}
	console.log(`\nGotowe → ${names.length} winietek w ${outDir}/`);
}

// ---------------------------------------------------------------------------

async function generate(targetUrl, basePath, personName) {
	// 1) surowe moduły QR (ecc H)
	const qr = QRCode.create(targetUrl, { errorCorrectionLevel: 'H' });
	const count = qr.modules.size;
	const data = qr.modules.data;
	const quiet = opts.margin;
	const dim = count + quiet * 2; // in modules

	// 2) SVG
	const rects = [];
	for (let y = 0; y < count; y++) {
		for (let x = 0; x < count; x++) {
			if (data[y * count + x]) {
				rects.push(`<rect x="${x + quiet}" y="${y + quiet}" width="1.02" height="1.02"/>`);
			}
		}
	}

	// logo w centrum: białe zaokrąglone tło + obraz na ~24% szerokości
	let logoSvg = '';
	if (logoDataUri) {
		const logoFrac = opts.logoScale;
		const logoSize = dim * logoFrac;
		const pad = logoSize * 0.16;
		const box = logoSize + pad * 2;
		const cx = (dim - box) / 2;
		const r = box * 0.22;
		logoSvg = `
	<rect x="${cx}" y="${cx}" width="${box}" height="${box}" rx="${r}" ry="${r}" fill="${opts.bg}"/>
	<image x="${(dim - logoSize) / 2}" y="${(dim - logoSize) / 2}" width="${logoSize}" height="${logoSize}"
	       href="${logoDataUri}" preserveAspectRatio="xMidYMid meet"/>`;
	}

	const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${dim} ${dim}" shape-rendering="crispEdges" width="1000" height="1000">
	<rect width="${dim}" height="${dim}" fill="${opts.bg}"/>
	<g fill="${opts.fg}">
${rects.join('\n')}
	</g>${logoSvg}
</svg>`;

	writeFileSync(`${basePath}.svg`, svg, 'utf8');

	// 3) PNG w wysokiej rozdzielczości (z sharp) — opcjonalnie z podpisem
	const pngBuf = await sharp(Buffer.from(svg)).resize(opts.pngSize, opts.pngSize).png().toBuffer();

	if (opts.label || personName) {
		await composeWithLabel(pngBuf, `${basePath}.png`, personName ? `${personName}` : '', opts.label || '');
	} else {
		writeFileSync(`${basePath}.png`, pngBuf);
	}
}

/** Dokłada pod kodem QR biały pasek z podpisem (imię gościa i/lub etykieta). */
async function composeWithLabel(qrPng, outPath, name, label) {
	const W = opts.pngSize;
	const footer = Math.round(W * 0.16);
	const H = W + footer;
	const esc = (s) => String(s).replace(/[<>&]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;' })[c]);
	const nameSvg = name
		? `<text x="50%" y="${W + footer * 0.42}" text-anchor="middle" font-family="Georgia, serif" font-size="${footer * 0.34}" fill="${opts.fg}">${esc(name)}</text>`
		: '';
	const labelSvg = label
		? `<text x="50%" y="${W + footer * (name ? 0.78 : 0.58)}" text-anchor="middle" font-family="Georgia, serif" font-size="${footer * 0.22}" fill="#8a7d6e">${esc(label)}</text>`
		: '';
	const overlay = Buffer.from(
		`<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}"><rect width="${W}" height="${H}" fill="${opts.bg}"/>${nameSvg}${labelSvg}</svg>`
	);
	await sharp(overlay)
		.composite([{ input: qrPng, top: 0, left: 0 }])
		.png()
		.toFile(outPath);
}

function loadLogo(path) {
	if (!existsSync(path)) {
		console.error(`Nie znaleziono logo: ${path}`);
		process.exit(1);
	}
	const ext = extname(path).toLowerCase();
	const mime = ext === '.svg' ? 'image/svg+xml' : ext === '.jpg' || ext === '.jpeg' ? 'image/jpeg' : 'image/png';
	const b64 = readFileSync(path).toString('base64');
	return `data:${mime};base64,${b64}`;
}

function getNames(a) {
	if (a['names-file']) {
		return readFileSync(a['names-file'], 'utf8')
			.split(/\r?\n/)
			.map((s) => s.trim())
			.filter(Boolean);
	}
	if (a.names) {
		return a.names.split(',').map((s) => s.trim()).filter(Boolean);
	}
	return [];
}

function parseArgs(argv) {
	const out = {};
	for (let i = 0; i < argv.length; i++) {
		const a = argv[i];
		if (a.startsWith('--')) {
			const key = a.slice(2);
			const val = argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[++i] : 'true';
			out[key] = val;
		}
	}
	return out;
}
