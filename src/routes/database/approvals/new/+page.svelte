<script lang="ts">
	type RouteEntry = { step: number; approver: string; email: string; role: string };

	let title = $state('');
	let type = $state('');
	let submittedBy = $state('');
	let entityType = $state('');
	let entityId = $state('');
	let dataText = $state('{}');

	let routeEntries = $state<RouteEntry[]>([
		{ step: 1, approver: '', email: '', role: '' }
	]);

	let saving = $state(false);
	let error = $state('');

	function addStep() {
		const maxStep = Math.max(...routeEntries.map(r => r.step), 0);
		routeEntries = [...routeEntries, { step: maxStep + 1, approver: '', email: '', role: '' }];
	}

	function removeStep(i: number) {
		routeEntries = routeEntries.filter((_, idx) => idx !== i);
	}

	async function submit() {
		if (!title.trim() || !type.trim() || !submittedBy.trim()) {
			error = 'タイトル・種別・申請者は必須です。';
			return;
		}
		if (routeEntries.some(r => !r.approver.trim())) {
			error = '承認者名をすべて入力してください。';
			return;
		}

		let data: Record<string, unknown> = {};
		try { data = JSON.parse(dataText || '{}'); } catch {
			error = '申請内容のJSONが不正です。';
			return;
		}

		saving = true;
		error = '';
		try {
			const res = await fetch('/api/approvals', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					title: title.trim(),
					type: type.trim(),
					submittedBy: submittedBy.trim(),
					entityType: entityType.trim() || undefined,
					entityId: entityId.trim() || undefined,
					data,
					route: routeEntries.map(r => ({
						step: r.step,
						approver: r.approver.trim(),
						email: r.email.trim() || undefined,
						role: r.role.trim() || undefined
					}))
				})
			});
			if (!res.ok) {
				const e = await res.json() as { error: string };
				error = e.error;
				return;
			}
			const row = await res.json() as { id: string };
			location.href = `/database/approvals/${row.id}`;
		} finally {
			saving = false;
		}
	}
</script>

