import { fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { db, type UploadRow } from '$lib/server/db';
import { adminStats, listAll } from '$lib/server/gallery';
import { deleteObject } from '$lib/server/r2';
import { clearSession } from '$lib/server/auth';

export const load: PageServerLoad = async () => {
	return {
		stats: adminStats(),
		items: listAll(1000, 0)
	};
};

function idOf(form: FormData): string | null {
	const id = String(form.get('id') ?? '');
	return /^[a-f0-9]{32}$/.test(id) ? id : null;
}

export const actions: Actions = {
	logout: async ({ cookies }) => {
		clearSession(cookies);
		throw redirect(303, '/admin/login');
	},

	hide: async ({ request }) => {
		const id = idOf(await request.formData());
		if (!id) return fail(400, { message: 'Bad id' });
		db().prepare(`UPDATE uploads SET hidden = 1 WHERE id = ?`).run(id);
		return { ok: true };
	},

	unhide: async ({ request }) => {
		const id = idOf(await request.formData());
		if (!id) return fail(400, { message: 'Bad id' });
		db().prepare(`UPDATE uploads SET hidden = 0 WHERE id = ?`).run(id);
		return { ok: true };
	},

	delete: async ({ request }) => {
		const id = idOf(await request.formData());
		if (!id) return fail(400, { message: 'Bad id' });
		const row = db().prepare(`SELECT * FROM uploads WHERE id = ?`).get(id) as UploadRow | undefined;
		if (!row) return fail(404, { message: 'Nie znaleziono' });

		// Remove all R2 objects (original + derived), best-effort.
		for (const key of [row.r2_key, row.thumb_key, row.poster_key]) {
			if (key) await deleteObject(key).catch(() => {});
		}
		db().transaction(() => {
			db().prepare(`DELETE FROM reactions WHERE upload_id = ?`).run(id);
			db().prepare(`DELETE FROM uploads WHERE id = ?`).run(id);
		})();
		return { ok: true };
	}
};
