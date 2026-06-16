<script lang="ts">
	import type { TableColumn } from '$lib/types/chat';
	import * as m from '$lib/paraglide/messages.js';

	type Props = {
		columns: TableColumn[];
		rows: Record<string, unknown>[];
	};

	let { columns, rows }: Props = $props();
</script>

<div class="table-wrapper">
	<table>
		<thead>
			<tr>
				{#each columns as col}
					<th>{col.label}</th>
				{/each}
			</tr>
		</thead>
		<tbody>
			{#if rows.length === 0}
				<tr>
					<td colspan={columns.length} class="empty">{m.table_empty()}</td>
				</tr>
			{:else}
				{#each rows as row}
					<tr>
						{#each columns as col}
							<td>{row[col.key] ?? '—'}</td>
						{/each}
					</tr>
				{/each}
			{/if}
		</tbody>
	</table>
	<p class="count">{m.table_count({ count: rows.length })}</p>
</div>

<style lang="scss">
	.table-wrapper {
		overflow-x: auto;
	}

	table {
		width: 100%;
		border-collapse: collapse;
		font-size: 0.9375rem;
	}

	th {
		text-align: left;
		padding: 8px 12px;
		background: var(--color-surface);
		border-bottom: 2px solid var(--color-border);
		font-weight: 600;
		white-space: nowrap;
	}

	td {
		padding: 8px 12px;
		border-bottom: 1px solid var(--color-border);
	}

	tr:hover td {
		background: var(--color-surface);
	}

	.empty {
		text-align: center;
		color: var(--color-text-muted);
		padding: 24px;
	}

	.count {
		font-size: 0.8125rem;
		color: var(--color-text-muted);
		margin: 8px 0 0;
		text-align: right;
	}
</style>
