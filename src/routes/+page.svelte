<script lang="ts">
	import Form from '$lib/components/chat/Form.svelte';
	import Table from '$lib/components/chat/Table.svelte';
	import ActionSelector from '$lib/components/chat/ActionSelector.svelte';
	import Values from '$lib/components/chat/Values.svelte';
	import TypingIndicator from '$lib/components/ui/TypingIndicator.svelte';
	import type { Message, MessageContent, ActionItem } from '$lib/types/chat';
	import * as m from '$lib/paraglide/messages.js';
	import { tick } from 'svelte';
	import { marked } from 'marked';

	function renderMarkdown(text: string): string {
		return marked.parse(text, { async: false }) as string;
	}

	const ls = (key: string, def: string) =>
		typeof localStorage !== 'undefined' ? (localStorage.getItem(key) ?? def) : def;

	let messages = $state<Message[]>([]);
	let input = $state('');
	let loading = $state(false);
	let listEl = $state<HTMLElement | null>(null);
	let enterToSend = $state(ls('enterToSend', 'true') !== 'false');

	$effect(() => {
		const handler = () => { enterToSend = (localStorage.getItem('enterToSend') ?? 'true') !== 'false'; };
		window.addEventListener('storage', handler);
		return () => window.removeEventListener('storage', handler);
	});

	function getAiSettings() {
		return {
			model: localStorage.getItem('aiModel') ?? undefined,
			apiKey: localStorage.getItem('apiKey') || undefined
		};
	}

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
				body: JSON.stringify({ message: text, history: messages, ...getAiSettings() })
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
		if (enterToSend && e.key === 'Enter' && !e.shiftKey && !e.isComposing) {
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
						<div class="bubble" class:user-bubble={msg.role === 'user'}>
							{#if msg.role === 'assistant'}
								{@html renderMarkdown(content.text)}
							{:else}
								{content.text}
							{/if}
						</div>
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
					{:else if content.type === 'values'}
						<Values title={content.title} items={content.items} />
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
			placeholder={enterToSend ? m.chat_placeholder_enter() : m.chat_placeholder_noenter()}
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
		line-height: 1.6;
		font-size: 0.9375rem;
	}

	.bubble.user-bubble {
		background: var(--color-primary);
		color: #fff;
		border-bottom-right-radius: 4px;
		white-space: pre-wrap;
	}

	.message.assistant .bubble {
		background: var(--color-surface);
		border-bottom-left-radius: 4px;
	}

	/* マークダウン要素のスタイル */
	.message.assistant .bubble :global(p) { margin: 0 0 0.5em; }
	.message.assistant .bubble :global(p:last-child) { margin-bottom: 0; }
	.message.assistant .bubble :global(h1),
	.message.assistant .bubble :global(h2),
	.message.assistant .bubble :global(h3) {
		font-weight: 600;
		margin: 0.75em 0 0.25em;
		line-height: 1.4;
	}
	.message.assistant .bubble :global(h1) { font-size: 1.1em; }
	.message.assistant .bubble :global(h2) { font-size: 1.05em; }
	.message.assistant .bubble :global(h3) { font-size: 1em; }
	.message.assistant .bubble :global(ul),
	.message.assistant .bubble :global(ol) {
		padding-left: 1.25em;
		margin: 0.25em 0;
	}
	.message.assistant .bubble :global(li) { margin: 0.1em 0; }
	.message.assistant .bubble :global(code) {
		font-family: ui-monospace, monospace;
		font-size: 0.875em;
		background: var(--color-border);
		padding: 0.1em 0.35em;
		border-radius: 3px;
	}
	.message.assistant .bubble :global(pre) {
		background: var(--color-background);
		border: 1px solid var(--color-border);
		border-radius: 6px;
		padding: 10px 12px;
		overflow-x: auto;
		margin: 0.5em 0;
	}
	.message.assistant .bubble :global(pre code) {
		background: none;
		padding: 0;
	}
	.message.assistant .bubble :global(strong) { font-weight: 600; }
	.message.assistant .bubble :global(table) {
		border-collapse: collapse;
		margin: 0.5em 0;
		font-size: 0.9em;
	}
	.message.assistant .bubble :global(th),
	.message.assistant .bubble :global(td) {
		border: 1px solid var(--color-border);
		padding: 4px 10px;
	}
	.message.assistant .bubble :global(th) {
		background: var(--color-border);
		font-weight: 600;
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
