<script lang="ts">
	import type { GalleryItem } from '$lib/server/gallery';

	let {
		items,
		index = $bindable(),
		onClose
	}: {
		items: GalleryItem[];
		index: number;
		onClose: () => void;
	} = $props();

	const current = $derived(items[index]);

	function prev() {
		if (index > 0) index -= 1;
	}
	function next() {
		if (index < items.length - 1) index += 1;
	}
	function onKey(e: KeyboardEvent) {
		if (e.key === 'Escape') onClose();
		else if (e.key === 'ArrowLeft') prev();
		else if (e.key === 'ArrowRight') next();
	}

	// simple touch swipe
	let touchX = 0;
	function onTouchStart(e: TouchEvent) {
		touchX = e.touches[0].clientX;
	}
	function onTouchEnd(e: TouchEvent) {
		const dx = e.changedTouches[0].clientX - touchX;
		if (dx > 60) prev();
		else if (dx < -60) next();
	}
</script>

<svelte:window on:keydown={onKey} />

{#if current}
	<div
		class="backdrop"
		role="dialog"
		aria-modal="true"
		aria-label="Podgląd zdjęcia"
		tabindex="-1"
		ontouchstart={onTouchStart}
		ontouchend={onTouchEnd}
	>
		<button class="close" onclick={onClose} aria-label="Zamknij">✕</button>

		{#if index > 0}
			<button class="nav nav-prev" onclick={prev} aria-label="Poprzednie">‹</button>
		{/if}
		{#if index < items.length - 1}
			<button class="nav nav-next" onclick={next} aria-label="Następne">›</button>
		{/if}

		<div class="stage" onclick={(e) => e.target === e.currentTarget && onClose()} role="presentation">
			{#key current.id}
				{#if current.kind === 'video'}
					<!-- svelte-ignore a11y_media_has_caption -->
					<video
						class="media"
						src={`/m/${current.id}/full`}
						poster={current.hasThumb ? `/m/${current.id}/poster` : undefined}
						controls
						autoplay
						playsinline
					></video>
				{:else}
					<img class="media" src={`/m/${current.id}/full`} alt={current.guestName ?? 'Zdjęcie z wesela'} />
				{/if}
			{/key}
		</div>

		<div class="meta">
			{#if current.guestName}<span class="who">{current.guestName}</span>{/if}
			<span class="count">{index + 1} / {items.length}</span>
			<a class="dl" href={`/m/${current.id}/download`} download>Pobierz oryginał</a>
		</div>
	</div>
{/if}

<style>
	.backdrop {
		position: fixed;
		inset: 0;
		z-index: 100;
		background: rgba(20, 16, 12, 0.94);
		display: flex;
		align-items: center;
		justify-content: center;
		backdrop-filter: blur(4px);
	}
	.stage {
		position: absolute;
		inset: 0;
		display: flex;
		align-items: center;
		justify-content: center;
		padding: max(12px, env(safe-area-inset-top)) 12px 84px;
	}
	.media {
		max-width: 96vw;
		max-height: 82vh;
		width: auto;
		height: auto;
		border-radius: 8px;
		box-shadow: 0 24px 70px rgba(0, 0, 0, 0.6);
		object-fit: contain;
	}
	.close {
		position: absolute;
		top: max(10px, env(safe-area-inset-top));
		right: 12px;
		z-index: 2;
		width: 44px;
		height: 44px;
		border-radius: 50%;
		border: none;
		background: rgba(255, 255, 255, 0.14);
		color: #fff;
		font-size: 1.1rem;
		cursor: pointer;
	}
	.nav {
		position: absolute;
		top: 50%;
		transform: translateY(-50%);
		z-index: 2;
		width: 52px;
		height: 52px;
		border-radius: 50%;
		border: none;
		background: rgba(255, 255, 255, 0.12);
		color: #fff;
		font-size: 2rem;
		line-height: 1;
		cursor: pointer;
		display: grid;
		place-items: center;
	}
	.nav:hover {
		background: rgba(255, 255, 255, 0.22);
	}
	.nav-prev {
		left: 8px;
	}
	.nav-next {
		right: 8px;
	}
	.meta {
		position: absolute;
		bottom: 0;
		left: 0;
		right: 0;
		padding: 16px 18px calc(16px + env(safe-area-inset-bottom));
		display: flex;
		align-items: center;
		gap: 14px;
		color: #f4ece2;
		background: linear-gradient(180deg, transparent, rgba(0, 0, 0, 0.55));
		font-size: 0.9rem;
	}
	.who {
		font-weight: 600;
	}
	.count {
		color: #c9beb0;
	}
	.dl {
		margin-left: auto;
		color: #f4ece2;
		text-decoration: underline;
	}
	@media (max-width: 640px) {
		.nav {
			width: 44px;
			height: 44px;
			font-size: 1.6rem;
		}
	}
</style>
