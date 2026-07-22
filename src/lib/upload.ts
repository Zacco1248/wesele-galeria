/**
 * Client-side direct-to-R2 uploader.
 *
 * Flow:  POST /api/uploads/presign  → PUT bytes straight to R2 (single or
 * multipart, with per-part retry) → POST /api/uploads/complete.
 *
 * The bytes never traverse the VPS/Cloudflare proxy, so the 100 MB proxy limit
 * doesn't apply and 300 MB+ wedding videos upload fine even on flaky hall wifi.
 */

export type UploadStatus = 'queued' | 'uploading' | 'processing' | 'done' | 'error';

export interface UploadItem {
	id: string; // local id
	file: File;
	name: string;
	sizeLabel: string;
	kind: 'image' | 'video';
	previewUrl: string | null;
	progress: number; // 0..1
	status: UploadStatus;
	error?: string;
}

const MAX_PART_RETRIES = 4;

const EXT_MIME: Record<string, string> = {
	jpg: 'image/jpeg',
	jpeg: 'image/jpeg',
	png: 'image/png',
	webp: 'image/webp',
	heic: 'image/heic',
	heif: 'image/heif',
	mp4: 'video/mp4',
	mov: 'video/quicktime',
	m4v: 'video/x-m4v',
	webm: 'video/webm'
};

/** Resolve a usable MIME type; some browsers report '' for HEIC/MOV. */
export function resolveMime(file: File): string {
	if (file.type && file.type !== 'application/octet-stream') return file.type;
	const ext = file.name.split('.').pop()?.toLowerCase() ?? '';
	return EXT_MIME[ext] ?? '';
}

export function kindForMime(mime: string): 'image' | 'video' | null {
	if (mime.startsWith('image/')) return 'image';
	if (mime.startsWith('video/')) return 'video';
	return null;
}

interface PresignSingle {
	mode: 'single';
	id: string;
	key: string;
	url: string;
	contentType: string;
}
interface PresignMultipart {
	mode: 'multipart';
	id: string;
	key: string;
	uploadId: string;
	partSize: number;
	parts: { partNumber: number; url: string }[];
}
type PresignResponse = PresignSingle | PresignMultipart;

export async function uploadFile(
	file: File,
	guestName: string | null,
	onProgress: (fraction: number) => void,
	signal?: AbortSignal
): Promise<void> {
	const mime = resolveMime(file);
	const kind = kindForMime(mime);
	if (!kind) throw new Error('Nieobsługiwany typ pliku');

	const presign = (await postJson(
		'/api/uploads/presign',
		{ filename: file.name, mime, size: file.size, guestName },
		signal
	)) as PresignResponse;

	if (presign.mode === 'single') {
		await putWithProgress(presign.url, file, presign.contentType, onProgress, signal);
		await postJson('/api/uploads/complete', { id: presign.id }, signal);
		return;
	}

	// multipart
	const { partSize, parts, id } = presign;
	const totals = new Array(parts.length).fill(0);
	const etags: { PartNumber: number; ETag: string }[] = [];

	for (let i = 0; i < parts.length; i++) {
		const part = parts[i];
		const start = (part.partNumber - 1) * partSize;
		const end = Math.min(start + partSize, file.size);
		const blob = file.slice(start, end);
		const etag = await putPartWithRetry(
			part.url,
			blob,
			(loaded) => {
				totals[i] = loaded;
				const sum = totals.reduce((a, b) => a + b, 0);
				onProgress(Math.min(0.99, sum / file.size));
			},
			signal
		);
		etags.push({ PartNumber: part.partNumber, ETag: etag });
	}

	onProgress(1);
	await postJson('/api/uploads/complete', { id, parts: etags }, signal);
}

async function putPartWithRetry(
	url: string,
	blob: Blob,
	onLoaded: (loaded: number) => void,
	signal?: AbortSignal
): Promise<string> {
	let lastErr: unknown;
	for (let attempt = 0; attempt < MAX_PART_RETRIES; attempt++) {
		try {
			return await putPart(url, blob, onLoaded, signal);
		} catch (e) {
			lastErr = e;
			if (signal?.aborted) throw e;
			// exponential backoff before retrying the part
			await sleep(500 * Math.pow(2, attempt));
		}
	}
	throw lastErr instanceof Error ? lastErr : new Error('Nie udało się wysłać części pliku');
}

function putPart(
	url: string,
	blob: Blob,
	onLoaded: (loaded: number) => void,
	signal?: AbortSignal
): Promise<string> {
	return new Promise((resolve, reject) => {
		const xhr = new XMLHttpRequest();
		xhr.open('PUT', url);
		xhr.upload.onprogress = (e) => onLoaded(e.loaded);
		xhr.onload = () => {
			if (xhr.status >= 200 && xhr.status < 300) {
				const etag = xhr.getResponseHeader('ETag');
				if (!etag) {
					reject(new Error('Brak nagłówka ETag (skonfiguruj CORS w R2)'));
				} else {
					resolve(etag.replace(/"/g, ''));
				}
			} else {
				reject(new Error(`R2 zwróciło ${xhr.status}`));
			}
		};
		xhr.onerror = () => reject(new Error('Błąd sieci przy wysyłaniu'));
		xhr.onabort = () => reject(new Error('Przerwano'));
		bindAbort(xhr, signal);
		xhr.send(blob);
	});
}

function putWithProgress(
	url: string,
	file: File,
	contentType: string,
	onProgress: (f: number) => void,
	signal?: AbortSignal
): Promise<void> {
	return new Promise((resolve, reject) => {
		const xhr = new XMLHttpRequest();
		xhr.open('PUT', url);
		xhr.setRequestHeader('Content-Type', contentType);
		xhr.upload.onprogress = (e) => {
			if (e.lengthComputable) onProgress(Math.min(0.99, e.loaded / e.total));
		};
		xhr.onload = () => {
			if (xhr.status >= 200 && xhr.status < 300) {
				onProgress(1);
				resolve();
			} else reject(new Error(`R2 zwróciło ${xhr.status}`));
		};
		xhr.onerror = () => reject(new Error('Błąd sieci przy wysyłaniu'));
		xhr.onabort = () => reject(new Error('Przerwano'));
		bindAbort(xhr, signal);
		xhr.send(file);
	});
}

function bindAbort(xhr: XMLHttpRequest, signal?: AbortSignal) {
	if (!signal) return;
	if (signal.aborted) xhr.abort();
	else signal.addEventListener('abort', () => xhr.abort(), { once: true });
}

async function postJson(url: string, body: unknown, signal?: AbortSignal): Promise<unknown> {
	const res = await fetch(url, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify(body),
		signal
	});
	if (!res.ok) {
		let msg = `Błąd ${res.status}`;
		try {
			const data = await res.json();
			if (data?.message) msg = data.message;
		} catch {
			/* ignore */
		}
		throw new Error(msg);
	}
	return res.json();
}

function sleep(ms: number): Promise<void> {
	return new Promise((r) => setTimeout(r, ms));
}
