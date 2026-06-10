<script lang="ts">
	import BizcardScanner from '$lib/components/bizcard/BizcardScanner.svelte';
	import Form from './Form.svelte';
	import type { BizcardResult } from '../../../routes/api/bizcard/+server';
	import type { FormField } from '$lib/types/chat';

	type Props = {
		title?: string;
		onSubmitForm: (tool: string, data: Record<string, string>) => void;
	};

	let { title, onSubmitForm }: Props = $props();

	let pendingNewCustomer = $state<BizcardResult | null>(null);
	let pendingExistingCustomer = $state<BizcardResult | null>(null);

	const newContactFields = $derived<FormField[]>(
		pendingNewCustomer
			? [
					{ key: 'name', label: '会社名', type: 'text', required: true, value: pendingNewCustomer.company ?? pendingNewCustomer.name ?? '' },
					{ key: 'contact_name', label: '担当者氏名', type: 'text', required: true, value: pendingNewCustomer.name ?? '' },
					{ key: 'contact_name_kana', label: '担当者名（カナ）', type: 'text' },
					{ key: 'contact_role', label: '役職', type: 'text', value: pendingNewCustomer.title ?? '' },
					{ key: 'contact_department', label: '部署', type: 'text' },
					{ key: 'email', label: 'メールアドレス', type: 'email', value: pendingNewCustomer.email ?? '' },
					{ key: 'phone', label: '電話番号', type: 'tel', value: pendingNewCustomer.phone ?? '' },
					{ key: 'address', label: '住所', type: 'text', value: pendingNewCustomer.address ?? '' },
					{ key: 'website', label: 'ホームページ', type: 'text', value: pendingNewCustomer.website ?? '' }
				]
			: []
	);

	const existingContactFields = $derived<FormField[]>(
		pendingExistingCustomer
			? [
					{ key: 'customer_id', label: '顧客を選択する', type: 'recordSelect', required: true, refTable: 'customers' },
					{ key: 'name', label: '担当者氏名', type: 'text', required: true, value: pendingExistingCustomer.name ?? '' },
					{ key: 'name_kana', label: '担当者名（カナ）', type: 'text' },
					{ key: 'role', label: '役職', type: 'text', value: pendingExistingCustomer.title ?? '' },
					{ key: 'department', label: '部署', type: 'text' },
					{ key: 'email', label: 'メールアドレス', type: 'email', value: pendingExistingCustomer.email ?? '' },
					{ key: 'phone', label: '電話番号', type: 'tel', value: pendingExistingCustomer.phone ?? '' }
				]
			: []
	);

	function handleRegister(result: BizcardResult, mode: 'both' | 'existing') {
		if (mode === 'both') {
			pendingNewCustomer = result;
			pendingExistingCustomer = null;
		} else {
			pendingExistingCustomer = result;
			pendingNewCustomer = null;
		}
	}

	function handleSubmitNew(data: Record<string, string>) {
		onSubmitForm('create_customer_with_contact', data);
		pendingNewCustomer = null;
	}

	function handleSubmitExisting(data: Record<string, string>) {
		onSubmitForm('create_contact', data);
		pendingExistingCustomer = null;
	}
</script>

{#if title}
	<p class="bizcard-title">{title}</p>
{/if}
<BizcardScanner onRegister={handleRegister} />

{#if pendingNewCustomer}
	<Form title="顧客・担当者登録" fields={newContactFields} onsubmit={handleSubmitNew} />
{/if}

{#if pendingExistingCustomer}
	<Form title="担当者登録" fields={existingContactFields} onsubmit={handleSubmitExisting} />
{/if}

<style>
	.bizcard-title {
		font-size: 0.875rem;
		font-weight: 600;
		color: var(--color-text-muted);
		margin: 0 0 10px;
	}
</style>
