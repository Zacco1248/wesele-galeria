// See https://svelte.dev/docs/kit/types#app.d.ts
declare global {
	namespace App {
		interface Locals {
			/** True when the current request carries a valid admin session cookie. */
			isAdmin: boolean;
			/** Stable per-request hash of the client IP (for rate-limiting / abuse detection). */
			ipHash: string;
			/** Raw-ish client IP (best effort, from proxy headers). Not persisted. */
			clientIp: string;
		}
		// interface Error {}
		// interface PageData {}
		// interface PageState {}
		// interface Platform {}
	}
}

export {};
