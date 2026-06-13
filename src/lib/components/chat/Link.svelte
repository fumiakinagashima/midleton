<script lang="ts">
	type Props = {
		label: string;
		href: string;
		description?: string;
		newTab?: boolean;
		download?: boolean;
	};

	let { label, href, description, newTab, download }: Props = $props();
</script>

<a class="link-card" {href} target={newTab ? '_blank' : undefined} rel={newTab ? 'noopener noreferrer' : undefined}>
	<span class="label">{label}</span>
	{#if description}
		<span class="desc">{description}</span>
	{/if}
	{#if download}
		<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
			<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" stroke-linecap="round" stroke-linejoin="round" />
			<polyline points="7 10 12 15 17 10" stroke-linecap="round" stroke-linejoin="round" />
			<line x1="12" y1="15" x2="12" y2="3" stroke-linecap="round" stroke-linejoin="round" />
		</svg>
	{:else}
		<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" aria-hidden="true">
			<path d="M9 6l6 6-6 6" stroke-linecap="round" stroke-linejoin="round" />
		</svg>
	{/if}
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

	.icon {
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
