<script lang="ts">
	import Form from '$lib/components/ui/Form.svelte';
	import Table from '$lib/components/ui/Table.svelte';
	import type { Message, MessageContent } from '$lib/types/chat';

	let messages = $state<Message[]>([]);
	let input = $state('');
	let loading = $state(false);
	let listEl = $state<HTMLElement | null>(null);

	$effect(() => {
		if (listEl) listEl.scrollTop = listEl.scrollHeight;
	});

	function addUserMessage(text: string): Message {
		const msg: Message = {
			id: crypto.randomUUID(),
			role: 'user',
			contents: [{ type: 'text', text }],
			createdAt: new Date()
		};
		messages = [...messages, msg];
		return msg;
	}

	function addAssistantMessage(contents: MessageContent[]) {
		const msg: Message = {
			id: crypto.randomUUID(),
			role: 'assistant',
			contents,
			createdAt: new Date()
		};
		messages = [...messages, msg];
		return msg;
	}

	async function handleSubmit() {
		const text = input.trim();
		if (!text || loading) return;

		input = '';
		addUserMessage(text);
		loading = true;

		try {
			const res = await fetch('/api/chat', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ message: text, history: messages })
			});
			const data = await res.json();
			addAssistantMessage(data.contents);
		} catch {
			addAssistantMessage([{ type: 'text', text: 'エラーが発生しました。' }]);
		} finally {
			loading = false;
		}
	}

	async function handleFormSubmit(tool: string, data: Record<string, string>) {
		loading = true;
		try {
			const res = await fetch('/api/chat', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ tool, data, history: messages })
			});
			const result = await res.json();
			addAssistantMessage(result.contents);
		} catch {
			addAssistantMessage([{ type: 'text', text: 'エラーが発生しました。' }]);
		} finally {
			loading = false;
		}
	}

	function handleKey(e: KeyboardEvent) {
		if (e.key === 'Enter' && !e.shiftKey) {
			e.preventDefault();
			handleSubmit();
		}
	}
</script>

<div class="layout">
	<header>
		<span class="logo">Midleton</span>
	</header>

	<main bind:this={listEl}>
		{#if messages.length === 0}
			<p class="empty">何でも聞いてください。</p>
		{/if}

		{#each messages as msg}
			<div class="message {msg.role}">
				{#each msg.contents as content}
					{#if content.type === 'text'}
						<p class="bubble">{content.text}</p>
					{:else if content.type === 'form'}
						<Form
							title={content.title}
							fields={content.fields}
							onsubmit={(data) => handleFormSubmit(content.tool, data)}
						/>
					{:else if content.type === 'table'}
						<Table columns={content.columns} rows={content.rows} />
					{/if}
				{/each}
			</div>
		{/each}

		{#if loading}
			<div class="message assistant">
				<p class="bubble loading">入力中…</p>
			</div>
		{/if}
	</main>

	<footer>
		<textarea
			bind:value={input}
			onkeydown={handleKey}
			placeholder="メッセージを入力（Shift+Enter で改行）"
			rows="1"
			disabled={loading}
		></textarea>
		<button onclick={handleSubmit} disabled={loading || !input.trim()}>送信</button>
	</footer>
</div>

<style>
	.layout {
		display: grid;
		grid-template-rows: auto 1fr auto;
		height: 100vh;
		max-width: 800px;
		margin: 0 auto;
	}

	header {
		padding: 12px 16px;
		border-bottom: 1px solid var(--color-border);
		font-weight: 700;
		font-size: 1.125rem;
	}

	.logo {
		color: var(--color-primary);
	}

	main {
		overflow-y: auto;
		padding: 16px;
		display: flex;
		flex-direction: column;
		gap: 16px;
	}

	.empty {
		text-align: center;
		color: var(--color-text-muted);
		margin-top: 40px;
	}

	.message {
		display: flex;
		flex-direction: column;
		gap: 8px;
	}

	.message.user {
		align-items: flex-end;
	}

	.message.assistant {
		align-items: flex-start;
	}

	.bubble {
		padding: 10px 14px;
		border-radius: 12px;
		max-width: 72%;
		white-space: pre-wrap;
		line-height: 1.6;
	}

	.message.user .bubble {
		background: var(--color-primary);
		color: #fff;
		border-bottom-right-radius: 4px;
	}

	.message.assistant .bubble {
		background: var(--color-surface);
		border-bottom-left-radius: 4px;
	}

	.loading {
		color: var(--color-text-muted);
	}

	footer {
		display: flex;
		gap: 8px;
		padding: 12px 16px;
		border-top: 1px solid var(--color-border);
	}

	footer textarea {
		flex: 1;
		padding: 10px 12px;
		border: 1px solid var(--color-border);
		border-radius: 8px;
		background: var(--color-background);
		color: var(--color-text);
		font-size: 0.9375rem;
		resize: none;
		outline: none;
		font-family: inherit;
	}

	footer textarea:focus {
		border-color: var(--color-primary);
	}

	footer button {
		padding: 10px 20px;
		background: var(--color-primary);
		color: #fff;
		border: none;
		border-radius: 8px;
		font-size: 0.9375rem;
		cursor: pointer;
		white-space: nowrap;
	}

	footer button:disabled {
		opacity: 0.4;
		cursor: not-allowed;
	}
</style>
