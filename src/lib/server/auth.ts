import { createHmac, timingSafeEqual } from 'node:crypto';
import bcrypt from 'bcryptjs';
import type { Cookies } from '@sveltejs/kit';
import { config } from './config';

/**
 * Stateless admin sessions: a signed cookie `admin=<expiryMs>.<hmac>`.
 * No DB table needed — the HMAC over (expiry) with ADMIN_SESSION_SECRET is the
 * proof. Rotating the secret invalidates all sessions.
 */

const COOKIE = 'admin_session';

export function adminConfigured(): boolean {
	return Boolean(config.admin.passwordHash && config.admin.sessionSecret);
}

export async function verifyPassword(plain: string): Promise<boolean> {
	if (!config.admin.passwordHash) return false;
	try {
		return await bcrypt.compare(plain, config.admin.passwordHash);
	} catch {
		return false;
	}
}

function sign(payload: string): string {
	return createHmac('sha256', config.admin.sessionSecret).update(payload).digest('hex');
}

export function issueSession(cookies: Cookies): void {
	const expiry = Date.now() + config.admin.sessionHours * 3600_000;
	const payload = String(expiry);
	const token = `${payload}.${sign(payload)}`;
	cookies.set(COOKIE, token, {
		path: '/',
		httpOnly: true,
		sameSite: 'lax',
		secure: config.publicUrl.startsWith('https'),
		maxAge: config.admin.sessionHours * 3600
	});
}

export function clearSession(cookies: Cookies): void {
	cookies.delete(COOKIE, { path: '/' });
}

export function hasValidSession(cookies: Cookies): boolean {
	if (!adminConfigured()) return false;
	const raw = cookies.get(COOKIE);
	if (!raw) return false;
	const dot = raw.lastIndexOf('.');
	if (dot < 0) return false;
	const payload = raw.slice(0, dot);
	const mac = raw.slice(dot + 1);
	const expected = sign(payload);
	if (mac.length !== expected.length) return false;
	if (!timingSafeEqual(Buffer.from(mac), Buffer.from(expected))) return false;
	const expiry = Number.parseInt(payload, 10);
	return Number.isFinite(expiry) && expiry > Date.now();
}
