<script lang="ts">
	import { tick } from 'svelte';
	import Form from './Form.svelte';
	import X from '$lib/components/icon/X.svelte';
	import ArrowUp from '$lib/components/icon/ArrowUp.svelte';
	import type { FormContent, FormField } from '$lib/types/chat';
	import { marked } from 'marked';
	import { filterXSS } from 'xss';

	type DialogMessage = { role: 'user' | 'assistant'; text: string };

	type Props = {
		form: FormContent;
		onsubmit: (tool: string, data: Record<string, string>) => void;
		oncancel: () => void;
	};

	let { form, onsubmit, oncancel }: Props = $props();

	// フォーム state
	let fields = $state<FormField[]>(form.fields);
	let formTitle = $state(form.title ?? '入力');
	let formLoading = $state(true);
	let formKey = $state(0);

	// チャット state
	let chatMessages = $state<DialogMessage[]>([]);
	let chatInput = $state('');
	let chatLoading = $state(false);
	let chatListEl = $state<HTMLElement | null>(null);

	// フォーム外部送信用
	let formRef = $state<HTMLFormElement | null>(null);
	let submitLabel = $derived(form.submitLabel ?? '登録');

	// サーバー定義フォームを取得し、AIプリフィル値を適用
	$effect(() => {
		const tool = form.tool;
		const prefill: Record<string, string> = {};
		for (const f of form.fields) {
			if (f.value != null && f.value !== '') prefill[f.key] = f.value;
		}

		let cancelled = false;
		formLoading = true;
		fetch(`/api/forms/${tool}`)
			.then((res) => (res.ok ? (res.json() as Promise<{ title?: string; fields: FormField[] }>) : null))
			.then((data) => {
				if (cancelled) return;
				if (data?.fields) {
					fields = data.fields.map((f) => ({ ...f, value: prefill[f.key] ?? f.value }));
					if (data.title) formTitle = data.title;
				} else {
					fields = form.fields;
					formTitle = form.title ?? '入力';
				}
				formKey += 1;
			})
			.catch(() => {
				if (!cancelled) {
					fields = form.fields;
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

	// 新規メッセージ追加時にチャットを下にスクロール
	$effect(() => {
		void chatMessages.length;
		tick().then(() => {
			if (chatListEl) chatListEl.scrollTop = chatListEl.scrollHeight;
		});
	});

	function renderMarkdown(text: string): string {
		return filterXSS(marked.parse(text, { async: false }) as string);
	}

	async function sendChat() {
		const text = chatInput.trim();
		if (!text || chatLoading) return;
		chatInput = '';
		chatMessages = [...chatMessages, { role: 'user', text }];
		chatLoading = true;

		let assistantText = '';
		chatMessages = [...chatMessages, { role: 'assistant', text: '' }];

		try {
			const res = await fetch('/api/form-chat', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					message: text,
					formTitle,
					formFields: fields.map((f) => ({ key: f.key, label: f.label })),
					history: chatMessages.slice(0, -2)
				})
			});

			if (!res.ok || !res.body) {
				chatMessages = [
					...chatMessages.slice(0, -1),
					{ role: 'assistant', text: 'エラーが発生しました。' }
				];
				return;
			}

			const reader = res.body.getReader();
			const decoder = new TextDecoder();
			let buf = '';

			while (true) {
				const { done, value } = await reader.read();
				if (done) break;
				buf += decoder.decode(value, { stream: true });
				const parts = buf.split('\n\n');
				buf = parts.pop() ?? '';
				for (const part of parts) {
					if (!part.startsWith('data: ')) continue;
					try {
						const event = JSON.parse(part.slice(6)) as { type: string; text?: string };
						if (event.type === 'delta' && event.text) {
							assistantText += event.text;
							chatMessages = [
								...chatMessages.slice(0, -1),
								{ role: 'assistant', text: assistantText }
							];
						}
					} catch {
						// ignore parse error
					}
				}
			}
		} finally {
			chatLoading = false;
		}
	}

	function handleChatKey(e: KeyboardEvent) {
		if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) {
			e.preventDefault();
			sendChat();
		}
	}
</script>

<!-- モーダルオーバーレイ（クリックしても閉じない） -->
<div class="overlay" role="presentation"></div>

<!-- ダイアログ本体 -->
<div class="dialog" role="dialog" aria-modal="true" aria-label={formTitle}>
	<div class="dialog-header">
		<span class="dialog-title">{formTitle}</span>
		<button class="close-btn" onclick={oncancel} aria-label="閉じる">
			<X size={16} />
		</button>
	</div>

	<div class="dialog-body">
		<!-- チャット側（左） -->
		<div class="chat-side">
			<div class="chat-header">AI アシスタント</div>
			<div class="chat-messages" bind:this={chatListEl}>
				{#if chatMessages.length === 0}
					<p class="chat-empty">フォームへの入力についてご質問があればどうぞ。</p>
				{/if}
				{#each chatMessages as msg}
					<div class="chat-msg {msg.role}">
						{#if msg.role === 'assistant'}
							{#if msg.text}
								<div class="msg-text">{@html renderMarkdown(msg.text)}</div>
							{:else}
								<div class="typing-dots"><span></span><span></span><span></span></div>
							{/if}
						{:else}
							<div class="msg-text">{msg.text}</div>
						{/if}
					</div>
				{/each}
			</div>
			<div class="chat-input-row">
				<textarea
					bind:value={chatInput}
					onkeydown={handleChatKey}
					placeholder="質問・相談をどうぞ..."
					rows="2"
					disabled={chatLoading}
				></textarea>
				<button
					class="chat-send"
					onclick={sendChat}
					disabled={chatLoading || !chatInput.trim()}
					aria-label="送信"
				>
					<ArrowUp size={14} />
				</button>
			</div>
		</div>

		<!-- フォーム側（右） -->
		<div class="form-side">
			{#if formLoading}
				<div class="form-loading"><span class="spinner"></span></div>
			{:else}
				{#key formKey}
					<Form
						{fields}
						hideActions
						bind:formRef
						onsubmit={(data) => onsubmit(form.tool, data)}
					/>
				{/key}
			{/if}
		</div>
	</div>

	<div class="dialog-footer">
		<button class="footer-cancel" onclick={oncancel}>キャンセル</button>
		<button class="footer-submit" onclick={() => formRef?.requestSubmit()}>{submitLabel}</button>
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
		width: min(900px, 95vw);
		height: min(680px, 90vh);
		background: var(--color-background);
		border: 1px solid var(--color-border);
		border-radius: 16px;
		box-shadow: 0 24px 64px rgba(0, 0, 0, 0.18);
		display: flex;
		flex-direction: column;
		overflow: hidden;
		animation: dialog-in 0.22s cubic-bezier(0.4, 0, 0.2, 1);
	}

	/* ---- ヘッダー ---- */
	.dialog-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 16px 20px;
		border-bottom: 1px solid var(--color-border);
		flex-shrink: 0;
	}

	.dialog-title {
		font-size: 0.9375rem;
		font-weight: 600;
		color: var(--color-text);
	}

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
		transition: background 0.15s, color 0.15s;

		&:hover {
			background: color-mix(in srgb, var(--color-text) 8%, transparent);
			color: var(--color-text);
		}
	}

	/* ---- ボディ（フォーム + チャット） ---- */
	.dialog-body {
		flex: 1;
		min-height: 0;
		display: flex;
		overflow: hidden;
	}

	/* フォーム側（右） */
	.form-side {
		flex: 1;
		min-width: 0;
		overflow-y: auto;
		padding: 24px 20px;
		border-left: 1px solid var(--color-border);
	}

	.form-loading {
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

	/* チャット側（左） */
	.chat-side {
		width: 300px;
		flex-shrink: 0;
		display: flex;
		flex-direction: column;
		overflow: hidden;

		@media (max-width: 640px) {
			display: none;
		}
	}

	.chat-header {
		padding: 10px 14px;
		font-size: 0.75rem;
		font-weight: 600;
		color: var(--color-text-muted);
		text-transform: uppercase;
		letter-spacing: 0.04em;
		border-bottom: 1px solid var(--color-border);
		flex-shrink: 0;
	}

	.chat-messages {
		flex: 1;
		min-height: 0;
		overflow-y: auto;
		padding: 12px 14px;
		display: flex;
		flex-direction: column;
		gap: 10px;
	}

	.chat-empty {
		font-size: 0.8125rem;
		color: var(--color-text-muted);
		margin: 0;
		line-height: 1.6;
	}

	.chat-msg {
		display: flex;
		flex-direction: column;

		&.user {
			align-items: flex-end;

			.msg-text {
				background: var(--color-surface);
				border: 1px solid var(--color-border);
				border-radius: 12px;
				border-bottom-right-radius: 3px;
				padding: 7px 12px;
				font-size: 0.8125rem;
				max-width: 90%;
				word-break: break-word;
				white-space: pre-wrap;
			}
		}

		&.assistant {
			align-items: flex-start;

			.msg-text {
				font-size: 0.8125rem;
				line-height: 1.65;
				color: var(--color-text);

				:global(p) {
					margin: 0 0 0.4em;
					&:last-child { margin-bottom: 0; }
				}
				:global(ul), :global(ol) {
					padding-left: 1.2em;
					margin: 0.2em 0;
				}
				:global(code) {
					font-size: 0.85em;
					background: var(--color-border);
					padding: 0.1em 0.3em;
					border-radius: 3px;
				}
			}
		}
	}

	.typing-dots {
		display: flex;
		gap: 4px;
		padding: 6px 0;

		span {
			width: 6px;
			height: 6px;
			border-radius: 50%;
			background: var(--color-text-muted);
			animation: bounce 1.2s infinite;

			&:nth-child(2) { animation-delay: 0.2s; }
			&:nth-child(3) { animation-delay: 0.4s; }
		}
	}

	.chat-input-row {
		display: flex;
		align-items: flex-end;
		gap: 6px;
		padding: 10px 14px;
		border-top: 1px solid var(--color-border);
		flex-shrink: 0;

		textarea {
			flex: 1;
			resize: none;
			border: 1px solid var(--color-border);
			border-radius: 10px;
			padding: 7px 10px;
			font-size: 0.8125rem;
			font-family: inherit;
			line-height: 1.5;
			background: var(--color-surface);
			color: var(--color-text);
			outline: none;
			transition: border-color 0.15s;
			max-height: 100px;
			overflow-y: auto;

			&:focus { border-color: var(--color-primary); }
			&::placeholder { color: var(--color-text-muted); }
			&:disabled { opacity: 0.5; }
		}
	}

	.chat-send {
		flex-shrink: 0;
		width: 30px;
		height: 30px;
		border-radius: 50%;
		border: none;
		background: var(--color-primary);
		color: #fff;
		display: flex;
		align-items: center;
		justify-content: center;
		cursor: pointer;
		transition: opacity 0.15s;
		margin-bottom: 1px;

		&:disabled { opacity: 0.35; cursor: not-allowed; }
		&:not(:disabled):hover { opacity: 0.85; }
	}

	/* ---- フッター ---- */
	.dialog-footer {
		display: flex;
		justify-content: flex-end;
		align-items: center;
		gap: 8px;
		padding: 12px 20px;
		border-top: 1px solid var(--color-border);
		flex-shrink: 0;
	}

	.footer-cancel {
		padding: 7px 18px;
		border: 1px solid var(--color-border);
		border-radius: 8px;
		background: transparent;
		color: var(--color-text-muted);
		font-size: 0.875rem;
		cursor: pointer;
		transition: border-color 0.15s, color 0.15s;

		&:hover {
			border-color: var(--color-text);
			color: var(--color-text);
		}
	}

	.footer-submit {
		padding: 7px 20px;
		border: none;
		border-radius: 8px;
		background: var(--color-primary);
		color: #fff;
		font-size: 0.875rem;
		cursor: pointer;
		transition: opacity 0.15s;

		&:hover { opacity: 0.88; }
		&:active { opacity: 0.75; }
	}

	/* ---- アニメーション ---- */
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

	@keyframes bounce {
		0%, 80%, 100% { transform: scale(0.8); opacity: 0.4; }
		40% { transform: scale(1); opacity: 1; }
	}
</style>
