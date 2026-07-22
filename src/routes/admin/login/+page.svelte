<script lang="ts">
	import { enhance } from '$app/forms';
	import type { ActionData, PageData } from './$types';

	let { form, data }: { form: ActionData; data: PageData } = $props();
	let submitting = $state(false);
</script>

<svelte:head><title>Panel admina — logowanie</title></svelte:head>

<div class="wrap container container-narrow">
	<div class="card box">
		<h1>Panel administratora</h1>
		<p class="muted">Galeria ślubna — dostęp dla organizatorów.</p>

		{#if !data.configured}
			<p class="alert">
				Panel nie jest jeszcze skonfigurowany. Ustaw <code>ADMIN_PASSWORD_HASH</code> i
				<code>ADMIN_SESSION_SECRET</code> w pliku <code>.env</code>.
			</p>
		{/if}

		<form
			method="POST"
			use:enhance={() => {
				submitting = true;
				return async ({ update }) => {
					await update();
					submitting = false;
				};
			}}
		>
			<label class="label" for="password">Hasło</label>
			<input
				id="password"
				name="password"
				class="field"
				type="password"
				autocomplete="current-password"
				required
			/>
			{#if form?.message}<p class="err">{form.message}</p>{/if}
			<button class="btn btn-primary btn-block" type="submit" disabled={submitting}>
				{submitting ? 'Logowanie…' : 'Zaloguj'}
			</button>
		</form>
		<p class="back"><a href="/">← Wróć do galerii</a></p>
	</div>
</div>

<style>
	.wrap {
		min-height: 100dvh;
		display: grid;
		place-items: center;
		padding: 1.5rem 1rem;
	}
	.box {
		width: 100%;
		padding: 2rem 1.6rem;
	}
	.box h1 {
		font-size: 1.8rem;
	}
	form {
		margin-top: 1.4rem;
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}
	.btn-block {
		margin-top: 0.6rem;
	}
	.err {
		color: var(--danger);
		font-size: 0.9rem;
		margin: 0.2rem 0 0;
	}
	.alert {
		background: #fdf6f5;
		border: 1px solid #e6c9c5;
		border-radius: var(--radius-sm);
		padding: 0.8rem;
		font-size: 0.85rem;
	}
	code {
		background: var(--paper-2);
		padding: 1px 5px;
		border-radius: 5px;
		font-size: 0.82em;
	}
	.back {
		margin-top: 1.2rem;
		text-align: center;
		font-size: 0.88rem;
	}
</style>
