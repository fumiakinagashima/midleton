<script lang="ts">
	import { toast } from '$lib/stores/toast.svelte';
</script>

{#if toast.items.length > 0}
	<div class="toast-container" role="region" aria-live="polite" aria-label="通知">
		{#each toast.items as item (item.id)}
			<div class="toast" class:toast-success={item.type === 'success'} class:toast-error={item.type === 'error'} class:toast-info={item.type === 'info'}>
				{#if item.type === 'success'}
					<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
						<polyline points="20 6 9 17 4 12"/>
					</svg>
				{:else if item.type === 'error'}
					<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
						<circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
					</svg>
				{:else}
					<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
						<circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/>
					</svg>
				{/if}
				<span>{item.message}</span>
			</div>
		{/each}
	</div>
{/if}

<style>
	.toast-container {
		position: fixed;
		bottom: 24px;
		right: 24px;
		display: flex;
		flex-direction: column;
		gap: 8px;
		z-index: 9999;
		pointer-events: none;
	}

	.toast {
		display: flex;
		align-items: center;
		gap: 10px;
		padding: 12px 16px;
		border-radius: 8px;
		font-size: 0.875rem;
		font-weight: 500;
		min-width: 240px;
		max-width: 380px;
		box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
		animation: slideIn 0.2s ease;
	}

	.toast-success {
		background: #16a34a;
		color: #fff;
	}

	.toast-error {
		background: #dc2626;
		color: #fff;
	}

	.toast-info {
		background: var(--color-surface, #fff);
		color: var(--color-text, #111);
		border: 1px solid var(--color-border, #e5e7eb);
	}

	@keyframes slideIn {
		from { transform: translateX(20px); opacity: 0; }
		to { transform: translateX(0); opacity: 1; }
	}
</style>
