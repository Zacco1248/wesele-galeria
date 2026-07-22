import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { config, kindForMime } from '$lib/server/config';
import { db } from '$lib/server/db';
import { newId, originalKey } from '$lib/server/keys';
import { createMultipart, presignPart, presignPut } from '$lib/server/r2';
import { rateLimit } from '$lib/server/ratelimit';
import { cleanGuestName, cleanFilename } from '$lib/server/util';

/**
 * Step 1 of the direct-to-R2 upload flow.
 * The client sends only metadata (small request, well under Cloudflare's 100 MB
 * proxy limit). We validate MIME/size, then hand back presigned URLs so the
 * browser can PUT the bytes straight to R2 — never through this VPS.
 */
export const POST: RequestHandler = async ({ request, locals }) => {
	const rl = rateLimit(`presign:${locals.ipHash}`, config.rateLimit.presignMax, config.rateLimit.presignWindowSec);
	if (!rl.ok) throw error(429, `Zbyt wiele żądań. Spróbuj ponownie za ${rl.retryAfter}s.`);

	let body: unknown;
	try {
		body = await request.json();
	} catch {
		throw error(400, 'Nieprawidłowe dane.');
	}

	const { filename, mime, size, guestName } = (body ?? {}) as Record<string, unknown>;

	if (typeof filename !== 'string' || typeof mime !== 'string' || typeof size !== 'number') {
		throw error(400, 'Brak wymaganych pól (filename, mime, size).');
	}

	const kind = kindForMime(mime);
	if (!kind) throw error(415, `Nieobsługiwany format: ${mime}`);

	const maxBytes = kind === 'video' ? config.limits.videoBytes : config.limits.imageBytes;
	if (!Number.isFinite(size) || size <= 0) throw error(400, 'Nieprawidłowy rozmiar pliku.');
	if (size > maxBytes) {
		const mb = Math.round(maxBytes / (1024 * 1024));
		throw error(413, `Plik za duży. Limit dla ${kind === 'video' ? 'wideo' : 'zdjęć'}: ${mb} MB.`);
	}

	const id = newId();
	const key = originalKey(id, mime);
	const name = cleanGuestName(guestName);
	const safeFilename = cleanFilename(filename);
	const now = Date.now();

	const partSize = config.limits.partBytes;
	const useMultipart = size > partSize;

	if (!useMultipart) {
		// Small file → single presigned PUT.
		const url = await presignPut(key, mime, 3600);
		db()
			.prepare(
				`INSERT INTO pending_uploads (id, r2_key, upload_id, original_filename, mime, declared_size, kind, guest_name, ip_hash, created_at)
				 VALUES (?, ?, NULL, ?, ?, ?, ?, ?, ?, ?)`
			)
			.run(id, key, safeFilename, mime, size, kind, name, locals.ipHash, now);
		return json({ mode: 'single', id, key, contentType: mime, url });
	}

	// Large file → multipart. Presign every part up front.
	const uploadId = await createMultipart(key, mime);
	const partCount = Math.ceil(size / partSize);
	const parts: { partNumber: number; url: string }[] = [];
	for (let p = 1; p <= partCount; p++) {
		parts.push({ partNumber: p, url: await presignPart(key, uploadId, p, 3600) });
	}

	db()
		.prepare(
			`INSERT INTO pending_uploads (id, r2_key, upload_id, original_filename, mime, declared_size, kind, guest_name, ip_hash, created_at)
			 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
		)
		.run(id, key, uploadId, safeFilename, mime, size, kind, name, locals.ipHash, now);

	return json({ mode: 'multipart', id, key, uploadId, partSize, parts });
};
