<script lang="ts">
	import Form from './Form.svelte';
	import CustomerDetail from './CustomerDetail.svelte';
	import DialogChatSide from './DialogChatSide.svelte';
	import X from '$lib/components/icon/X.svelte';
	import ChevronLeft from '$lib/components/icon/ChevronLeft.svelte';
	import { toast } from '$lib/stores/toast.svelte';
	import type {
		FormContent,
		FormField,
		CustomerDetailCustomer,
		CustomerDetailContact,
		CustomerDetailDeal,
		CustomerDetailActivity
	} from '$lib/types/chat';

	type Props = {
		customerId: string;
		onclose: () => void;
		onDeleted: (id: string) => void;
	};

	let { customerId, onclose, onDeleted }: Props = $props();

	type Detail = {
		customer: CustomerDetailCustomer;
		contacts: CustomerDetailContact[];
		deals: CustomerDetailDeal[];
		activities: CustomerDetailActivity[];
	};

	type View = { kind: 'detail' } | { kind: 'form'; form: FormContent };

	let viewStack = $state<View[]>([{ kind: 'detail' }]);
	let currentView = $derived(viewStack[viewStack.length - 1]);

	let detail = $state<Detail | null>(null);
	let detailLoading = $state(true);

	let formFields = $state<FormField[]>([]);
	let formTitle = $state('');
	let formLoading = $state(false);
	let formRef = $state<HTMLFormElement | null>(null);
	let formKey = $state(0);

	async function loadDetail() {
		detailLoading = true;
		try {
			const res = await fetch(`/api/customers/${customerId}/detail`);
			if (!res.ok) {
				detail = null;
				return;
			}
			detail = (await res.json()) as Detail;
		} catch {
			detail = null;
		} finally {
			detailLoading = false;
		}
	}

	$effect(() => {
		void customerId;
		viewStack = [{ kind: 'detail' }];
		loadDetail();
	});

	$effect(() => {
		const view = currentView;
		if (view.kind !== 'form') return;
		const form = view.form;
		const prefill: Record<string, string> = {};
		for (const f of form.fields) {
			if (f.value != null && f.value !== '') prefill[f.key] = f.value;
		}

		let cancelled = false;
		formLoading = true;
		fetch(`/api/forms/${form.tool}`)
			.then((res) => (res.ok ? (res.json() as Promise<{ title?: string; fields: FormField[] }>) : null))
			.then((data) => {
				if (cancelled) return;
				if (data?.fields) {
					formFields = data.fields.map((f) => ({ ...f, value: prefill[f.key] ?? f.value }));
					formTitle = data.title ?? form.title ?? '入力';
				} else {
					formFields = form.fields;
					formTitle = form.title ?? '入力';
				}
				formKey += 1;
			})
			.catch(() => {
				if (!cancelled) {
					formFields = form.fields;
					formKey += 1;
				}
			})
			.finally(() => {
				if (!cancelled) formLoading = false;
			});

		return () => {
			cancelled = true;
		};
	});

	function pushForm(form: FormContent) {
		viewStack = [...viewStack, { kind: 'form', form }];
	}

	function goBack() {
		viewStack = viewStack.slice(0, -1);
	}

	async function submitForm(tool: string, data: Record<string, string>) {
		try {
			const res = await fetch('/api/chat', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ tool, data })
			});
			if (!res.ok) {
				toast.error('保存に失敗しました');
				return;
			}
			goBack();
			await loadDetail();
		} catch {
			toast.error('保存に失敗しました');
		}
	}

	async function handleDelete() {
		if (!confirm('この顧客を削除しますか？関連する担当者・案件・活動履歴は削除されません。')) return;
		try {
			const res = await fetch(`/api/database/customers/records/${customerId}`, { method: 'DELETE' });
			if (!res.ok) {
				toast.error('削除に失敗しました');
				return;
			}
			onDeleted(customerId);
		} catch {
			toast.error('削除に失敗しました');
		}
	}

	const dialogTitle = $derived(
		currentView.kind === 'form' ? (currentView.form.title ?? '入力') : (detail?.customer.name ?? '顧客詳細')
	);
	const chatContextFields = $derived(
		currentView.kind === 'form' ? formFields.map((f) => ({ key: f.key, label: f.label })) : []
	);
