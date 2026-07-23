<script lang="ts">
	import type { GalleryItem } from '$lib/server/gallery';
	import Lightbox from './Lightbox.svelte';

	let {
		initialItems,
		initialTotal
	}: {
		initialItems: GalleryItem[];
		initialTotal: number;
	} = $props();

	let items = $state<GalleryItem[]>([...initialItems]);
	let total = $state(initialTotal);
	let loading = $state(false);
	let done = $state(initialItems.length >= initialTotal);
	let lightboxIndex = $state(-1);
	const liked = new Set<string>();

	function fmtDuration(sec: number | null): string {
		if (!sec || sec <= 0) return '';
		const m = Math.floor(sec / 60);
		const s = Math.round(sec % 60);
		return `${m}:${String(s).padStart(2, '0')}`;
	}

	async function loadMore() {
		if (loading || done || items.length === 0) return;
		loading = true;
		try {
			const before = items[items.length - 1].createdAt;
			const res = await fetch(`/api/gallery?before=${before}&limit=40`);
			const data = await res.json();
			const existing = new Set(items.map((i) => i.id));
			const fresh = (data.items as GalleryItem[]).filter((i) => !existing.has(i.id));
			items = [...items, ...fresh];
			total = data.total;
			if (!data.nextBefore || fresh.length === 0) done = true;
		} finally {
			loading = false;
		}
	}

	/**
	 * Pull the newest items: prepend any we don't have yet AND update items we
	 * already show (so a thumbnail that finished processing after upload appears
	 * without a full page reload). Called after uploads + on a timer.
	 */
	export async function refresh() {
		try {
			const res = await fetch('/api/gallery?limit=40');
			const data = await res.json();
			const byId = new Map(items.map((i) => [i.id, i]));
			const prepend: GalleryItem[] = [];
			for (const it of data.items as GalleryItem[]) {
				const cur = byId.get(it.id);
				if (cur) {
					// refresh mutable fields in place (deep-reactive $state)
					cur.processed = it.processed;
					cur.hasThumb = it.hasThumb;
					cur.hearts = it.hearts;
					cur.width = it.width;
					cur.height = it.height;
					cur.duration = it.duration;
				} else {
					prepend.push(it);
				}
			}
			if (prepend.length) items = [...prepend, ...items];
			total = data.total;
		} catch {
			/* offline — ignore */
		}
		scheduleNext();
	}

	// Adaptive polling: fast (3s) while anything is still processing, else 15s.
	let pollStopped = false;
	let pollTimer: ReturnType<typeof setTimeout> | undefined;
	function scheduleNext() {
		clearTimeout(pollTimer);
		if (pollStopped) return;
		const pending = items.some((i) => !i.processed);
		pollTimer = setTimeout(refresh, pending ? 3_000 : 15_000);
	}

	async function toggleHeart(item: GalleryItem, e: MouseEvent) {
		e.stopPropagation();
		try {
			const res = await fetch('/api/reactions', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ id: item.id })
			});
			if (!res.ok) return;
			const data = await res.json();
			item.hearts = data.hearts;
			if (data.liked) liked.add(item.id);
			else liked.delete(item.id);
			items = items;
		} catch {
			/* ignore */
		}
	}

	// Kick off the live refresh loop; scheduleNext() (called at the end of every
	// refresh, including the manual one after an upload) keeps the cadence adaptive.
	$effect(() => {
		pollStopped = false;
		pollTimer = setTimeout(refresh, 5_000);
		return () => {
			pollStopped = true;
			clearTimeout(pollTimer);
		};
	});

	// infinite scroll sentinel
	let sentinel = $state<HTMLElement | null>(null);
	$effect(() => {
		if (!sentinel) return;
		const io = new IntersectionObserver((entries) => {
			if (entries[0].isIntersecting) loadMore();
		});
		io.observe(sentinel);
		return () => io.disconnect();
	});
</script>

