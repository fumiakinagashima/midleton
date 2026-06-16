<script lang="ts">
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();
	const tables = $derived(data.tables);

	const ICONS: Record<string, string> = {
		building: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M3 21h18M4 21V7l8-4 8 4v14M9 21v-5h6v5M9 9h1M14 9h1M9 13h1M14 13h1"/></svg>`,
		user: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="12" cy="8" r="4"/><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"/></svg>`,
		briefcase: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2M12 12v4M10 14h4"/></svg>`,
		clipboard: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2"/><rect x="9" y="3" width="6" height="4" rx="1"/><path d="M9 12h6M9 16h4"/></svg>`,
		table: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M3 15h18M9 3v18M15 3v18"/></svg>`
	};
</script>

<div class="page">
	<header class="page-header">
		<h1>データ管理</h1>
	</header>

	<section>
		<h2 class="section-title">コアテーブル</h2>
		<div class="grid">
			{#each tables.filter(t => t.isCore) as table}
				<a href="/database/{table.id}" class="card">
					<span class="card-icon">{@html ICONS[table.icon] ?? ICONS.table}</span>
					<span class="card-label">{table.label}</span>
					<span class="card-count">{table.count} 件</span>
				</a>
			{/each}
		</div>
	</section>

	<section>
		<div class="section-header">
			<h2 class="section-title">カスタムテーブル</h2>
			<a href="/database/new-table" class="btn-new">+ 新規テーブル作成</a>
		</div>
		{#if tables.filter(t => !t.isCore).length === 0}
			<div class="empty-custom">
				<p>カスタムテーブルはまだありません。</p>
				<a href="/database/new-table" class="btn-new">最初のテーブルを作成</a>
			</div>
		{:else}
			<div class="grid">
				{#each tables.filter(t => !t.isCore) as table}
					<a href="/database/{table.id}" class="card">
						<span class="card-icon">{@html ICONS[table.icon] ?? ICONS.table}</span>
						<span class="card-label">{table.label}</span>
						<span class="card-count">{table.count} 件</span>
					</a>
				{/each}
			</div>
		{/if}
	</section>
</div>

<style lang="scss">
	.page {
		padding: 32px;
	}

	.page-header {
		margin-bottom: 32px;
	}

	h1 {
		font-size: 1.375rem;
		font-weight: 700;
		margin: 0;
	}

	section {
		margin-bottom: 32px;
	}

	.section-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		margin-bottom: 12px;
	}

	.section-title {
		font-size: 0.8125rem;
		font-weight: 600;
		color: var(--color-text-muted);
		text-transform: uppercase;
		letter-spacing: 0.05em;
		margin: 0 0 12px;
	}

	.grid {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
		gap: 12px;
	}

	.card {
		display: flex;
		flex-direction: column;
		gap: 8px;
		padding: 20px 16px;
		background: var(--color-surface);
		border: 1px solid var(--color-border);
		border-radius: 10px;
		text-decoration: none;
		color: var(--color-text);
		transition: border-color 0.15s, box-shadow 0.15s;
		cursor: pointer;
	}

	.card:hover {
		border-color: var(--color-primary);
		box-shadow: 0 0 0 3px color-mix(in srgb, var(--color-primary) 12%, transparent);
	}

	.card-icon {
		width: 28px;
		height: 28px;
		color: var(--color-primary);
	}

	.card-icon :global(svg) {
		width: 100%;
		height: 100%;
	}

	.card-label {
		font-size: 0.9375rem;
		font-weight: 600;
	}

	.card-count {
		font-size: 0.8125rem;
		color: var(--color-text-muted);
	}

	.section-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		margin-bottom: 12px;
	}

	.section-header .section-title { margin: 0; }

	.btn-new {
		padding: 6px 12px;
		background: var(--color-primary);
		color: #fff;
		border: none;
		border-radius: 6px;
		font-size: 0.8125rem;
		text-decoration: none;
		cursor: pointer;
		white-space: nowrap;
	}

	.btn-new:hover { opacity: 0.88; }

	.empty-custom {
		display: flex;
		flex-direction: column;
		align-items: flex-start;
		gap: 10px;
	}

	.empty-custom p { font-size: 0.875rem; color: var(--color-text-muted); margin: 0; }
</style>
