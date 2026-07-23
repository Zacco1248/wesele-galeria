import { error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { Readable } from 'node:stream';
import { db, type UploadRow } from '$lib/server/db';
import { presignGet, getObjectStream } from '$lib/server/r2';
import { config } from '$lib/server/config';

/**
 * Media serving.
 *
 *  - thumb / poster: small, immutable derived images. Served with a long
 *    `immutable` cache so browsers (and Cloudflare's edge, if a cache rule is
 *    set) keep them — repeat gallery loads are instant and the VPS fetches each
 *    thumbnail from R2 at most once. If R2_PUBLIC_BASE is set we redirect to the
 *    stable public URL instead (fully offloads bytes from the VPS).
 *  - full / download: large originals → short-lived presigned redirect straight
 *    to R2 (bytes never pass through the VPS).
 */
const VARIANTS = new Set(['thumb', 'poster', 'full', 'download']);
const IMMUTABLE = 'public, max-age=31536000, immutable';

function redirectWithCache(url: string, cacheControl: string): Response {
	return new Response(null, { status: 302, headers: { Location: url, 'Cache-Control': cacheControl } });
}

export const GET: RequestHandler = async ({ params, locals }) => {
	const { id, variant } = params;
	if (!/^[a-f0-9]{32}$/.test(id)) throw error(400, 'Bad id');
	if (!VARIANTS.has(variant)) throw error(404, 'Not found');

	const row = db().prepare(`SELECT * FROM uploads WHERE id = ?`).get(id) as UploadRow | undefined;
	if (!row) throw error(404, 'Not found');

	// Hidden items are only reachable by an authenticated admin.
	if (row.hidden && !locals.isAdmin) throw error(404, 'Not found');

	// --- derived, immutable images (thumbnail / video poster) ---
	if (variant === 'thumb' || variant === 'poster') {
		const key =
			variant === 'thumb'
				? (row.thumb_key ?? row.poster_key)
				: (row.poster_key ?? row.thumb_key);
		if (!key) throw error(404, 'Brak podglądu'); // still processing → client shows a placeholder

		if (config.r2.publicBase) {
			return redirectWithCache(`${config.r2.publicBase}/${key}`, IMMUTABLE);
		}

		// Proxy the (tiny) bytes with an immutable cache so it's fetched once.
		const stream = await getObjectStream(key);
		return new Response(Readable.toWeb(stream) as unknown as ReadableStream, {
			headers: {
				'Content-Type': 'image/webp',
				'Cache-Control': IMMUTABLE
			}
		});
	}

	// --- large originals (view / play / download) → presigned redirect ---
	const downloadName = variant === 'download' ? row.original_filename : undefined;
	const url = await presignGet(row.r2_key, 3600, downloadName);
	return redirectWithCache(url, 'private, max-age=600');
};
