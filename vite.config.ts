import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';

export default defineConfig({
	plugins: [sveltekit()],
	server: {
		fs: {
			// Allow serving the project root only.
			strict: true
		}
	},
	// better-sqlite3 / sharp are native modules — keep them external in SSR.
	ssr: {
		external: ['better-sqlite3', 'sharp', 'archiver']
	}
});
