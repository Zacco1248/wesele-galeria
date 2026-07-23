import type { Handle } from '@sveltejs/kit';
import { redirect } from '@sveltejs/kit';
import { config, r2Endpoint } from '$lib/server/config';
import { hasValidSession } from '$lib/server/auth';
import { clientIpFrom, hashIp } from '$lib/server/util';
import { startWorker } from '$lib/server/worker';

// Kick off the in-process thumbnail worker once, at server startup.
startWorker();

/**
 * R2 hosts the browser legitimately talks to (direct uploads + media redirects).
 * The AWS SDK uses virtual-hosted-style URLs — `<bucket>.<account>.r2.cloudflarestorage.com`
 * — so we must allow the bucket subdomain, not just the account endpoint. A wildcard
 * over the R2 domain covers both path-style and virtual-hosted-style.
 */
function r2Hosts(): string {
	const hosts = new Set<string>();
	const endpoint = r2Endpoint();
	if (endpoint) {
		try {
			const url = new URL(endpoint);
			hosts.add(url.origin);
			if (url.host.endsWith('.r2.cloudflarestorage.com')) {
				hosts.add('https://*.r2.cloudflarestorage.com');
			} else if (config.r2.bucket) {
				// custom S3-compatible endpoint: also allow the bucket subdomain form
				hosts.add(`${url.protocol}//${config.r2.bucket}.${url.host}`);
			}
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
		// SvelteKit ships a small inline bootstrap script per page to start hydration.
		// Without 'unsafe-inline' (or a nonce) it is blocked and the app never becomes
		// interactive — uploads, lightbox, hearts, presence all die. The app renders no
		// user-controlled markup via {@html}, so the XSS surface here is minimal.
		`script-src 'self' 'unsafe-inline'`,
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
