import { error, redirect } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { db, type UploadRow } from '$lib/server/db';
import { presignGet } from '$lib/server/r2';
import { config } from '$lib/server/config';

/**
 * Media redirector. Issues a short-lived presigned R2 GET URL and 302-redirects
 * the browser to it, so image/video bytes flow directly between the guest and
 * R2 — never through this VPS. Credentials stay server-side.
 *
 *   /m/<id>/thumb   → gallery thumbnail (webp)
 *   /m/<id>/poster  → video poster (webp)
 *   /m/<id>/full    → original file (view / play)
 *   /m/<id>/download→ original with attachment disposition
 */
const VARIANTS = new Set(['thumb', 'poster', 'full', 'download']);

export const GET: RequestHandler = async ({ params, locals }) => {
	const { id, variant } = params;
	if (!/^[a-f0-9]{32}$/.test(id)) throw error(400, 'Bad id');
	if (!VARIANTS.has(variant)) throw error(404, 'Not found');

	const row = db().prepare(`SELECT * FROM uploads WHERE id = ?`).get(id) as UploadRow | undefined;
	if (!row) throw error(404, 'Not found');

	// Hidden items are only reachable by an authenticated admin.
	if (row.hidden && !locals.isAdmin) throw error(404, 'Not found');

	let key: string | null;
	let downloadName: string | undefined;
	switch (variant) {
		case 'thumb':
			key = row.thumb_key ?? (row.kind === 'video' ? row.poster_key : row.r2_key);
			break;
		case 'poster':
			key = row.poster_key ?? row.thumb_key;
			break;
		case 'download':
			key = row.r2_key;
			downloadName = row.original_filename;
			break;
		case 'full':
		default:
			key = row.r2_key;
			break;
	}

	if (!key) throw error(404, 'Brak podglądu');

	// Prefer a public base for cacheable thumbs/posters when configured.
	if ((variant === 'thumb' || variant === 'poster') && config.r2.publicBase) {
		throw redirect(302, `${config.r2.publicBase}/${key}`);
	}

	const url = await presignGet(key, 3600, downloadName);
	throw redirect(302, url);
};
