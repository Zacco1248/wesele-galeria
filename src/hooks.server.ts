import type { Handle } from '@sveltejs/kit';
import { redirect } from '@sveltejs/kit';
import { config, r2Endpoint } from '$lib/server/config';
import { hasValidSession } from '$lib/server/auth';
import { clientIpFrom, hashIp } from '$lib/server/util';
import { startWorker } from '$lib/server/worker';

// Kick off the in-process thumbnail worker once, at server startup.
startWorker();

/** R2 hosts that the browser legitimately talks to (uploads + media). */
function r2Hosts(): string {
	const hosts = new Set<string>();
	const endpoint = r2Endpoint();
	if (endpoint) {
		try {
			hosts.add(new URL(endpoint).origin);
		} catch {
			/* ignore */
		}
	}
	if (config.r2.publicBase) {
		try {
			hosts.add(new URL(config.r2.publicBase).origin);
		} catch {
			/* ignore */
		}
	}
	return [...hosts].join(' ');
}

function cspHeader(): string {
	const r2 = r2Hosts();
	return [
		`default-src 'self'`,
		`script-src 'self'`,
		`style-src 'self' 'unsafe-inline'`,
		`img-src 'self' data: blob: ${r2}`.trim(),
		`media-src 'self' blob: ${r2}`.trim(),
		`connect-src 'self' ${r2}`.trim(),
		`font-src 'self' data:`,
		`base-uri 'self'`,
		`form-action 'self'`,
		`frame-ancestors 'none'`,
		`object-src 'none'`
	].join('; ');
}

export const handle: Handle = async ({ event, resolve }) => {
	const ip = clientIpFrom(event.request.headers, event.getClientAddress());
	event.locals.clientIp = ip;
	event.locals.ipHash = hashIp(ip);
	event.locals.isAdmin = hasValidSession(event.cookies);

	// Guard the admin area (except the login page + login action).
	const path = event.url.pathname;
	const isAdminArea = path === '/admin' || path.startsWith('/admin/');
	const isLogin = path === '/admin/login';
	if (isAdminArea && !isLogin && !event.locals.isAdmin) {
		throw redirect(303, '/admin/login');
	}

	const response = await resolve(event);

	response.headers.set('Content-Security-Policy', cspHeader());
	response.headers.set('X-Content-Type-Options', 'nosniff');
	response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
	response.headers.set('X-Frame-Options', 'DENY');
	response.headers.set(
		'Permissions-Policy',
		'camera=(), microphone=(), geolocation=(), interest-cohort=()'
	);
	return response;
};
