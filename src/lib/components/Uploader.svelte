<script lang="ts">
	import { uploadFile, resolveMime, kindForMime, type UploadItem } from '$lib/upload';

	let {
		imageMb,
		videoMb,
		guestName = $bindable(''),
		onUploaded
	}: {
		imageMb: number;
		videoMb: number;
		guestName: string;
		onUploaded: () => void;
	} = $props();

	let queue = $state<UploadItem[]>([]);
	let uploading = $state(false);
	let fileInput = $state<HTMLInputElement | null>(null);
	let cameraInput = $state<HTMLInputElement | null>(null);
	let localId = 0;

	const CONCURRENCY = 2;

	const activeCount = $derived(
		queue.filter((q) => q.status === 'uploading' || q.status === 'queued').length
	);
	const doneCount = $derived(queue.filter((q) => q.status === 'done').length);

	function humanSize(bytes: number): string {
		const u = ['B', 'KB', 'MB', 'GB'];
		const i = Math.min(u.length - 1, Math.floor(Math.log(Math.max(1, bytes)) / Math.log(1024)));
		return `${(bytes / Math.pow(1024, i)).toFixed(i ? 1 : 0)} ${u[i]}`;
	}

	function addFiles(files: FileList | null) {
		if (!files) return;
		for (const file of Array.from(files)) {
			const mime = resolveMime(file);
			const kind = kindForMime(mime);
			if (!kind) {
				queue = [
					...queue,
					{
						id: `e${localId++}`,
						file,
						name: file.name,
						sizeLabel: humanSize(file.size),
						kind: 'image',
						previewUrl: null,
						progress: 0,
						status: 'error',
						error: 'Nieobsługiwany format'
					}
				];
				continue;
			}
			const limit = (kind === 'video' ? videoMb : imageMb) * 1024 * 1024;
			const tooBig = file.size > limit;
			queue = [
				...queue,
				{
					id: `f${localId++}`,
					file,
					name: file.name,
					sizeLabel: humanSize(file.size),
					kind,
					previewUrl: kind === 'image' ? URL.createObjectURL(file) : null,
					progress: 0,
					status: tooBig ? 'error' : 'queued',
					error: tooBig ? `Za duży plik (limit ${kind === 'video' ? videoMb : imageMb} MB)` : undefined
				}
			];
		}
		if (fileInput) fileInput.value = '';
		if (cameraInput) cameraInput.value = ''; // allow retaking the same shot
		void run();
	}

	async function run() {
		if (uploading) return;
		uploading = true;
		try {
			// persist guest name for next time
			try {
				if (guestName.trim()) localStorage.setItem('wesele:guestName', guestName.trim());
			} catch {
				/* ignore */
			}

			let didUpload = false;
			// process with limited concurrency
			while (queue.some((q) => q.status === 'queued')) {
				const batch = queue.filter((q) => q.status === 'queued').slice(0, CONCURRENCY);
				await Promise.all(
					batch.map(async (item) => {
						item.status = 'uploading';
						queue = queue;
						try {
							await uploadFile(item.file, guestName.trim() || null, (f) => {
								item.progress = f;
								queue = queue;
							});
							item.status = 'done';
							item.progress = 1;
							didUpload = true;
						} catch (e) {
							item.status = 'error';
							item.error = e instanceof Error ? e.message : 'Błąd wysyłania';
						}
						queue = queue;
					})
				);
			}
			if (didUpload) onUploaded();
		} finally {
			uploading = false;
		}
	}

	function retry(item: UploadItem) {
		if (item.status !== 'error') return;
		item.status = 'queued';
		item.error = undefined;
		item.progress = 0;
		queue = queue;
		void run();
	}

	function clearDone() {
		for (const q of queue) if (q.previewUrl && q.status === 'done') URL.revokeObjectURL(q.previewUrl);
		queue = queue.filter((q) => q.status !== 'done');
	}
</script>

