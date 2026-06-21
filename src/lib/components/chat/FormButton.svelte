<script lang="ts">
	import type { FormContent } from '$lib/types/chat';

	type Props = {
		form: FormContent;
		onclick: () => void;
	};

	let { form, onclick }: Props = $props();

	const TOOL_LABELS: Record<string, string> = {
		create_customer: '顧客を登録',
		update_customer: '顧客を編集',
		create_contact: '担当者を登録',
		update_contact: '担当者を編集',
		create_deal: '案件を登録',
		update_deal: '案件を編集',
		create_activity: '活動履歴を登録',
		create_customer_with_contact: '顧客・担当者を登録',
		create_reminder: 'リマインダーを設定',
		send_email: 'メールを送信'
	};

	const label = $derived(form.title ?? TOOL_LABELS[form.tool] ?? '登録・編集フォームを開く');
</script>

<button class="form-btn" {onclick}>
	{label}
</button>

<style lang="scss">
	.form-btn {
		display: inline-flex;
		align-items: center;
		gap: 6px;
		padding: 8px 16px;
		background: var(--color-primary);
		color: #fff;
		border: none;
		border-radius: 6px;
		font-size: 0.875rem;
		font-weight: 500;
		cursor: pointer;
		transition: opacity 0.15s;
		width: fit-content;

		&:hover {
			opacity: 0.85;
		}

		&::before {
			content: '+';
			font-size: 1rem;
			line-height: 1;
		}
	}
</style>
