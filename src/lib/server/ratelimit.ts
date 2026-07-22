/**
 * Tiny in-memory sliding-window rate limiter. Sufficient for a single-process
 * PM2 deployment; resets on restart (acceptable for a wedding-day gallery).
 */

interface Bucket {
	hits: number[];
}

const buckets = new Map<string, Bucket>();

export function rateLimit(key: string, max: number, windowSec: number): { ok: boolean; retryAfter: number } {
	const now = Date.now();
	const windowMs = windowSec * 1000;
	let b = buckets.get(key);
	if (!b) {
		b = { hits: [] };
		buckets.set(key, b);
	}
	b.hits = b.hits.filter((t) => now - t < windowMs);
	if (b.hits.length >= max) {
		const oldest = b.hits[0];
		return { ok: false, retryAfter: Math.ceil((windowMs - (now - oldest)) / 1000) };
	}
	b.hits.push(now);
	return { ok: true, retryAfter: 0 };
}

// periodic cleanup so the map doesn't grow unbounded
setInterval(() => {
	const now = Date.now();
	for (const [k, b] of buckets) {
		b.hits = b.hits.filter((t) => now - t < 3600_000);
		if (b.hits.length === 0) buckets.delete(k);
	}
}, 600_000).unref?.();
