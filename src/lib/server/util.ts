import { createHash } from 'node:crypto';
import { config } from './config';

/** Salted, non-reversible hash of an IP for abuse detection (never store raw IP). */
export function hashIp(ip: string): string {
	return createHash('sha256').update(config.ipHashSalt + '|' + ip).digest('hex').slice(0, 24);
}

/** Best-effort client IP from proxy headers (Nginx/Cloudflare) with a fallback. */
export function clientIpFrom(headers: Headers, fallback: string): string {
	const cf = headers.get('cf-connecting-ip');
	if (cf) return cf.trim();
	const xff = headers.get('x-forwarded-for');
	if (xff) return xff.split(',')[0].trim();
	const real = headers.get('x-real-ip');
	if (real) return real.trim();
	return fallback || '0.0.0.0';
}

/** Trim + clamp an optional guest name; returns null when empty. */
export function cleanGuestName(name: unknown): string | null {
	if (typeof name !== 'string') return null;
	const t = name.trim().replace(/\s+/g, ' ').slice(0, 40);
	return t.length ? t : null;
}

/** Keep a printable, bounded version of the client's filename (display + ZIP only). */
export function cleanFilename(name: unknown): string {
	if (typeof name !== 'string') return 'plik';
	const base = name.split(/[\\/]/).pop() ?? name;
	const t = base.replace(/[<>:"|?*]+/g, '_').replace(/\s+/g, ' ').trim().slice(0, 120);
	return t.length ? t : 'plik';
}

export function humanSize(bytes: number): string {
	if (!Number.isFinite(bytes) || bytes <= 0) return '0 B';
	const units = ['B', 'KB', 'MB', 'GB', 'TB'];
	const i = Math.min(units.length - 1, Math.floor(Math.log(bytes) / Math.log(1024)));
	return `${(bytes / Math.pow(1024, i)).toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
}
