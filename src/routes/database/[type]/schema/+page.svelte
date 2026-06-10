<script lang="ts">
	import { page } from '$app/stores';
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import FieldEditor from '$lib/components/database/FieldEditor.svelte';
	import type { TableInfo, EditableField, CustomFieldType } from '$lib/server/db/table-service';

	const type = $derived($page.params.type);

	let info = $state<TableInfo | null>(null);
	let label = $state('');
	let fields = $state<EditableField[]>([]);
	let customFields = $state<EditableField[]>([]);
	let loading = $state(true);
	let submitting = $state(false);
	let deleting = $state(false);
	let error = $state('');

	const builtinFields = $derived(info?.fields.filter(f => !f.isCustom) ?? []);

	const FIELD_TYPE_LABELS: Record<string, string> = {
		text: 'テキスト', number: '数値', select: '選択', date: '日付',
		email: 'メール', tel: '電話番号', textarea: '長文テキスト'
	};

	onMount(async () => {
		const res = await fetch(`/api/database/${type}/records`);
		if (res.ok) {
			const data = await res.json() as { info: TableInfo };
			info = data.info;
			if (data.info.isCore) {
				customFields = data.info.fields
					.filter(f => f.isCustom)
					.map(f => ({
						_id: crypto.randomUUID(),
						key: f.key, label: f.label, type: f.type as CustomFieldType,
						required: f.required ?? false, options: f.options ?? []
					}));
			} else {
				label = data.info.label;
				fields = data.info.fields.map(f => ({
					_id: crypto.randomUUID(),
					key: f.key, label: f.label, type: f.type as CustomFieldType,
					required: f.required ?? false, options: f.options ?? []
				}));
			}
		}
		loading = false;
	});

	async function handleSubmit(e: Event) {
		e.preventDefault();
		const targetFields = info?.isCore ? customFields : fields;
		const invalidField = targetFields.find(f => !f.key.trim() || !f.label.trim());
		if (invalidField) { error = '全フィールドのキーと表示名を入力してください。'; return; }

		submitting = true;
		error = '';
		const body = info?.isCore ? { fields: customFields } : { label, fields };
		const res = await fetch(`/api/database/tables/${type}`, {
			method: 'PATCH',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify(body)
		});
		if (res.ok) {
			goto(`/database/${type}`);
		} else {
			const e2 = await res.json() as { error?: string };
			error = e2.error ?? '保存に失敗しました';
			submitting = false;
		}
	}

	async function handleDelete() {
		if (!confirm(`テーブル「${info?.label}」とその全データを削除しますか？この操作は元に戻せません。`)) return;
		deleting = true;
		await fetch(`/api/database/tables/${type}`, { method: 'DELETE' });
		goto('/database');
	}
</script>

