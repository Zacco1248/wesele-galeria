import { error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { Readable } from 'node:stream';
import archiver from 'archiver';
import { db, type UploadRow } from '$lib/server/db';
import { getObjectStream } from '$lib/server/r2';
import { cleanFilename } from '$lib/server/util';

/**
 * Streams every original as a ZIP. archiver pulls each R2 object as a stream and
 * pipes it straight to the response — nothing is buffered fully in RAM, so even
 * many GB of wedding video download without blowing the 500 MB PM2 limit.
 *
 * Guarded by hooks (admin only). ?scope=visible limits to non-hidden items.
 */
export const GET: RequestHandler = async ({ url, locals }) => {
	if (!locals.isAdmin) throw error(403, 'Forbidden');

	const visibleOnly = url.searchParams.get('scope') === 'visible';
	const rows = db()
		.prepare(`SELECT * FROM uploads ${visibleOnly ? 'WHERE hidden = 0' : ''} ORDER BY created_at ASC`)
		.all() as UploadRow[];

	if (rows.length === 0) throw error(404, 'Brak plików do pobrania.');

	const archive = archiver('zip', { store: true }); // media already compressed → no deflate

	// Feed the archive asynchronously; archiver applies backpressure per entry.
	(async () => {
		try {
			const usedNames = new Set<string>();
			let i = 0;
			for (const row of rows) {
				i++;
				const base = uniqueName(row, i, usedNames);
				try {
					const stream = await getObjectStream(row.r2_key);
					archive.append(stream, { name: base });
				} catch (e) {
					archive.append(`Nie udało się pobrać: ${row.r2_key}\n${String(e)}`, { name: `${base}.ERROR.txt` });
				}
			}
			await archive.finalize();
		} catch (e) {
			archive.destroy(e instanceof Error ? e : new Error(String(e)));
		}
	})();

	const webStream = Readable.toWeb(archive) as unknown as ReadableStream;
	const stamp = new Date().toISOString().slice(0, 10);
	return new Response(webStream, {
		headers: {
			'Content-Type': 'application/zip',
			'Content-Disposition': `attachment; filename="galeria-wesele-${stamp}.zip"`,
			'Cache-Control': 'no-store'
		}
	});
};

function uniqueName(row: UploadRow, index: number, used: Set<string>): string {
	const guest = row.guest_name ? cleanFilename(row.guest_name) + '_' : '';
	let name = `${String(index).padStart(4, '0')}_${guest}${cleanFilename(row.original_filename)}`;
	if (!/\.[a-z0-9]{2,4}$/i.test(name)) name += extFromKey(row.r2_key);
	let candidate = name;
	let n = 1;
	while (used.has(candidate)) candidate = name.replace(/(\.[^.]+)?$/, `_${n++}$1`);
	used.add(candidate);
	return candidate;
}

function extFromKey(key: string): string {
	const m = key.match(/\.([a-z0-9]{2,4})$/i);
	return m ? `.${m[1]}` : '';
}
