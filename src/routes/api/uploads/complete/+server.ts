import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { db, type PendingRow } from '$lib/server/db';
import { completeMultipart, headObject, deleteObject } from '$lib/server/r2';
import { config } from '$lib/server/config';
import { isValidOriginalKey } from '$lib/server/keys';
import { notifyWorker } from '$lib/server/worker';

/**
 * Step 3: the browser finished pushing bytes to R2 and calls us back.
 * We finalize the multipart upload, verify the object really exists with a
 * plausible size, persist metadata, and enqueue thumbnail generation.
 */
export const POST: RequestHandler = async ({ request, locals }) => {
	let body: unknown;
	try {
		body = await request.json();
	} catch {
		throw error(400, 'Nieprawidłowe dane.');
	}

	const { id, parts } = (body ?? {}) as { id?: string; parts?: { PartNumber: number; ETag: string }[] };
	if (typeof id !== 'string' || !/^[a-f0-9]{32}$/.test(id)) throw error(400, 'Nieprawidłowe id.');

	const pending = db().prepare(`SELECT * FROM pending_uploads WHERE id = ?`).get(id) as PendingRow | undefined;
	if (!pending) throw error(404, 'Nie znaleziono rozpoczętego uploadu.');
	if (!isValidOriginalKey(pending.r2_key)) throw error(400, 'Nieprawidłowy klucz.');

	// Finalize multipart if needed.
	if (pending.upload_id) {
		if (!Array.isArray(parts) || parts.length === 0) throw error(400, 'Brak listy części (parts).');
		const clean = parts
			.filter((p) => p && typeof p.ETag === 'string' && Number.isInteger(p.PartNumber))
			.map((p) => ({ ETag: p.ETag, PartNumber: p.PartNumber }));
		if (clean.length === 0) throw error(400, 'Nieprawidłowe części.');
		await completeMultipart(pending.r2_key, pending.upload_id, clean);
	}

	// Verify the object landed and read its real size/type from R2 (don't trust the client).
	const head = await headObject(pending.r2_key);
	if (!head) throw error(422, 'Plik nie dotarł do magazynu.');

	const maxBytes = pending.kind === 'video' ? config.limits.videoBytes : config.limits.imageBytes;
	if (head.size <= 0 || head.size > maxBytes * 1.02) {
		// Real size disagrees with limits — reject and clean up.
		await deleteObject(pending.r2_key).catch(() => {});
		db().prepare(`DELETE FROM pending_uploads WHERE id = ?`).run(id);
		throw error(413, 'Rozmiar pliku poza dozwolonym zakresem.');
	}

	const now = Date.now();
	const tx = db().transaction(() => {
		db()
			.prepare(
				`INSERT INTO uploads
				 (id, r2_key, original_filename, mime, size, kind, guest_name, ip_hash, processed, hidden, created_at)
				 VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, 0, ?)`
			)
			.run(
				id,
				pending.r2_key,
				pending.original_filename || `${pending.kind}-${id.slice(0, 8)}`,
				pending.mime,
				head.size,
				pending.kind,
				pending.guest_name,
				pending.ip_hash,
				now
			);
		db().prepare(`DELETE FROM pending_uploads WHERE id = ?`).run(id);
	});
	tx();

	// Wake the thumbnail worker (fire-and-forget).
	notifyWorker();

	return json({ ok: true, id });
};
