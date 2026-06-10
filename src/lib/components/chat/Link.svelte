<script lang="ts">
	type Props = {
		label: string;
		href: string;
		description?: string;
	};

	let { label, href, description }: Props = $props();
</script>

<a class="link-card" {href}>
	<span class="label">{label}</span>
	{#if description}
		<span class="desc">{description}</span>
	{/if}
	<svg class="arrow" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" aria-hidden="true">
		<path d="M9 6l6 6-6 6" stroke-linecap="round" stroke-linejoin="round" />
	</svg>
</a>

<style>
	.link-card {
		position: relative;
		display: flex;
		flex-direction: column;
		align-items: flex-start;
		gap: 2px;
		max-width: 420px;
		padding: 10px 36px 10px 14px;
		border: 1px solid var(--color-border);
		border-radius: 8px;
		background: var(--color-surface);
		text-decoration: none;
		transition: border-color 0.15s, background 0.15s;
	}

	.link-card:hover {
		border-color: var(--color-primary);
		background: color-mix(in srgb, var(--color-primary) 6%, var(--color-surface));
	}

	.label {
		font-size: 0.9375rem;
		font-weight: 500;
		color: var(--color-text);
	}

	.desc {
		font-size: 0.8125rem;
		color: var(--color-text-muted);
	}

	.arrow {
		position: absolute;
		right: 12px;
		top: 50%;
		transform: translateY(-50%);
		width: 16px;
		height: 16px;
		color: var(--color-text-muted);
		flex-shrink: 0;
	}
</style>
