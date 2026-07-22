import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { toggleHeart } from '$lib/server/gallery';
import { rateLimit } from '$lib/server/ratelimit';

/** Toggle a heart on an item. One per (item, ip). */
export const POST: RequestHandler = async ({ request, locals }) => {
	const rl = rateLimit(`react:${locals.ipHash}`, 120, 60);
	if (!rl.ok) throw error(429, 'Zbyt wiele reakcji.');
	let body: { id?: string };
	try {
		body = await request.json();
	} catch {
		throw error(400, 'Bad request');
	}
	if (typeof body.id !== 'string' || !/^[a-f0-9]{32}$/.test(body.id)) throw error(400, 'Bad id');
	const res = toggleHeart(body.id, locals.ipHash);
	return json(res);
};
