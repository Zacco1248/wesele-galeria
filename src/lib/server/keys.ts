import { randomBytes } from 'node:crypto';

/**
 * R2 object-key helpers. Keys are always generated server-side from a random
 * id + a whitelisted extension — the client never supplies the key, which
 * eliminates path-traversal / key-injection entirely.
 */

const EXT_BY_MIME: Record<string, string> = {
	'image/jpeg': 'jpg',
	'image/png': 'png',
	'image/webp': 'webp',
	'image/heic': 'heic',
	'image/heif': 'heif',
	'video/mp4': 'mp4',
	'video/quicktime': 'mov',
	'video/x-m4v': 'm4v',
	'video/webm': 'webm'
};

export function newId(): string {
	// URL-safe, collision-resistant, no slashes.
	return randomBytes(16).toString('hex');
}

export function extForMime(mime: string): string {
	return EXT_BY_MIME[mime] ?? 'bin';
}

/** Original media key, e.g. originals/2026/ab12…cd.jpg */
export function originalKey(id: string, mime: string): string {
	const yyyy = new Date().getFullYear();
	return `originals/${yyyy}/${id}.${extForMime(mime)}`;
}

export function thumbKey(id: string): string {
	return `thumbs/${id}.webp`;
}

export function posterKey(id: string): string {
	return `posters/${id}.webp`;
}

/**
 * Defensive validation for any key we accept back from a client (complete step).
 * Only keys we could have generated are allowed.
 */
const KEY_RE = /^(originals)\/\d{4}\/[a-f0-9]{32}\.[a-z0-9]{2,4}$/;
export function isValidOriginalKey(key: string): boolean {
	return KEY_RE.test(key) && !key.includes('..');
}
