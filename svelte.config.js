import adapter from '@sveltejs/adapter-node';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';

/** @type {import('@sveltejs/kit').Config} */
const config = {
	preprocess: vitePreprocess(),
	kit: {
		adapter: adapter()
		// CSRF origin checking stays at its secure default (POST/PUT/PATCH/DELETE must
		// come from a trusted origin) — our API is same-origin, direct uploads go to R2.
	}
};

export default config;
