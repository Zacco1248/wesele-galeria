<script lang="ts">
	import { onMount } from 'svelte';

	// The current viewer is always at least one person online, so we start at 1
	// and render immediately (works even during SSR / before the first fetch).
	// The real count is fetched and refreshed on a timer.
	let online = $state(1);

	function clientId(): string {
		try {
			let id = localStorage.getItem('wesele:cid');
			if (!id) {
				id = crypto.randomUUID?.() ?? Math.random().toString(36).slice(2) + Date.now().toString(36);
				localStorage.setItem('wesele:cid', id);
			}
			return id;
		} catch {
			return 'anon-' + Math.random().toString(36).slice(2);
		}
	}

	async function beat(id: string) {
		try {
			const res = await fetch('/api/presence', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ id })
			});
			if (res.ok) {
				const data = await res.json();
				if (typeof data.online === 'number' && data.online > 0) online = data.online;
			}
		} catch {
			/* offline — keep last known value */
		}
	}

	onMount(() => {
		const id = clientId();
		beat(id);
		const t = setInterval(() => beat(id), 20_000);
		return () => clearInterval(t);
	});

	const label = $derived(online === 1 ? 'gość online' : 'gości online');
</script>

<div class="online" title="Goście przeglądający galerię teraz">
	<span class="dot" aria-hidden="true"></span>
	{online}
	{label}
</div>

<style>
	.online {
		display: inline-flex;
		align-items: center;
		gap: 0.5rem;
		padding: 0.35rem 0.85rem;
		border-radius: 999px;
		background: var(--card);
		border: 1px solid var(--line);
		box-shadow: var(--shadow-sm);
		font-size: 0.85rem;
		color: var(--ink-soft);
		font-weight: 600;
		font-variant-numeric: tabular-nums;
	}
	.dot {
		width: 8px;
		height: 8px;
		border-radius: 50%;
		background: var(--ok);
		box-shadow: 0 0 0 0 rgba(111, 143, 94, 0.6);
		animation: ping 1.8s ease-out infinite;
	}
	@keyframes ping {
		0% {
			box-shadow: 0 0 0 0 rgba(111, 143, 94, 0.55);
		}
		70% {
			box-shadow: 0 0 0 8px rgba(111, 143, 94, 0);
		}
		100% {
			box-shadow: 0 0 0 0 rgba(111, 143, 94, 0);
		}
	}
</style>
