import { db, type UploadRow } from './db';

export interface GalleryItem {
	id: string;
	kind: 'image' | 'video';
	guestName: string | null;
	createdAt: number;
	width: number | null;
	height: number | null;
	duration: number | null;
	processed: boolean;
	hasThumb: boolean;
	hearts: number;
}

export interface AdminItem extends GalleryItem {
	filename: string;
	mime: string;
	size: number;
	hidden: boolean;
	ipHash: string | null;
}

function toGalleryItem(r: UploadRow, hearts: number): GalleryItem {
	return {
		id: r.id,
		kind: r.kind,
		guestName: r.guest_name,
		createdAt: r.created_at,
		width: r.width,
		height: r.height,
		duration: r.duration,
		processed: r.processed === 1,
		hasThumb: Boolean(r.thumb_key || r.poster_key),
		hearts
	};
}

function heartCounts(ids: string[]): Map<string, number> {
	const map = new Map<string, number>();
	if (ids.length === 0) return map;
	const placeholders = ids.map(() => '?').join(',');
	const rows = db()
		.prepare(`SELECT upload_id, COUNT(*) AS n FROM reactions WHERE upload_id IN (${placeholders}) GROUP BY upload_id`)
		.all(...ids) as { upload_id: string; n: number }[];
	for (const row of rows) map.set(row.upload_id, row.n);
	return map;
}

/** Visible gallery items, newest first, keyset-paginated by created_at. */
export function listVisible(limit = 40, beforeTs?: number): GalleryItem[] {
	const rows = (
		beforeTs
			? db()
					.prepare(
						`SELECT * FROM uploads WHERE hidden = 0 AND created_at < ? ORDER BY created_at DESC LIMIT ?`
					)
					.all(beforeTs, limit)
			: db().prepare(`SELECT * FROM uploads WHERE hidden = 0 ORDER BY created_at DESC LIMIT ?`).all(limit)
	) as UploadRow[];
	const hearts = heartCounts(rows.map((r) => r.id));
	return rows.map((r) => toGalleryItem(r, hearts.get(r.id) ?? 0));
}

export function countVisible(): number {
	const row = db().prepare(`SELECT COUNT(*) AS n FROM uploads WHERE hidden = 0`).get() as { n: number };
	return row.n;
}

/** Toggle a heart for (upload, ip). Returns the new count and whether it's now liked. */
export function toggleHeart(uploadId: string, ipHash: string): { hearts: number; liked: boolean } {
	const exists = db()
		.prepare(`SELECT 1 FROM reactions WHERE upload_id = ? AND ip_hash = ?`)
		.get(uploadId, ipHash);
	if (exists) {
		db().prepare(`DELETE FROM reactions WHERE upload_id = ? AND ip_hash = ?`).run(uploadId, ipHash);
	} else {
		// ignore if upload doesn't exist / is hidden
		const ok = db().prepare(`SELECT 1 FROM uploads WHERE id = ? AND hidden = 0`).get(uploadId);
		if (!ok) return { hearts: heartCount(uploadId), liked: false };
		db()
			.prepare(`INSERT OR IGNORE INTO reactions (upload_id, ip_hash, created_at) VALUES (?, ?, ?)`)
			.run(uploadId, ipHash, Date.now());
	}
	return { hearts: heartCount(uploadId), liked: !exists };
}

function heartCount(uploadId: string): number {
	const row = db().prepare(`SELECT COUNT(*) AS n FROM reactions WHERE upload_id = ?`).get(uploadId) as {
		n: number;
	};
	return row.n;
}

// ---- admin ----

export interface AdminStats {
	total: number;
	visible: number;
	hidden: number;
	images: number;
	videos: number;
	totalBytes: number;
	pending: number;
}

export function adminStats(): AdminStats {
	const q = (sql: string) => (db().prepare(sql).get() as { n: number }).n;
	return {
		total: q(`SELECT COUNT(*) AS n FROM uploads`),
		visible: q(`SELECT COUNT(*) AS n FROM uploads WHERE hidden = 0`),
		hidden: q(`SELECT COUNT(*) AS n FROM uploads WHERE hidden = 1`),
		images: q(`SELECT COUNT(*) AS n FROM uploads WHERE kind = 'image'`),
		videos: q(`SELECT COUNT(*) AS n FROM uploads WHERE kind = 'video'`),
		totalBytes: (db().prepare(`SELECT COALESCE(SUM(size),0) AS n FROM uploads`).get() as { n: number }).n,
		pending: q(`SELECT COUNT(*) AS n FROM uploads WHERE processed = 0`)
	};
}

export function listAll(limit = 500, offset = 0): AdminItem[] {
	const rows = db()
		.prepare(`SELECT * FROM uploads ORDER BY created_at DESC LIMIT ? OFFSET ?`)
		.all(limit, offset) as UploadRow[];
	const hearts = heartCounts(rows.map((r) => r.id));
	return rows.map((r) => ({
		...toGalleryItem(r, hearts.get(r.id) ?? 0),
		filename: r.original_filename,
		mime: r.mime,
		size: r.size,
		hidden: r.hidden === 1,
		ipHash: r.ip_hash
	}));
}
