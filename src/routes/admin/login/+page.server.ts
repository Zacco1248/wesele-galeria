import { fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { adminConfigured, verifyPassword, issueSession } from '$lib/server/auth';
import { rateLimit } from '$lib/server/ratelimit';
import { config } from '$lib/server/config';

export const load: PageServerLoad = async ({ locals }) => {
	if (locals.isAdmin) throw redirect(303, '/admin');
	return { configured: adminConfigured() };
};

export const actions: Actions = {
	default: async ({ request, cookies, locals }) => {
		if (!adminConfigured()) {
			return fail(500, { message: 'Panel administratora nie jest skonfigurowany (brak ADMIN_PASSWORD_HASH / ADMIN_SESSION_SECRET).' });
		}
		const rl = rateLimit(`login:${locals.ipHash}`, config.rateLimit.loginMax, config.rateLimit.loginWindowSec);
		if (!rl.ok) return fail(429, { message: `Zbyt wiele prób. Odczekaj ${rl.retryAfter}s.` });

		const form = await request.formData();
		const password = String(form.get('password') ?? '');
		if (!password) return fail(400, { message: 'Podaj hasło.' });

		const ok = await verifyPassword(password);
		if (!ok) return fail(401, { message: 'Nieprawidłowe hasło.' });

		issueSession(cookies);
		throw redirect(303, '/admin');
	}
};