<div class="page">
	<header class="page-header">
		<div class="breadcrumb">
			<a href="/database">データ管理</a>
			<span class="sep">/</span>
			<a href="/database/{type}">{info?.label ?? type}</a>
			<span class="sep">/</span>
			<span>スキーマ編集</span>
		</div>
	</header>

	{#if loading}
		<p class="status">読み込み中...</p>
	{:else if info?.isCore}
		<form class="form" onsubmit={handleSubmit}>
			<div class="form-section">
				<h2 class="section-title">組み込みフィールド（変更不可）</h2>
				<div class="builtin-list">
					{#each builtinFields as field}
						<div class="builtin-row">
							<span class="builtin-key">{field.key}</span>
							<span class="builtin-label">{field.label}</span>
							<span class="builtin-type">{FIELD_TYPE_LABELS[field.type] ?? field.type}</span>
							{#if field.required}<span class="builtin-req">必須</span>{/if}
						</div>
					{/each}
				</div>
			</div>

			<div class="form-section">
				<h2 class="section-title">カスタムフィールド</h2>
				<FieldEditor bind:fields={customFields} />
			</div>

			{#if error}
				<p class="error">{error}</p>
			{/if}

			<div class="form-footer">
				<a href="/database/{type}" class="btn-cancel">キャンセル</a>
				<button type="submit" class="btn-submit" disabled={submitting}>
					{submitting ? '保存中...' : '変更を保存'}
				</button>
			</div>
		</form>
	{:else if info}
		<form class="form" onsubmit={handleSubmit}>
			<div class="form-section">
				<h2 class="section-title">テーブル情報</h2>
				<div class="field">
					<label for="name-disp">テーブル名（変更不可）</label>
					<input id="name-disp" type="text" value={type} disabled />
				</div>
				<div class="field">
					<label for="label">表示名</label>
					<input id="label" type="text" bind:value={label} required />
				</div>
			</div>

			<div class="form-section">
				<h2 class="section-title">フィールド定義</h2>
				<FieldEditor bind:fields />
			</div>

			{#if error}
				<p class="error">{error}</p>
			{/if}

			<div class="form-footer">
				<a href="/database/{type}" class="btn-cancel">キャンセル</a>
				<button type="submit" class="btn-submit" disabled={submitting}>
					{submitting ? '保存中...' : '変更を保存'}
				</button>
				<span class="spacer"></span>
				<button type="button" class="btn-delete" onclick={handleDelete} disabled={deleting}>
					テーブルを削除
				</button>
			</div>
		</form>
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

	.form {
		display: flex;
		flex-direction: column;
		gap: 28px;
		max-width: 680px;
	}

	.form-section {
		display: flex;
		flex-direction: column;
		gap: 12px;
	}

	.section-title {
		font-size: 0.8125rem;
		font-weight: 600;
		color: var(--color-text-muted);
		text-transform: uppercase;
		letter-spacing: 0.05em;
		margin: 0;
	}

	.builtin-list {
		border: 1px solid var(--color-border);
		border-radius: 8px;
		overflow: hidden;
	}

	.builtin-row {
		display: flex;
		align-items: center;
		gap: 12px;
		padding: 9px 12px;
		border-bottom: 1px solid var(--color-border);
		background: var(--color-surface);
		font-size: 0.875rem;
	}

	.builtin-row:last-child { border-bottom: none; }

	.builtin-key {
		font-family: ui-monospace, monospace;
		font-size: 0.8125rem;
		color: var(--color-text-muted);
		min-width: 140px;
	}

	.builtin-label { flex: 1; font-weight: 500; }

	.builtin-type {
		font-size: 0.8125rem;
		color: var(--color-text-muted);
		min-width: 90px;
	}

	.builtin-req {
		font-size: 0.75rem;
		color: var(--color-danger, #dc2626);
		padding: 1px 6px;
		border: 1px solid currentColor;
		border-radius: 4px;
	}

	.field {
		display: flex;
		flex-direction: column;
		gap: 5px;
	}

	label { font-size: 0.875rem; font-weight: 500; }

	input[type="text"] {
		padding: 8px 12px;
		border: 1px solid var(--color-border);
		border-radius: 6px;
		background: var(--color-background);
		color: var(--color-text);
		font-size: 0.9375rem;
		outline: none;
		max-width: 400px;
	}

	input:focus { border-color: var(--color-primary); }
	input:disabled { opacity: 0.5; cursor: not-allowed; }

	.error {
		color: var(--color-danger, #dc2626);
		font-size: 0.875rem;
		padding: 10px 14px;
		background: color-mix(in srgb, var(--color-danger, #dc2626) 10%, transparent);
		border-radius: 6px;
	}

	.form-footer {
		display: flex;
		gap: 10px;
		align-items: center;
	}

	.spacer { flex: 1; }

	.btn-cancel {
		padding: 8px 20px;
		background: none;
		border: 1px solid var(--color-border);
		border-radius: 6px;
		font-size: 0.9375rem;
		color: var(--color-text);
		text-decoration: none;
	}

	.btn-submit {
		padding: 8px 24px;
		background: var(--color-primary);
		color: #fff;
		border: none;
		border-radius: 6px;
		font-size: 0.9375rem;
		cursor: pointer;
	}

	.btn-submit:disabled { opacity: 0.5; cursor: not-allowed; }
	.btn-submit:not(:disabled):hover { opacity: 0.88; }

	.btn-delete {
		padding: 8px 16px;
		background: none;
		color: var(--color-danger, #dc2626);
		border: 1px solid var(--color-danger, #dc2626);
		border-radius: 6px;
		font-size: 0.875rem;
		cursor: pointer;
	}

	.btn-delete:hover { background: color-mix(in srgb, var(--color-danger, #dc2626) 10%, transparent); }
	.btn-delete:disabled { opacity: 0.5; cursor: not-allowed; }

	.status { color: var(--color-text-muted); font-size: 0.875rem; }
</style>
