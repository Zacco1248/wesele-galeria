import type { Readable } from 'node:stream';
import { db, type UploadRow } from './db';
import { getObjectStream, putObject, presignGet } from './r2';
import { thumbKey, posterKey } from './keys';
import { makeImageThumb, makeVideoPoster, probeVideo } from './media';
import { r2Configured } from './config';

/**
 * In-process thumbnail/poster worker. Runs inside the same Node process (one
 * PM2 instance), polling `uploads` for unprocessed rows. Kept deliberately
 * simple: sequential, self-healing, wakes on new uploads via notifyWorker().
 *
 * For videos we hand ffmpeg a short-lived presigned R2 URL so it range-reads
 * only the bytes it needs — the multi-hundred-MB original never lands on disk.
 */

let running = false;
let started = false;
let pokePending = false;

export function startWorker(): void {
	if (started) return;
	started = true;
	// periodic sweep as a safety net (in case a poke was missed / process restarted)
	setInterval(() => void drain(), 30_000).unref?.();
	void drain();
}

export function notifyWorker(): void {
	pokePending = true;
	void drain();
}

async function drain(): Promise<void> {
	if (running) return;
	if (!r2Configured()) return;
	running = true;
	pokePending = false;
	try {
		let row = nextPending();
		while (row) {
			await processOne(row).catch((e) => {
				console.error(`[worker] failed ${row!.id}:`, e instanceof Error ? e.message : e);
				markProcessed(row!.id); // avoid infinite retry loop
			});
			row = nextPending();
		}
		// if something was queued while we were finishing, go again
		if (pokePending) {
			running = false;
			return void drain();
		}
	} finally {
		running = false;
	}
}

function nextPending(): UploadRow | undefined {
	return db()
		.prepare(`SELECT * FROM uploads WHERE processed = 0 ORDER BY created_at ASC LIMIT 1`)
		.get() as UploadRow | undefined;
}

function markProcessed(id: string): void {
	db().prepare(`UPDATE uploads SET processed = 1 WHERE id = ?`).run(id);
}

async function processOne(row: UploadRow): Promise<void> {
	if (row.kind === 'image') {
		const buf = await streamToBuffer(await getObjectStream(row.r2_key));
		const { thumb, width, height } = await makeImageThumb(buf);
		const tkey = thumbKey(row.id);
		await putObject(tkey, thumb, 'image/webp');
		db()
			.prepare(`UPDATE uploads SET thumb_key = ?, width = ?, height = ?, processed = 1 WHERE id = ?`)
			.run(tkey, width, height, row.id);
	} else {
		// video: feed ffmpeg a presigned URL (range reads, nothing hits local disk)
		const url = await presignGet(row.r2_key, 3600);
		const probe = await probeVideo(url);
		const poster = await makeVideoPoster(url, 1);
		let pkey: string | null = null;
		if (poster) {
			pkey = posterKey(row.id);
			await putObject(pkey, poster, 'image/webp');
		}
		db()
			.prepare(
				`UPDATE uploads SET poster_key = ?, width = ?, height = ?, duration = ?, processed = 1 WHERE id = ?`
			)
			.run(pkey, probe.width, probe.height, probe.duration, row.id);
	}
}

function streamToBuffer(stream: Readable): Promise<Buffer> {
	return new Promise((resolve, reject) => {
		const chunks: Buffer[] = [];
		stream.on('data', (c) => chunks.push(Buffer.isBuffer(c) ? c : Buffer.from(c)));
		stream.on('end', () => resolve(Buffer.concat(chunks)));
		stream.on('error', reject);
	});
}
