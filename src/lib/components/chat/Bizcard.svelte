<script lang="ts">
	import BizcardScanner from '$lib/components/bizcard/BizcardScanner.svelte';

	type Props = {
		title?: string;
	};

	let { title }: Props = $props();
</script>

{#if title}
	<p class="bizcard-title">{title}</p>
{/if}
<BizcardScanner />

<style>
	.bizcard-title {
		font-size: 0.875rem;
		font-weight: 600;
		color: var(--color-text-muted);
		margin: 0 0 10px;
	}
</style>
