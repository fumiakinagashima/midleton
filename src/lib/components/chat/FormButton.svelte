<script lang="ts">
	import type { FormContent } from '$lib/types/chat';
	import ChevronRight from '$lib/components/icon/ChevronRight.svelte';

	type Props = {
		form: FormContent;
		onclick: () => void;
	};

	let { form, onclick }: Props = $props();

	const TOOL_LABELS: Record<string, string> = {
		create_customer: 'Add customer',
		update_customer: 'Edit customer',
		create_contact: 'Add contact',
		update_contact: 'Edit contact',
		create_deal: 'Add deal',
		update_deal: 'Edit deal',
		create_activity: 'Log activity',
		create_customer_with_contact: 'Add customer and contact',
		create_reminder: 'Set reminder',
		send_email: 'Send email'
	};

	const TOOL_DESCS: Record<string, string> = {
		create_customer: 'Opens the customer registration dialog',
		update_customer: 'Opens the customer edit dialog',
		create_contact: 'Opens the contact registration dialog',
		update_contact: 'Opens the contact edit dialog',
		create_deal: 'Opens the deal registration dialog',
		update_deal: 'Opens the deal edit dialog',
		create_activity: 'Opens the activity registration dialog',
		create_customer_with_contact: 'Opens a dialog to register a customer and contact together',
		create_reminder: 'Opens the reminder setup dialog',
		send_email: 'Opens the email composition form'
	};

	const label = $derived(form.title ?? TOOL_LABELS[form.tool] ?? 'Open registration/edit form');
	const desc = $derived(TOOL_DESCS[form.tool] ?? 'Opens the registration/edit dialog');
</script>

<button class="form-btn" {onclick}>
	<span class="label">{label}</span>
	<span class="desc">{desc}</span>
	<ChevronRight size={16} class="icon" />
</button>

<style lang="scss">
	.form-btn {
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
		text-align: left;
		cursor: pointer;
		transition: border-color 0.15s, background 0.15s;

		&:hover {
			border-color: var(--color-primary);
			background: color-mix(in srgb, var(--color-primary) 6%, var(--color-surface));
		}
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

	:global(.icon) {
		position: absolute;
		right: 12px;
		top: 50%;
		transform: translateY(-50%);
		color: var(--color-text-muted);
		flex-shrink: 0;
	}
</style>
