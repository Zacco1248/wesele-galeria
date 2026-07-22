import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { heartbeat, onlineCount } from '$lib/server/presence';
import { rateLimit } from '$lib/server/ratelimit';

/**
 * POST { id } → register a heartbeat and return the current online count.
 * The id is an ephemeral per-device token generated client-side.
 */
export const POST: RequestHandler = async ({ request, locals }) => {
	const rl = rateLimit(`presence:${locals.ipHash}`, 30, 60);
	if (!rl.ok) throw error(429, 'Slow down');
	let body: { id?: string };
	try {
		body = await request.json();
	} catch {
		throw error(400, 'Bad request');
	}
	if (typeof body.id !== 'string' || body.id.length < 6 || body.id.length > 64) {
		throw error(400, 'Bad id');
	}
	heartbeat(body.id);
	return json({ online: onlineCount() });
};

export const GET: RequestHandler = async () => {
	return json({ online: onlineCount() });
};
