<script lang="ts">
	// Decorative floral SVGs for the warm wedding theme (marigold + coral + sage).
	// variant: 'sprig' (single bloom cluster) | 'divider' (symmetric section rule)
	let { variant = 'sprig', width = '180' }: { variant?: 'sprig' | 'divider'; width?: string } =
		$props();

	// a reusable marigold-style bloom
</script>

{#if variant === 'divider'}
	<div class="fdiv" aria-hidden="true" style:--fw={`${width}px`}>
		<svg viewBox="0 0 240 40" fill="none" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="xMidYMid meet">
			<path d="M8 20H96" stroke="var(--line)" stroke-width="1.5" stroke-linecap="round" />
			<path d="M232 20H144" stroke="var(--line)" stroke-width="1.5" stroke-linecap="round" />
			<!-- left leaves -->
			<path d="M96 20c10-2 16-8 18-16-9 1-16 6-18 16Z" fill="var(--fl-leaf)" opacity="0.85" />
			<path d="M96 20c10 2 16 8 18 16-9-1-16-6-18-16Z" fill="var(--fl-leaf)" opacity="0.7" />
			<!-- right leaves -->
			<path d="M144 20c-10-2-16-8-18-16 9 1 16 6 18 16Z" fill="var(--fl-leaf)" opacity="0.85" />
			<path d="M144 20c-10 2-16 8-18 16 9-1 16-6 18-16Z" fill="var(--fl-leaf)" opacity="0.7" />
			<!-- center bloom -->
			<g transform="translate(120 20)">
				<circle r="11" fill="var(--fl-marigold)" />
				<circle r="11" fill="var(--fl-gold)" opacity="0.25" />
				{#each Array(8) as _, i}
					<ellipse
						cx="0"
						cy="-8"
						rx="3.4"
						ry="6"
						fill="var(--fl-gold)"
						transform={`rotate(${i * 45})`}
						opacity="0.9"
					/>
				{/each}
				<circle r="4.5" fill="var(--fl-gold-deep)" />
			</g>
		</svg>
	</div>
{:else}
	<div class="fsprig" aria-hidden="true" style:--fw={`${width}px`}>
		<svg viewBox="0 0 200 90" fill="none" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="xMidYMid meet">
			<!-- stems -->
			<path d="M100 88C100 70 92 58 78 50M100 88c0-18 8-30 22-38M100 88c0-14 0-30 0-44"
				stroke="var(--fl-leaf)" stroke-width="2" stroke-linecap="round" />
			<!-- leaves -->
			<path d="M100 66c-9-3-15-9-17-18 9 1 16 7 17 18Z" fill="var(--fl-leaf)" opacity="0.8" />
			<path d="M100 60c9-3 15-9 17-18-9 1-16 7-17 18Z" fill="var(--fl-leaf)" opacity="0.65" />
			<!-- coral bloom (left) -->
			<g transform="translate(76 46)">
				{#each Array(6) as _, i}
					<ellipse cx="0" cy="-7" rx="4" ry="7" fill="var(--fl-rose)" transform={`rotate(${i * 60})`} opacity="0.92" />
				{/each}
				<circle r="4" fill="var(--fl-marigold)" />
			</g>
			<!-- marigold bloom (right) -->
			<g transform="translate(122 44)">
				<circle r="9" fill="var(--fl-marigold)" />
				{#each Array(8) as _, i}
					<ellipse cx="0" cy="-7" rx="3" ry="5.5" fill="var(--fl-gold)" transform={`rotate(${i * 45})`} opacity="0.9" />
				{/each}
				<circle r="4" fill="var(--fl-gold-deep)" />
			</g>
			<!-- top small bud -->
			<g transform="translate(100 40)">
				<circle r="6.5" fill="var(--fl-gold)" />
				<circle r="3" fill="var(--fl-marigold)" />
			</g>
		</svg>
	</div>
{/if}

<style>
	.fdiv,
	.fsprig {
		display: flex;
		justify-content: center;
		margin: 0 auto;
	}
	.fdiv svg {
		width: min(var(--fw), 82vw);
		height: auto;
	}
	.fsprig svg {
		width: min(var(--fw), 60vw);
		height: auto;
	}
</style>
