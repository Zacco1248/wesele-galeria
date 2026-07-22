<script lang="ts">
	import { onMount } from 'svelte';
	import type { PageData } from './$types';
	import Uploader from '$lib/components/Uploader.svelte';
	import Gallery from '$lib/components/Gallery.svelte';
	import Florals from '$lib/components/Florals.svelte';
	import OnlineCounter from '$lib/components/OnlineCounter.svelte';

	let { data }: { data: PageData } = $props();

	let guestName = $state('');
	let gallery = $state<Gallery | null>(null);

	onMount(() => {
		try {
			guestName = localStorage.getItem('wesele:guestName') ?? '';
		} catch {
			/* ignore */
		}
	});

	function scrollToUpload() {
		document.getElementById('dodaj')?.scrollIntoView({ behavior: 'smooth' });
	}
</script>

<svelte:head>
	<title>{data.event.title} — galeria wspomnień</title>
	<meta name="description" content="Wspólna galeria zdjęć i filmów z wesela." />
</svelte:head>

<div class="topbar">
	<div class="container topbar-inner">
		<OnlineCounter />
	</div>
</div>

<header class="hero">
	<div class="container">
		<Florals variant="sprig" width="200" />
		<p class="kicker">Wspólna galeria wspomnień</p>
		<h1>{data.event.title}</h1>
		<p class="subtitle">{data.event.subtitle}</p>
		<div class="hero-cta">
			<button class="btn btn-primary" onclick={scrollToUpload}>Dodaj zdjęcia i filmy</button>
		</div>
		<p class="counter">
			<strong>{data.total}</strong>
			{data.total === 1 ? 'wspomnienie dodane' : 'wspomnień dodanych'}
		</p>
	</div>
</header>

<main class="container">
	<section id="dodaj" class="upload-section container-narrow">
		<Uploader
			imageMb={data.limits.imageMb}
			videoMb={data.limits.videoMb}
			bind:guestName
			onUploaded={() => gallery?.refresh()}
		/>
		<p class="hint muted center">
			Twoje pliki trafiają prosto do naszej galerii i są widoczne od razu 💛
		</p>
	</section>

	<div class="section-divider"><Florals variant="divider" width="240" /></div>

	<section class="gallery-section">
		<h2 class="center gallery-title">Nasze wspólne wspomnienia</h2>
		<Gallery bind:this={gallery} initialItems={data.items} initialTotal={data.total} />
	</section>
</main>

<footer class="footer">
	<div class="container center muted">
		<p>Dziękujemy, że jesteście z nami 🤍</p>
	</div>
</footer>

<style>
	.topbar {
		padding: 0.7rem 0 0;
	}
	.topbar-inner {
		display: flex;
		justify-content: flex-end;
	}
	/* visible but modest, kept in the corner (out of the center of attention) */
	.topbar :global(.online) {
		font-size: 0.8rem;
		padding: 0.3rem 0.75rem;
	}
	.hero {
		text-align: center;
		padding: clamp(1.4rem, 5vw, 2.6rem) 0 clamp(1.5rem, 5vw, 2.5rem);
	}
	.kicker {
		text-transform: uppercase;
		letter-spacing: 0.28em;
		font-size: 0.72rem;
		color: var(--gold-deep);
		margin: 0 0 0.6rem;
	}
	.hero h1 {
		font-size: clamp(1.7rem, 8.5vw, 3.2rem);
		color: var(--ink);
		margin: 0;
		white-space: nowrap;
	}
	.subtitle {
		color: var(--ink-soft);
		font-size: 1.05rem;
		margin: 0.6rem 0 1.3rem;
	}
	.hero-cta {
		margin-top: 0.4rem;
	}
	.counter {
		margin: 1.3rem 0 0;
		color: var(--ink-soft);
		font-size: 0.95rem;
	}
	.counter strong {
		font-family: var(--font-serif);
		font-size: 1.3rem;
		color: var(--gold-deep);
	}
	.upload-section {
		scroll-margin-top: 1rem;
	}
	.hint {
		margin: 0.9rem 0 0;
		font-size: 0.85rem;
	}
	.section-divider {
		margin: 2.5rem 0 1.8rem;
	}
	.gallery-title {
		font-size: clamp(1.6rem, 6vw, 2.2rem);
		margin-bottom: 1.4rem;
		color: var(--ink);
	}
	.gallery-section {
		padding-bottom: 3rem;
	}
	.footer {
		border-top: 1px solid var(--line);
		padding: 2rem 0 3rem;
		font-size: 0.85rem;
	}
</style>
