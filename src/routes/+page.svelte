<script lang="ts">
	import { onMount } from 'svelte';
	import type { PageData } from './$types';
	import Uploader from '$lib/components/Uploader.svelte';
	import Gallery from '$lib/components/Gallery.svelte';

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

<header class="hero">
	<div class="container">
		<p class="kicker">Wspólna galeria wspomnień</p>
		<h1>{data.event.title}</h1>
		<p class="subtitle">{data.event.subtitle}</p>
		<div class="ornament" aria-hidden="true">❦</div>
		<button class="btn btn-primary" onclick={scrollToUpload}>Dodaj zdjęcia i filmy</button>
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

	<div class="ornament section-divider" aria-hidden="true">✦</div>

	<section class="gallery-section">
		<h2 class="center gallery-title">Nasze wspólne wspomnienia</h2>
		<Gallery bind:this={gallery} initialItems={data.items} initialTotal={data.total} />
	</section>
</main>

<footer class="footer">
	<div class="container center muted">
		<p>Zrobione z miłością · dziękujemy, że jesteście z nami 🤍</p>
	</div>
</footer>

<style>
	.hero {
		text-align: center;
		padding: clamp(2.5rem, 8vw, 4.5rem) 0 clamp(1.5rem, 5vw, 2.5rem);
	}
	.kicker {
		text-transform: uppercase;
		letter-spacing: 0.28em;
		font-size: 0.72rem;
		color: var(--gold-deep);
		margin: 0 0 0.6rem;
	}
	.hero h1 {
		font-size: clamp(2.6rem, 12vw, 4.2rem);
		color: var(--ink);
		margin: 0;
	}
	.subtitle {
		color: var(--ink-soft);
		font-size: 1.05rem;
		margin: 0.6rem 0 0.2rem;
	}
	.ornament {
		color: var(--gold);
		font-size: 1.2rem;
		margin: 0.8rem 0 1.3rem;
	}
	.counter {
		margin-top: 1.2rem;
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
		margin: 2.5rem 0 1.5rem;
		font-size: 1rem;
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