<section class="gallery" aria-label="Wspólna galeria">
	{#if items.length === 0}
		<div class="empty card">
			<p class="empty-emoji">🌻</p>
			<p class="empty-title">Galeria jest jeszcze pusta</p>
			<p class="muted">Bądź pierwszą osobą, która doda wspomnienie!</p>
		</div>
	{:else}
		<div class="grid">
			{#each items as item, i (item.id)}
				<button
					class="tile"
					onclick={() => (lightboxIndex = i)}
					aria-label={item.kind === 'video' ? 'Odtwórz film' : 'Powiększ zdjęcie'}
				>
					{#if item.hasThumb}
						<img
							class="thumb"
							src={`/m/${item.id}/thumb`}
							alt={item.guestName ?? 'Wspomnienie z wesela'}
							loading="lazy"
							decoding="async"
						/>
					{:else}
						<div class="thumb placeholder" class:pending={!item.processed}>
							{item.kind === 'video' ? '🎬' : '🖼️'}
						</div>
					{/if}

					{#if item.kind === 'video'}
						<span class="badge play">▶</span>
						{#if item.duration}<span class="badge dur">{fmtDuration(item.duration)}</span>{/if}
					{/if}

					<span
						class="heart"
						class:on={liked.has(item.id)}
						role="button"
						tabindex="-1"
						onclick={(e) => toggleHeart(item, e)}
						onkeydown={() => {}}
						aria-label="Polub"
					>
						{liked.has(item.id) ? '❤' : '♡'}{#if item.hearts > 0}<b>{item.hearts}</b>{/if}
					</span>

					{#if item.guestName}<span class="who">{item.guestName}</span>{/if}
				</button>
			{/each}
		</div>

		{#if !done}
			<div bind:this={sentinel} class="sentinel">
				{#if loading}<span class="muted">Ładowanie…</span>{/if}
			</div>
		{/if}
	{/if}
</section>

{#if lightboxIndex >= 0}
	<Lightbox {items} bind:index={lightboxIndex} onClose={() => (lightboxIndex = -1)} />
{/if}

<style>
	.grid {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(112px, 1fr));
		gap: 8px;
	}
	@media (min-width: 640px) {
		.grid {
			grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
			gap: 12px;
		}
	}
	.tile {
		position: relative;
		aspect-ratio: 1;
		border: none;
		padding: 0;
		border-radius: var(--radius-sm);
		overflow: hidden;
		cursor: pointer;
		background: var(--paper-2);
		box-shadow: var(--shadow-sm);
		transition: transform 0.12s ease, box-shadow 0.2s ease;
	}
	.tile:hover {
		transform: translateY(-2px);
		box-shadow: var(--shadow-md);
	}
	.thumb {
		width: 100%;
		height: 100%;
		object-fit: cover;
		display: block;
	}
	.placeholder {
		display: grid;
		place-items: center;
		font-size: 2rem;
		color: var(--ink-faint);
		background: linear-gradient(135deg, var(--paper-2), #ece2d4);
	}
	.placeholder.pending {
		animation: pulse 1.4s ease-in-out infinite;
	}
	@keyframes pulse {
		50% {
			opacity: 0.55;
		}
	}
	.badge {
		position: absolute;
		color: #fff;
		background: rgba(0, 0, 0, 0.55);
		border-radius: 999px;
		font-size: 0.72rem;
		line-height: 1;
		padding: 4px 7px;
	}
	.badge.play {
		top: 8px;
		left: 8px;
		width: 22px;
		height: 22px;
		display: grid;
		place-items: center;
		padding: 0;
	}
	.badge.dur {
		bottom: 8px;
		right: 8px;
	}
	.heart {
		position: absolute;
		top: 6px;
		right: 6px;
		display: inline-flex;
		align-items: center;
		gap: 3px;
		color: #fff;
		background: rgba(0, 0, 0, 0.42);
		border-radius: 999px;
		padding: 4px 8px;
		font-size: 0.85rem;
		cursor: pointer;
	}
	.heart.on {
		color: #ff6b81;
	}
	.heart b {
		font-size: 0.72rem;
		font-weight: 700;
	}
	.who {
		position: absolute;
		left: 0;
		right: 0;
		bottom: 0;
		padding: 14px 8px 6px;
		font-size: 0.72rem;
		color: #fff;
		text-align: left;
		background: linear-gradient(180deg, transparent, rgba(0, 0, 0, 0.6));
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}
	.empty {
		padding: 2.9rem 1.5rem;
		text-align: center;
	}
	.empty-emoji {
		font-size: 3rem;
		margin: 0 0 0.6rem;
		line-height: 1;
	}
	.empty-title {
		font-weight: 800;
		font-size: 1.05rem;
		color: var(--ink-strong);
		margin: 0 0 0.3rem;
	}
	.sentinel {
		height: 48px;
		display: grid;
		place-items: center;
	}
</style>