</script>

<div class="overlay" role="presentation"></div>
<div class="dialog" role="dialog" aria-modal="true" aria-label={dialogTitle}>
	<div class="dialog-header">
		{#if viewStack.length > 1}
			<button class="back-btn" onclick={goBack} aria-label="戻る">
				<ChevronLeft size={16} />
			</button>
		{/if}
		<span class="dialog-title">{dialogTitle}</span>
		<button class="close-btn" onclick={onclose} aria-label="閉じる">
			<X size={16} />
		</button>
	</div>

	<div class="dialog-body">
		<DialogChatSide contextTitle={dialogTitle} contextFields={chatContextFields} />

		<div class="content-side">
			{#if currentView.kind === 'detail'}
				{#if detailLoading}
					<div class="loading-wrap"><span class="spinner"></span></div>
				{:else if !detail}
					<p class="error-text">顧客情報を取得できませんでした。</p>
				{:else}
					<CustomerDetail
						customer={detail.customer}
						contacts={detail.contacts}
						deals={detail.deals}
						activities={detail.activities}
						onOpenForm={pushForm}
						onDelete={handleDelete}
					/>
				{/if}
			{:else if formLoading}
				<div class="loading-wrap"><span class="spinner"></span></div>
			{:else}
				{#key formKey}
					<Form
						fields={formFields}
						bind:formRef
						onsubmit={(data) => submitForm(currentView.form.tool, data)}
						oncancel={goBack}
					/>
				{/key}
			{/if}
		</div>
	</div>
</div>

<style lang="scss">
	.overlay {
		position: fixed;
		inset: 0;
		background: rgba(0, 0, 0, 0.45);
		z-index: 200;
		animation: fade-in 0.2s ease;
	}

	.dialog {
		position: fixed;
		top: 50%;
		left: 50%;
		transform: translate(-50%, -50%);
		z-index: 201;
		width: min(1280px, 97vw);
		height: min(840px, 97vh);
		background: var(--color-background);
		border: 1px solid var(--color-border);
		border-radius: 16px;
		box-shadow: 0 24px 64px rgba(0, 0, 0, 0.18);
		display: flex;
		flex-direction: column;
		overflow: hidden;
		animation: dialog-in 0.22s cubic-bezier(0.4, 0, 0.2, 1);
	}

	.dialog-header {
		display: flex;
		align-items: center;
		gap: 8px;
		padding: 16px 20px;
		border-bottom: 1px solid var(--color-border);
		flex-shrink: 0;
	}

	.dialog-title {
		flex: 1;
		min-width: 0;
		font-size: 0.9375rem;
		font-weight: 600;
		color: var(--color-text);
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.back-btn,
	.close-btn {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 28px;
		height: 28px;
		border: none;
		border-radius: 6px;
		background: transparent;
		color: var(--color-text-muted);
		cursor: pointer;
		flex-shrink: 0;
		transition: background 0.15s, color 0.15s;

		&:hover {
			background: color-mix(in srgb, var(--color-text) 8%, transparent);
			color: var(--color-text);
		}
	}

	.dialog-body {
		flex: 1;
		min-height: 0;
		display: flex;
		overflow: hidden;
	}

	.content-side {
		flex: 1;
		min-width: 0;
		overflow-y: auto;
		padding: 24px 20px;
		border-left: 1px solid var(--color-border);
	}

	.loading-wrap {
		display: flex;
		justify-content: center;
		padding: 48px 0;
	}

	.spinner {
		width: 22px;
		height: 22px;
		border: 2px solid var(--color-border);
		border-top-color: var(--color-primary);
		border-radius: 50%;
		animation: spin 0.6s linear infinite;
	}

	.error-text {
		color: var(--color-text-muted);
		font-size: 0.875rem;
		text-align: center;
		padding: 32px 0;
	}

	@keyframes fade-in {
		from { opacity: 0; }
		to { opacity: 1; }
	}

	@keyframes dialog-in {
		from { opacity: 0; transform: translate(-50%, calc(-50% + 12px)); }
		to { opacity: 1; transform: translate(-50%, -50%); }
	}

	@keyframes spin {
		to { transform: rotate(360deg); }
	}
</style>
