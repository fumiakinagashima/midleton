<script lang="ts">
	import { onMount } from 'svelte';
	import type { FieldDef } from '$lib/server/db/table-service';

	type Props = {
		fields: FieldDef[];
		record: Record<string, unknown>;
		onEdit: () => void;
		onDelete: () => void;
	};

	let { fields, record, onEdit, onDelete }: Props = $props();

	// Resolve id→name labels for recordSelect fields from the referenced table (same approach as Form.svelte)
	let refLabels = $state<Record<string, Record<string, string>>>({});

	onMount(async () => {
		const refTables = [...new Set(fields.filter((f) => f.type === 'recordSelect' && f.refTable).map((f) => f.refTable!))];
		for (const refTable of refTables) {
			try {
				const res = await fetch(`/api/database/${refTable}/records`);
				if (!res.ok) continue;
				const data = (await res.json()) as { rows: Record<string, unknown>[] };
				const map: Record<string, string> = {};
				for (const r of data.rows) map[String(r.id)] = String(r.name ?? r.id);
				refLabels[refTable] = map;
			} catch {
				// ignore; fall back to raw id
			}
		}
	});

	function formatValue(val: unknown, fieldType: string): string {
		if (val == null || val === '') return '—';
		if (fieldType === 'number') return new Intl.NumberFormat('en-US').format(Number(val));
		if (fieldType === 'date') {
			const d = typeof val === 'number' ? new Date(val * 1000) : new Date(String(val));
			if (isNaN(d.getTime())) return String(val);
			return new Intl.DateTimeFormat('en-US', { year: 'numeric', month: 'long', day: 'numeric' }).format(d);
		}
		if (fieldType === 'datetime-local') {
			const d = typeof val === 'number' ? new Date(val * 1000) : new Date(String(val));
			if (isNaN(d.getTime())) return String(val);
			return new Intl.DateTimeFormat('en-US', {
				year: 'numeric', month: 'long', day: 'numeric',
				hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Tokyo'
			}).format(d);
		}
		return String(val);
	}

	function displayValue(field: FieldDef): string {
		const val = record[field.key] as unknown;
		if (field.type === 'recordSelect' && field.refTable) {
			const id = val == null ? '' : String(val);
			return refLabels[field.refTable]?.[id] ?? (id || '—');
		}
		if (field.type === 'select' && val != null && val !== '') {
			return field.options?.find((o) => o.value === String(val))?.label ?? String(val);
		}
		return formatValue(val, field.type);
	}

	function fmtTs(ts: unknown): string {
		if (ts == null) return '—';
		return new Intl.DateTimeFormat('en-US', {
			year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
		}).format(new Date(Number(ts) * 1000));
	}
</script>

<div class="record-detail">
	<div class="detail-header">
		<span class="detail-id mono">{record.id}</span>
		<div class="header-actions">
			<button class="action-btn" onclick={onEdit}>Edit</button>
			<button class="action-btn danger" onclick={onDelete}>Delete</button>
		</div>
	</div>

	<dl class="info-grid">
		{#each fields as field}
			<dt>{field.label}</dt>
			<dd class:notes={field.type === 'textarea'}>{displayValue(field)}</dd>
		{/each}
		{#if record.createdAt}
			<dt>Created At</dt><dd>{fmtTs(record.createdAt)}</dd>
		{/if}
		{#if record.updatedAt}
			<dt>Updated At</dt><dd>{fmtTs(record.updatedAt)}</dd>
		{/if}
	</dl>
</div>

<style lang="scss">
	.record-detail {
		display: flex;
		flex-direction: column;
		gap: 16px;
		width: 100%;
	}

	.detail-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 8px;
	}

	.detail-id {
		font-size: 0.75rem;
		color: var(--color-text-muted);
	}

	.mono {
		font-family: ui-monospace, monospace;
	}

	.header-actions {
		display: flex;
		align-items: center;
		gap: 8px;
	}

	.action-btn {
		padding: 4px 12px;
		border: 1px solid var(--color-border);
		border-radius: 6px;
		background: transparent;
		color: var(--color-text-muted);
		font-size: 0.8125rem;
		cursor: pointer;
		transition: border-color 0.15s, color 0.15s, background 0.15s;

		&:hover {
			border-color: var(--color-primary);
			color: var(--color-primary);
			background: color-mix(in srgb, var(--color-primary) 6%, transparent);
		}

		&.danger:hover {
			border-color: var(--color-error);
			color: var(--color-error);
			background: color-mix(in srgb, var(--color-error) 6%, transparent);
		}
	}

	.info-grid {
		display: grid;
		grid-template-columns: max-content 1fr;
		gap: 8px 16px;
		margin: 0;
		font-size: 0.875rem;
		background: var(--color-surface);
		border: 1px solid var(--color-border);
		border-radius: 10px;
		padding: 16px;

		dt {
			color: var(--color-text-muted);
			white-space: nowrap;
		}

		dd {
			margin: 0;
			color: var(--color-text);
			word-break: break-word;

			&.notes {
				white-space: pre-wrap;
			}
		}
	}
</style>
