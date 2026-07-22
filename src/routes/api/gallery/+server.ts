import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { listVisible, countVisible } from '$lib/server/gallery';

/** Public gallery feed. Keyset pagination via ?before=<createdAtMs>. */
export const GET: RequestHandler = async ({ url }) => {
	const before = Number.parseInt(url.searchParams.get('before') ?? '', 10);
	const limit = Math.min(60, Math.max(1, Number.parseInt(url.searchParams.get('limit') ?? '40', 10)));
	const items = listVisible(limit, Number.isFinite(before) ? before : undefined);
	return json({
		items,
		total: countVisible(),
		nextBefore: items.length === limit ? items[items.length - 1].createdAt : null
	});
};