<div class="uploader card">
	<label class="label" for="guest">Twoje imię lub pseudonim <span class="muted">(opcjonalne)</span></label>
	<input
		id="guest"
		class="field"
		type="text"
		maxlength="40"
		placeholder="np. Ciocia Basia"
		bind:value={guestName}
	/>

	<!-- hidden inputs: camera capture opens the camera directly; the other picks from the gallery/files -->
	<input
		bind:this={cameraInput}
		type="file"
		accept="image/*,video/*"
		capture="environment"
		onchange={(e) => addFiles((e.currentTarget as HTMLInputElement).files)}
		hidden
	/>

	<div class="pickers">
		<button type="button" class="picker cam" onclick={() => cameraInput?.click()}>
			<span class="pk-emoji">📷</span>
			<span class="pk-title">Zrób zdjęcie</span>
			<span class="pk-sub">Aparatem, na żywo</span>
		</button>

		<label class="picker gallery" class:busy={uploading}>
			<input
				bind:this={fileInput}
				type="file"
				accept="image/*,video/*"
				multiple
				onchange={(e) => addFiles((e.currentTarget as HTMLInputElement).files)}
				hidden
			/>
			<span class="pk-emoji">🖼️</span>
			<span class="pk-title">Wybierz z galerii</span>
			<span class="pk-sub">Wiele naraz · zdjęcia i filmy</span>
		</label>
	</div>
	<p class="limits muted">zdjęcia do {imageMb} MB · wideo do {videoMb} MB</p>

	{#if queue.length > 0}
		<div class="status-row">
			<span>{doneCount} / {queue.length} gotowe</span>
			{#if activeCount > 0}<span class="muted">Wysyłanie… nie zamykaj strony</span>{/if}
			{#if doneCount > 0 && activeCount === 0}
				<button class="link" onclick={clearDone}>Wyczyść listę</button>
			{/if}
		</div>

		<ul class="list">
			{#each queue as item (item.id)}
				<li class="item" class:error={item.status === 'error'}>
					<div class="thumb">
						{#if item.previewUrl}
							<img src={item.previewUrl} alt="" />
						{:else}
							<span>{item.kind === 'video' ? '🎬' : '🖼️'}</span>
						{/if}
					</div>
					<div class="info">
						<div class="name" title={item.name}>{item.name}</div>
						<div class="sub muted">
							{item.sizeLabel}
							{#if item.status === 'done'}· ✅ dodano{/if}
							{#if item.status === 'uploading'}· {Math.round(item.progress * 100)}%{/if}
							{#if item.status === 'queued'}· w kolejce{/if}
							{#if item.status === 'error'}· <span class="err">{item.error}</span>{/if}
						</div>
						{#if item.status === 'uploading' || (item.status === 'queued' && item.progress > 0)}
							<div class="bar"><div class="fill" style:width={`${item.progress * 100}%`}></div></div>
						{/if}
					</div>
					{#if item.status === 'error'}
						<button class="link" onclick={() => retry(item)}>Ponów</button>
					{/if}
				</li>
			{/each}
		</ul>
	{/if}
</div>

<style>
	.uploader {
		padding: 1.1rem;
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}
	.pickers {
		margin-top: 0.9rem;
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 0.6rem;
	}
	.picker {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 0.25rem;
		padding: 1.5rem 0.9rem;
		border: 2px dashed #f0cf6a;
		border-radius: 18px;
		background: linear-gradient(180deg, #fffbe9, #fff7d6);
		cursor: pointer;
		text-align: center;
		font: inherit;
		color: inherit;
		transition: border-color 0.15s ease, background 0.15s ease, transform 0.08s ease;
	}
	.picker:hover {
		border-color: var(--gold);
		background: linear-gradient(180deg, #fff8d8, #ffefb0);
	}
	.picker:active {
		transform: translateY(1px);
	}
	.picker.cam {
		border-style: solid;
		border-color: var(--gold);
		background: linear-gradient(180deg, var(--marigold), var(--marigold-2));
	}
	.picker.cam .pk-title {
		color: var(--btn-ink);
	}
	.picker.cam .pk-sub {
		color: #8a5e12;
	}
	.pk-emoji {
		font-size: 1.8rem;
	}
	.pk-title {
		font-weight: 800;
		font-size: 1.02rem;
		color: var(--ink-strong);
		line-height: 1.15;
	}
	.pk-sub {
		font-size: 0.76rem;
		color: var(--ink-faint);
	}
	.limits {
		margin: 0.6rem 0 0;
		text-align: center;
		font-size: 0.8rem;
	}
	@media (max-width: 360px) {
		.pickers {
			grid-template-columns: 1fr;
		}
	}
	.status-row {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		font-size: 0.85rem;
		margin-top: 0.4rem;
		flex-wrap: wrap;
	}
	.list {
		list-style: none;
		margin: 0.5rem 0 0;
		padding: 0;
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
		max-height: 320px;
		overflow-y: auto;
	}
	.item {
		display: flex;
		align-items: center;
		gap: 0.7rem;
		padding: 0.5rem;
		border: 1px solid var(--line);
		border-radius: var(--radius-sm);
		background: #fff;
	}
	.item.error {
		border-color: #e6c9c5;
		background: #fdf6f5;
	}
	.thumb {
		width: 44px;
		height: 44px;
		border-radius: 8px;
		overflow: hidden;
		flex: none;
		display: grid;
		place-items: center;
		background: var(--paper-2);
		font-size: 1.2rem;
	}
	.thumb img {
		width: 100%;
		height: 100%;
		object-fit: cover;
	}
	.info {
		flex: 1;
		min-width: 0;
	}
	.name {
		font-size: 0.88rem;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}
	.sub {
		font-size: 0.76rem;
	}
	.err {
		color: var(--danger);
	}
	.bar {
		margin-top: 4px;
		height: 5px;
		border-radius: 999px;
		background: var(--paper-2);
		overflow: hidden;
	}
	.fill {
		height: 100%;
		background: linear-gradient(90deg, var(--gold), var(--gold-deep));
		transition: width 0.2s ease;
	}
	.link {
		background: none;
		border: none;
		color: var(--gold-deep);
		font-weight: 600;
		cursor: pointer;
		font-size: 0.82rem;
		padding: 4px 6px;
		flex: none;
	}
</style>