<div class="page">
	<header class="page-header">
		<div class="breadcrumb">
			<a href="/database">データ管理</a>
			<span class="sep">/</span>
			<a href="/database/approvals">申請管理</a>
			<span class="sep">/</span>
			<span>新規申請</span>
		</div>
	</header>

	<form class="form" onsubmit={(e) => { e.preventDefault(); submit(); }}>
		<!-- Basic info -->
		<section class="section">
			<h2 class="section-title">基本情報</h2>
			<div class="field-group">
				<div class="field">
					<label>タイトル <span class="req">*</span></label>
					<input type="text" bind:value={title} placeholder="例: 値引き申請（ABC社）" />
				</div>
				<div class="field">
					<label>種別 <span class="req">*</span></label>
					<input type="text" bind:value={type} placeholder="例: 値引き申請、契約承認、経費精算" />
				</div>
				<div class="field">
					<label>申請者 <span class="req">*</span></label>
					<input type="text" bind:value={submittedBy} placeholder="例: 田中太郎" />
				</div>
			</div>
		</section>

		<!-- Entity link (optional) -->
		<section class="section">
			<h2 class="section-title">関連エンティティ（任意）</h2>
			<div class="field-group two-col">
				<div class="field">
					<label>エンティティ種別</label>
					<input type="text" bind:value={entityType} placeholder="例: deals, customers" />
				</div>
				<div class="field">
					<label>エンティティID</label>
					<input type="text" bind:value={entityId} placeholder="UUID" />
				</div>
			</div>
		</section>

		<!-- Data -->
		<section class="section">
			<h2 class="section-title">申請内容（JSON）</h2>
			<textarea class="json-input" bind:value={dataText} rows="4" placeholder='{"金額": 50000, "理由": "競合対策値引き"}'></textarea>
		</section>

		<!-- Route -->
		<section class="section">
			<div class="section-header">
				<h2 class="section-title">承認ルート <span class="req">*</span></h2>
				<button type="button" class="btn-add-step" onclick={addStep}>+ ステップ追加</button>
			</div>
			<div class="route-list">
				{#each routeEntries as entry, i}
					<div class="route-entry">
						<div class="step-num-wrap">
							<label class="step-num-label">Step</label>
							<input
								type="number"
								class="step-num-input"
								bind:value={entry.step}
								min="1"
							/>
						</div>
						<div class="field">
							<label>承認者名 <span class="req">*</span></label>
							<input type="text" bind:value={entry.approver} placeholder="田中部長" />
						</div>
						<div class="field">
							<label>役職</label>
							<input type="text" bind:value={entry.role} placeholder="営業部長" />
						</div>
						<div class="field">
							<label>メール</label>
							<input type="email" bind:value={entry.email} placeholder="tanaka@example.com" />
						</div>
						{#if routeEntries.length > 1}
							<button type="button" class="btn-remove" onclick={() => removeStep(i)}>✕</button>
						{/if}
					</div>
				{/each}
			</div>
			<p class="hint">同じStep番号にすると並列承認になります。</p>
		</section>

		{#if error}
			<p class="error">{error}</p>
		{/if}

		<div class="form-actions">
			<a href="/database/approvals" class="btn-cancel">キャンセル</a>
			<button type="submit" class="btn-submit" disabled={saving}>
				{saving ? '作成中...' : '申請を作成'}
			</button>
		</div>
	</form>
</div>

<style>
	.page {
		padding: 24px 32px;
		height: 100%;
		overflow-y: auto;
		display: flex;
		flex-direction: column;
		gap: 20px;
		max-width: 760px;
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

	.form { display: flex; flex-direction: column; gap: 24px; }

	.section { display: flex; flex-direction: column; gap: 12px; }

	.section-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
	}

	.section-title {
		font-size: 0.875rem;
		font-weight: 600;
		color: var(--color-text-muted);
		text-transform: uppercase;
		letter-spacing: 0.05em;
		margin: 0;
	}

	.field-group { display: flex; flex-direction: column; gap: 12px; }
	.field-group.two-col { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }

	.field { display: flex; flex-direction: column; gap: 4px; }

	label {
		font-size: 0.8125rem;
		font-weight: 500;
		color: var(--color-text-muted);
	}

	.req { color: var(--color-danger, #dc2626); }

	input[type="text"], input[type="email"], input[type="number"] {
		padding: 8px 10px;
		border: 1px solid var(--color-border);
		border-radius: 6px;
		background: var(--color-background);
		color: var(--color-text);
		font-size: 0.9375rem;
		font-family: inherit;
	}
	input:focus { outline: none; border-color: var(--color-primary); }

	.json-input {
		padding: 10px 12px;
		border: 1px solid var(--color-border);
		border-radius: 6px;
		background: var(--color-background);
		color: var(--color-text);
		font-size: 0.875rem;
		font-family: ui-monospace, monospace;
		resize: vertical;
	}
	.json-input:focus { outline: none; border-color: var(--color-primary); }

	/* Route builder */
	.route-list { display: flex; flex-direction: column; gap: 10px; }

	.route-entry {
		display: flex;
		align-items: flex-end;
		gap: 10px;
		padding: 12px 14px;
		border: 1px solid var(--color-border);
		border-radius: 8px;
		background: var(--color-surface);
	}

	.step-num-wrap {
		display: flex;
		flex-direction: column;
		gap: 4px;
		flex-shrink: 0;
	}

	.step-num-label {
		font-size: 0.8125rem;
		font-weight: 500;
		color: var(--color-text-muted);
	}

	.step-num-input {
		width: 56px;
		padding: 8px 8px;
		border: 1px solid var(--color-border);
		border-radius: 6px;
		background: var(--color-background);
		color: var(--color-text);
		font-size: 0.9375rem;
		text-align: center;
		font-family: inherit;
	}
	.step-num-input:focus { outline: none; border-color: var(--color-primary); }

	.route-entry .field { flex: 1; }

	.btn-add-step {
		padding: 5px 12px;
		background: none;
		border: 1px solid var(--color-border);
		border-radius: 6px;
		color: var(--color-text-muted);
		font-size: 0.8125rem;
		cursor: pointer;
	}
	.btn-add-step:hover { border-color: var(--color-primary); color: var(--color-primary); }

	.btn-remove {
		padding: 6px 8px;
		background: none;
		border: none;
		color: var(--color-text-muted);
		cursor: pointer;
		font-size: 0.875rem;
		flex-shrink: 0;
		align-self: flex-end;
		margin-bottom: 2px;
	}
	.btn-remove:hover { color: var(--color-danger, #dc2626); }

	.hint { font-size: 0.8125rem; color: var(--color-text-muted); margin: 0; }

	.error {
		padding: 10px 14px;
		background: color-mix(in srgb, #dc2626 10%, transparent);
		border: 1px solid #dc2626;
		border-radius: 6px;
		color: #dc2626;
		font-size: 0.875rem;
	}

	.form-actions {
		display: flex;
		justify-content: flex-end;
		gap: 10px;
		padding-top: 4px;
	}

	.btn-cancel {
		padding: 8px 18px;
		background: none;
		border: 1px solid var(--color-border);
		border-radius: 6px;
		color: var(--color-text-muted);
		font-size: 0.9375rem;
		text-decoration: none;
		cursor: pointer;
	}
	.btn-cancel:hover { border-color: var(--color-text-muted); color: var(--color-text); }

	.btn-submit {
		padding: 8px 22px;
		background: var(--color-primary);
		color: #fff;
		border: none;
		border-radius: 6px;
		font-size: 0.9375rem;
		cursor: pointer;
	}
	.btn-submit:disabled { opacity: 0.4; cursor: not-allowed; }
</style>
