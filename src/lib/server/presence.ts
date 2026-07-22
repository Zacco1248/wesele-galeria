/**
 * Lightweight "guests online" tracker. Clients send a heartbeat every ~20s;
 * we keep the last-seen timestamp per ephemeral client id in memory and count
 * those seen within the TTL window. No DB, no websockets — fine for a single
 * PM2 process, resets harmlessly on restart.
 */

const TTL_MS = 45_000;
const seen = new Map<string, number>();

export function heartbeat(clientId: string): void {
	seen.set(clientId, Date.now());
	prune();
}

export function onlineCount(): number {
	prune();
	return seen.size;
}

function prune(): void {
	const cutoff = Date.now() - TTL_MS;
	for (const [id, ts] of seen) {
		if (ts < cutoff) seen.delete(id);
	}
}

setInterval(prune, 30_000).unref?.();
