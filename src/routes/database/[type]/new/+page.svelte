<script lang="ts">
	import { page } from '$app/stores';
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import RecordForm from '$lib/components/database/RecordForm.svelte';
	import type { TableInfo } from '$lib/server/db/table-service';

	const type = $derived($page.params.type);

	let info = $state<TableInfo | null>(null);
	let loading = $state(true);
	let submitting = $state(false);
	let error = $state('');

	const initialValues = $derived.by(() => {
		if (!info) return {};
		const params = $page.url.searchParams;
		const values: Record<string, string> = {};
		for (const field of info.fields) {
			const v = params.get(field.key);
			if (v !== null) values[field.key] = v;
		}
		return values;
	});

	onMount(async () => {
		const res = await fetch(`/api/database/${type}/records`);
		if (res.ok) {
			const data = await res.json() as { info: TableInfo };
			info = data.info;
		}
		loading = false;
	});

	async function handleSubmit(data: Record<string, string>) {
		submitting = true;
		error = '';
		const res = await fetch(`/api/database/${type}/records`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify(data)
		});
		if (res.ok) {
			const record = await res.json() as { id: string };
			goto(`/database/${type}/${record.id}`);
		} else {
			const e = await res.json() as { error?: string };
			error = e.error ?? '保存に失敗しました';
			submitting = false;
		}
	}
</script>

<div class="page">
	<header class="page-header">
		<div class="breadcrumb">
			<a href="/database">データ管理</a>
			<span class="sep">/</span>
			<a href="/database/{type}">{info?.label ?? type}</a>
			<span class="sep">/</span>
			<span>新規作成</span>
		</div>
	</header>

	{#if loading}
		<p class="status">読み込み中...</p>
	{:else if info}
		{#if error}
			<p class="error">{error}</p>
		{/if}
		<RecordForm fields={info.fields} {initialValues} onsubmit={handleSubmit} {submitting} />
	{/if}
</div>

<style>
	.page {
		padding: 24px 32px;
		height: 100%;
		overflow-y: auto;
		display: flex;
		flex-direction: column;
		gap: 24px;
	}

	.page-header { display: flex; align-items: center; }

	.breadcrumb {
		display: flex;
		align-items: center;
		gap: 8px;
		font-size: 0.9375rem;
	}

	.breadcrumb a { color: var(--color-primary); text-decoration: none; }
	.breadcrumb a:hover { text-decoration: underline; }
	.sep { color: var(--color-text-muted); }
	.breadcrumb span:last-child { font-weight: 600; }

	.status { color: var(--color-text-muted); font-size: 0.875rem; }

	.error {
		color: var(--color-danger, #dc2626);
		font-size: 0.875rem;
		padding: 10px 14px;
		background: color-mix(in srgb, var(--color-danger, #dc2626) 10%, transparent);
		border-radius: 6px;
		max-width: 560px;
	}
</style>
