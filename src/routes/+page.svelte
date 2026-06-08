<script lang="ts">
	import Form from '$lib/components/chat/Form.svelte';
	import Table from '$lib/components/chat/Table.svelte';
	import ActionSelector from '$lib/components/chat/ActionSelector.svelte';
	import TypingIndicator from '$lib/components/ui/TypingIndicator.svelte';
	import type { Message, MessageContent, ActionItem } from '$lib/types/chat';
	import * as m from '$lib/paraglide/messages.js';
	import { tick } from 'svelte';

	let messages = $state<Message[]>([]);
	let input = $state('');
	let loading = $state(false);
	let listEl = $state<HTMLElement | null>(null);

	async function scrollToBottom(smooth = false) {
		await tick();
		if (!listEl) return;
		listEl.scrollTo({ top: listEl.scrollHeight, behavior: smooth ? 'smooth' : 'instant' });
	}

	function addUserMessage(text: string) {
		messages = [
			...messages,
			{
				id: crypto.randomUUID(),
				role: 'user',
				contents: [{ type: 'text', text }],
				createdAt: new Date()
			}
		];
		scrollToBottom(true);
	}

	function addAssistantMessage(contents: MessageContent[]) {
		messages = [
			...messages,
			{
				id: crypto.randomUUID(),
				role: 'assistant',
				contents,
				createdAt: new Date()
			}
		];
		scrollToBottom(true);
	}

	async function sendMessage(text: string) {
		addUserMessage(text);
		loading = true;
		await scrollToBottom(true);
		try {
			const res = await fetch('/api/chat', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ message: text, history: messages })
			});
			const data = await res.json() as { contents: MessageContent[] };
			addAssistantMessage(data.contents);
		} catch {
			addAssistantMessage([{ type: 'text', text: m.chat_error() }]);
		} finally {
			loading = false;
		}
	}

	async function handleSubmit() {
		const text = input.trim();
		if (!text || loading) return;
		input = '';
		await sendMessage(text);
	}

	async function handleActionSelect(action: ActionItem) {
		if (loading) return;
		await sendMessage(action.label);
	}

	async function handleFormSubmit(tool: string, data: Record<string, string>) {
		loading = true;
		await scrollToBottom(true);
		try {
			const res = await fetch('/api/chat', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ tool, data, history: messages })
			});
			const result = await res.json() as { contents: MessageContent[] };
			addAssistantMessage(result.contents);
		} catch {
			addAssistantMessage([{ type: 'text', text: m.chat_error() }]);
		} finally {
			loading = false;
		}
	}

	function handleKey(e: KeyboardEvent) {
		if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) {
			e.preventDefault();
			handleSubmit();
		}
	}
</script>

<div class="chat">
	<div class="messages" bind:this={listEl}>
		{#if messages.length === 0}
			<p class="empty">{m.chat_empty()}</p>
		{/if}

		{#each messages as msg (msg.id)}
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
					{:else if content.type === 'actions'}
						<ActionSelector
							title={content.title}
							actions={content.actions}
							onselect={handleActionSelect}
						/>
					{/if}
				{/each}
			</div>
		{/each}

		{#if loading}
			<div class="message assistant">
				<TypingIndicator />
			</div>
		{/if}
	</div>

	<footer>
		<textarea
			bind:value={input}
			onkeydown={handleKey}
			placeholder={m.chat_placeholder()}
			rows="2"
			disabled={loading}
		></textarea>
		<button onclick={handleSubmit} disabled={loading || !input.trim()}>{m.chat_submit()}</button>
	</footer>
</div>

<style>
	.chat {
		display: flex;
		flex-direction: column;
		height: 100%;
		overflow: hidden;
	}

	.messages {
		flex: 1;
		overflow-y: auto;
		padding: 24px 32px;
		display: flex;
		flex-direction: column;
		gap: 16px;
		scroll-behavior: smooth;
	}

	.empty {
		text-align: center;
		color: var(--color-text-muted);
		margin-top: 80px;
		font-size: 0.9375rem;
	}

	.message {
		display: flex;
		flex-direction: column;
		gap: 8px;
		animation: slideUp 0.22s ease-out both;
	}

	@keyframes slideUp {
		from {
			opacity: 0;
			transform: translateY(10px);
		}
		to {
			opacity: 1;
			transform: translateY(0);
		}
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
		max-width: 68%;
		white-space: pre-wrap;
		line-height: 1.6;
		font-size: 0.9375rem;
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

	footer {
		display: flex;
		gap: 8px;
		padding: 12px 32px 20px;
		border-top: 1px solid var(--color-border);
	}

	footer textarea {
		flex: 1;
		padding: 10px 14px;
		border: 1px solid var(--color-border);
		border-radius: 8px;
		background: var(--color-background);
		color: var(--color-text);
		font-size: 0.9375rem;
		resize: none;
		outline: none;
		font-family: inherit;
		line-height: 1.5;
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
		align-self: flex-end;
	}

	footer button:disabled {
		opacity: 0.4;
		cursor: not-allowed;
	}
</style>
