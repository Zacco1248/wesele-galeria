<script lang="ts">
	// Self-hosted fonts (served from our own origin → CSP font-src 'self' is fine).
	import '@fontsource/mulish/400.css';
	import '@fontsource/mulish/500.css';
	import '@fontsource/mulish/600.css';
	import '@fontsource/mulish/700.css';
	import '@fontsource/cormorant-garamond/500.css';
	import '@fontsource/cormorant-garamond/600.css';
	import '@fontsource/cormorant-garamond/700.css';
	import '../app.css';
	let { children } = $props();
</script>

{@render children()}
