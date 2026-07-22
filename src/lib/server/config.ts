import { env } from '$env/dynamic/private';

/**
 * Central, validated runtime configuration.
 * All secrets/limits come from environment variables so nothing sensitive
 * lives in the repo. See .env.example for the full list.
 */

function required(name: string): string {
	const v = env[name];
	if (!v || v.trim() === '') {
		throw new Error(`Missing required environment variable: ${name}`);
	}
	return v.trim();
}

function optional(name: string, fallback: string): string {
	const v = env[name];
	return v && v.trim() !== '' ? v.trim() : fallback;
}

function int(name: string, fallback: number): number {
	const v = env[name];
	if (!v || v.trim() === '') return fallback;
	const n = Number.parseInt(v, 10);
	return Number.isFinite(n) ? n : fallback;
}

const MB = 1024 * 1024;

export const config = {
	/** Public URL of the gallery, e.g. https://wesele.moneylet.pl (used in QR + meta). */
	publicUrl: optional('PUBLIC_BASE_URL', 'http://localhost:5173').replace(/\/$/, ''),

	/** Friendly copy shown to guests. */
	eventTitle: optional('EVENT_TITLE', 'Nasze Wesele'),
	eventSubtitle: optional('EVENT_SUBTITLE', 'Podziel się z nami swoimi wspomnieniami'),

	/** SQLite database file path. */
	dbPath: optional('DATABASE_PATH', './data/gallery.sqlite'),

	/** Local scratch dir for the thumbnail worker (download → process → upload). */
	tmpDir: optional('TMP_DIR', './data/tmp'),

	admin: {
		/** bcrypt hash of the admin password. Generate with `npm run hash-password`. */
		passwordHash: optional('ADMIN_PASSWORD_HASH', ''),
		/** Secret used to sign admin session cookies (HMAC). */
		sessionSecret: optional('ADMIN_SESSION_SECRET', ''),
		/** Session lifetime in hours. */
		sessionHours: int('ADMIN_SESSION_HOURS', 12)
	},

	/** Salt so that stored ip_hash cannot be reversed to raw IPs. */
	ipHashSalt: optional('IP_HASH_SALT', 'change-me-please'),

	r2: {
		accountId: optional('R2_ACCOUNT_ID', ''),
		accessKeyId: optional('R2_ACCESS_KEY_ID', ''),
		secretAccessKey: optional('R2_SECRET_ACCESS_KEY', ''),
		bucket: optional('R2_BUCKET', 'wesele-galeria'),
		/** Explicit endpoint override; otherwise derived from accountId. */
		endpoint: optional('R2_ENDPOINT', ''),
		/** Optional public base for serving thumbnails (R2 public bucket / custom domain). */
		publicBase: optional('R2_PUBLIC_BASE', '').replace(/\/$/, '')
	},

	limits: {
		imageBytes: int('MAX_IMAGE_MB', 50) * MB,
		videoBytes: int('MAX_VIDEO_MB', 500) * MB,
		/** Multipart part size the client uses (R2 min 5 MiB except last part). */
		partBytes: int('UPLOAD_PART_MB', 10) * MB
	},

	rateLimit: {
		/** Max presign requests per IP per window. */
		presignMax: int('RL_PRESIGN_MAX', 60),
		presignWindowSec: int('RL_PRESIGN_WINDOW_SEC', 600),
		/** Max failed admin logins per IP per window. */
		loginMax: int('RL_LOGIN_MAX', 10),
		loginWindowSec: int('RL_LOGIN_WINDOW_SEC', 600)
	}
};

export function r2Endpoint(): string {
	if (config.r2.endpoint) return config.r2.endpoint.replace(/\/$/, '');
	if (!config.r2.accountId) return '';
	return `https://${config.r2.accountId}.r2.cloudflarestorage.com`;
}

/** True when R2 credentials are present (used to fail fast with a clear message). */
export function r2Configured(): boolean {
	return Boolean(config.r2.accessKeyId && config.r2.secretAccessKey && (config.r2.accountId || config.r2.endpoint));
}

export const IMAGE_MIME = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif']);
export const VIDEO_MIME = new Set(['video/mp4', 'video/quicktime', 'video/x-m4v', 'video/webm']);

export function kindForMime(mime: string): 'image' | 'video' | null {
	if (IMAGE_MIME.has(mime)) return 'image';
	if (VIDEO_MIME.has(mime)) return 'video';
	return null;
}
