<script lang="ts">
	import BizcardScanner from '$lib/components/bizcard/BizcardScanner.svelte';
	import Form from './Form.svelte';
	import type { BizcardResult } from '../../../routes/api/bizcard/+server';
	import type { FormField } from '$lib/types/chat';

	type Props = {
		title?: string;
		onSubmitForm: (tool: string, data: Record<string, string>) => void;
		onSendMessage: (text: string) => void;
	};

	let { title, onSubmitForm, onSendMessage }: Props = $props();

	let pendingResult = $state<BizcardResult | null>(null);

	const newContactFields = $derived<FormField[]>(
		pendingResult
			? [
					{ key: 'name', label: '会社名', type: 'text', required: true, value: pendingResult.company ?? pendingResult.name ?? '' },
					{ key: 'contact_name', label: '担当者氏名', type: 'text', required: true, value: pendingResult.name ?? '' },
					{ key: 'contact_name_kana', label: '担当者名（カナ）', type: 'text' },
					{ key: 'contact_role', label: '役職', type: 'text', value: pendingResult.title ?? '' },
					{ key: 'contact_department', label: '部署', type: 'text' },
					{ key: 'email', label: 'メールアドレス', type: 'email', value: pendingResult.email ?? '' },
					{ key: 'phone', label: '電話番号', type: 'tel', value: pendingResult.phone ?? '' },
					{ key: 'address', label: '住所', type: 'text', value: pendingResult.address ?? '' },
					{ key: 'website', label: 'ホームページ', type: 'text', value: pendingResult.website ?? '' }
				]
			: []
	);

	function handleRegister(result: BizcardResult, mode: 'both' | 'existing') {
		if (mode === 'both') {
			pendingResult = result;
			return;
		}

		const company = result.company ?? result.name ?? '';
		const lines = [`名刺の情報をもとに、既存の顧客「${company}」に担当者として登録してください。`];
		if (result.name) lines.push(`氏名: ${result.name}`);
		if (result.title) lines.push(`役職: ${result.title}`);
		if (result.email) lines.push(`メール: ${result.email}`);
		if (result.phone) lines.push(`電話番号: ${result.phone}`);
		onSendMessage(lines.join('\n'));
	}

	function handleSubmit(data: Record<string, string>) {
		onSubmitForm('create_customer_with_contact', data);
		pendingResult = null;
	}
</script>

{#if title}
	<p class="bizcard-title">{title}</p>
{/if}
<BizcardScanner onRegister={handleRegister} />

{#if pendingResult}
	<Form title="顧客・担当者登録" fields={newContactFields} onsubmit={handleSubmit} />
{/if}

<style>
	.bizcard-title {
		font-size: 0.875rem;
		font-weight: 600;
		color: var(--color-text-muted);
		margin: 0 0 10px;
	}
</style>
