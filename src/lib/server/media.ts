import sharp from 'sharp';
import { spawn } from 'node:child_process';
import { env } from '$env/dynamic/private';

/**
 * Thumbnail / poster generation.
 *  - Images  → sharp (auto-rotate via EXIF, resize, WebP). HEIC/HEIF decode
 *              depends on the platform libvips build; failures degrade gracefully.
 *  - Videos  → ffmpeg grabs a frame, ffprobe reads dimensions/duration.
 */

const FFMPEG = env.FFMPEG_PATH?.trim() || 'ffmpeg';
const FFPROBE = env.FFPROBE_PATH?.trim() || 'ffprobe';

const THUMB_MAX = 1080; // longest edge of gallery thumbnail
const WEBP_QUALITY = 72;

export interface ImageResult {
	thumb: Buffer;
	width: number | null;
	height: number | null;
}

export async function makeImageThumb(input: Buffer): Promise<ImageResult> {
	const pipeline = sharp(input, { failOn: 'none' }).rotate(); // rotate() applies EXIF orientation
	const meta = await pipeline.metadata();
	const thumb = await pipeline
		.resize({ width: THUMB_MAX, height: THUMB_MAX, fit: 'inside', withoutEnlargement: true })
		.webp({ quality: WEBP_QUALITY })
		.toBuffer();
	// account for EXIF orientation swap
	const swap = meta.orientation && meta.orientation >= 5;
	const width = swap ? meta.height : meta.width;
	const height = swap ? meta.width : meta.height;
	return { thumb, width: width ?? null, height: height ?? null };
}

export interface VideoProbe {
	width: number | null;
	height: number | null;
	duration: number | null;
}

export async function probeVideo(path: string): Promise<VideoProbe> {
	try {
		const out = await run(FFPROBE, [
			'-v', 'error',
			'-select_streams', 'v:0',
			'-show_entries', 'stream=width,height:format=duration',
			'-of', 'json',
			path
		]);
		const data = JSON.parse(out.toString('utf8'));
		const stream = data.streams?.[0] ?? {};
		const duration = data.format?.duration ? Number.parseFloat(data.format.duration) : null;
		return {
			width: stream.width ?? null,
			height: stream.height ?? null,
			duration: Number.isFinite(duration) ? duration : null
		};
	} catch {
		return { width: null, height: null, duration: null };
	}
}

/** Extract a representative frame and turn it into a WebP poster. */
export async function makeVideoPoster(path: string, seekSec = 1): Promise<Buffer | null> {
	try {
		const png = await run(FFMPEG, [
			'-ss', String(seekSec),
			'-i', path,
			'-frames:v', '1',
			'-vf', `scale='min(${THUMB_MAX},iw)':-2`,
			'-f', 'image2pipe',
			'-vcodec', 'png',
			'pipe:1'
		]);
		if (!png.length) return null;
		return await sharp(png).webp({ quality: WEBP_QUALITY }).toBuffer();
	} catch {
		return null;
	}
}

/** Spawn a binary, collect stdout, reject on non-zero exit. */
function run(bin: string, args: string[], timeoutMs = 120_000): Promise<Buffer> {
	return new Promise((resolve, reject) => {
		const child = spawn(bin, args, { stdio: ['ignore', 'pipe', 'pipe'] });
		const out: Buffer[] = [];
		const err: Buffer[] = [];
		const timer = setTimeout(() => {
			child.kill('SIGKILL');
			reject(new Error(`${bin} timed out`));
		}, timeoutMs);
		child.stdout.on('data', (d) => out.push(d));
		child.stderr.on('data', (d) => err.push(d));
		child.on('error', (e) => {
			clearTimeout(timer);
			reject(e);
		});
		child.on('close', (code) => {
			clearTimeout(timer);
			if (code === 0) resolve(Buffer.concat(out));
			else reject(new Error(`${bin} exited ${code}: ${Buffer.concat(err).toString('utf8').slice(0, 500)}`));
		});
	});
}
