import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { r2Configured } from '$lib/server/config';
import { adminConfigured } from '$lib/server/auth';

/** Lightweight health probe for deploy scripts / uptime checks. */
export const GET: RequestHandler = async () => {
	return json({
		ok: true,
		r2: r2Configured(),
		admin: adminConfigured(),
		ts: Date.now()
	});
};
