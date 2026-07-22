<script lang="ts">
	import { enhance } from '$app/forms';
	import { invalidateAll } from '$app/navigation';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	function fmtSize(bytes: number): string {
		const u = ['B', 'KB', 'MB', 'GB', 'TB'];
		const i = Math.min(u.length - 1, Math.floor(Math.log(Math.max(1, bytes)) / Math.log(1024)));
		return `${(bytes / Math.pow(1024, i)).toFixed(i ? 1 : 0)} ${u[i]}`;
	}
	function fmtDate(ms: number): string {
		return new Date(ms).toLocaleString('pl-PL', { dateStyle: 'short', timeStyle: 'short' });
	}

	const refresh = () => async ({ update }: { update: (opts?: { reset?: boolean }) => Promise<void> }) => {
		await update({ reset: false });
		await invalidateAll();
	};

	let confirmingId = $state('');
</script>

<svelte:head><title>Panel admina — galeria</title></svelte:head>

<div class="container admin">
	<header class="top">
		<div>
			<h1>Panel administratora</h1>
			<p class="muted">Zarządzanie galerią ślubną</p>
		</div>
		<div class="top-actions">
			<a class="btn btn-ghost" href="/" target="_blank" rel="noopener">Galeria ↗</a>
			<form method="POST" action="?/logout">
				<button class="btn btn-ghost" type="submit">Wyloguj</button>
			</form>
		</div>
	</header>

	<section class="stats">
		<div class="stat card"><span class="n">{data.stats.total}</span><span class="l">wszystkich</span></div>
		<div class="stat card"><span class="n">{data.stats.images}</span><span class="l">zdjęć</span></div>
		<div class="stat card"><span class="n">{data.stats.videos}</span><span class="l">filmów</span></div>
		<div class="stat card"><span class="n">{data.stats.hidden}</span><span class="l">ukrytych</span></div>
		<div class="stat card"><span class="n">{fmtSize(data.stats.totalBytes)}</span><span class="l">łącznie</span></div>
		{#if data.stats.pending > 0}
			<div class="stat card pending"><span class="n">{data.stats.pending}</span><span class="l">w przetwarzaniu</span></div>
		{/if}
	</section>

	<section class="downloads card">
		<div>
			<strong>Pobierz wszystko</strong>
			<p class="muted">Oryginały spakowane do ZIP (strumieniowo).</p>
		</div>
		<div class="dl-actions">
			<a class="btn btn-primary" href="/admin/download" download>ZIP — wszystko</a>
			<a class="btn btn-ghost" href="/admin/download?scope=visible" download>ZIP — tylko widoczne</a>
		</div>
	</section>

	<section class="items">
		{#if data.items.length === 0}
			<p class="muted center">Brak plików.</p>
		{:else}
			<div class="grid">
				{#each data.items as item (item.id)}
					<article class="item card" class:hidden={item.hidden}>
						<div class="thumb">
							{#if item.hasThumb}
								<img src={`/m/${item.id}/thumb`} alt="" loading="lazy" />
							{:else}
								<div class="ph">{item.kind === 'video' ? '🎬' : '🖼️'}</div>
							{/if}
							{#if item.kind === 'video'}<span class="tag">▶ wideo</span>{/if}
							{#if item.hidden}<span class="tag hide-tag">ukryte</span>{/if}
						</div>
						<div class="body">
							<div class="fname" title={item.filename}>{item.filename}</div>
							<dl class="meta">
								<div><dt>Gość</dt><dd>{item.guestName ?? '—'}</dd></div>
								<div><dt>Data</dt><dd>{fmtDate(item.createdAt)}</dd></div>
								<div><dt>Rozmiar</dt><dd>{fmtSize(item.size)}</dd></div>
								<div><dt>Typ</dt><dd>{item.mime}</dd></div>
								{#if item.hearts > 0}<div><dt>❤</dt><dd>{item.hearts}</dd></div>{/if}
							</dl>
							<div class="actions">
								<a class="btn btn-ghost sm" href={`/m/${item.id}/download`} download>Pobierz</a>
								<form method="POST" action={item.hidden ? '?/unhide' : '?/hide'} use:enhance={refresh}>
									<input type="hidden" name="id" value={item.id} />
									<button class="btn btn-ghost sm" type="submit">{item.hidden ? 'Pokaż' : 'Ukryj'}</button>
								</form>
								{#if confirmingId === item.id}
									<form method="POST" action="?/delete" use:enhance={refresh}>
										<input type="hidden" name="id" value={item.id} />
										<button class="btn btn-danger sm" type="submit">Potwierdź</button>
									</form>
									<button class="btn btn-ghost sm" onclick={() => (confirmingId = '')}>Anuluj</button>
								{:else}
									<button class="btn btn-danger sm" onclick={() => (confirmingId = item.id)}>Usuń</button>
								{/if}
							</div>
						</div>
					</article>
				{/each}
			</div>
		{/if}
	</section>
</div>

<style>
	.admin {
		padding: 1.5rem 1rem 4rem;
	}
	.top {
		display: flex;
		justify-content: space-between;
		align-items: flex-start;
		gap: 1rem;
		flex-wrap: wrap;
		margin-bottom: 1.5rem;
	}
	.top h1 {
		font-size: 1.8rem;
	}
	.top-actions {
		display: flex;
		gap: 0.5rem;
	}
	.stats {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
		gap: 0.7rem;
		margin-bottom: 1.2rem;
	}
	.stat {
		padding: 1rem;
		text-align: center;
	}
	.stat .n {
		display: block;
		font-family: var(--font-serif);
		font-size: 1.7rem;
		color: var(--gold-deep);
		font-weight: 600;
	}
	.stat .l {
		font-size: 0.78rem;
		color: var(--ink-faint);
	}
	.stat.pending .n {
		color: var(--rose);
	}
	.downloads {
		display: flex;
		justify-content: space-between;
		align-items: center;
		gap: 1rem;
		flex-wrap: wrap;
		padding: 1.1rem 1.3rem;
		margin-bottom: 1.6rem;
	}
	.dl-actions {
		display: flex;
		gap: 0.5rem;
		flex-wrap: wrap;
	}
	.grid {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
		gap: 1rem;
	}
	.item {
		overflow: hidden;
		display: flex;
		flex-direction: column;
	}
	.item.hidden {
		opacity: 0.7;
	}
	.thumb {
		position: relative;
		aspect-ratio: 4 / 3;
		background: var(--paper-2);
	}
	.thumb img {
		width: 100%;
		height: 100%;
		object-fit: cover;
	}
	.ph {
		width: 100%;
		height: 100%;
		display: grid;
		place-items: center;
		font-size: 2.4rem;
	}
	.tag {
		position: absolute;
		top: 8px;
		left: 8px;
		background: rgba(0, 0, 0, 0.55);
		color: #fff;
		font-size: 0.72rem;
		padding: 3px 8px;
		border-radius: 999px;
	}
	.hide-tag {
		left: auto;
		right: 8px;
		background: var(--danger);
	}
	.body {
		padding: 0.9rem;
		display: flex;
		flex-direction: column;
		gap: 0.6rem;
		flex: 1;
	}
	.fname {
		font-weight: 600;
		font-size: 0.9rem;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}
	.meta {
		margin: 0;
		display: grid;
		gap: 0.15rem;
		font-size: 0.8rem;
	}
	.meta > div {
		display: flex;
		gap: 0.5rem;
	}
	.meta dt {
		color: var(--ink-faint);
		min-width: 52px;
	}
	.meta dd {
		margin: 0;
		color: var(--ink-soft);
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.actions {
		margin-top: auto;
		display: flex;
		gap: 0.4rem;
		flex-wrap: wrap;
	}
	.actions form {
		display: contents;
	}
	.btn.sm {
		min-height: 34px;
		padding: 0.35rem 0.8rem;
		font-size: 0.82rem;
	}
</style>
