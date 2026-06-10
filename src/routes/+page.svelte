<script lang="ts">
	import Form from '$lib/components/chat/Form.svelte';
	import Table from '$lib/components/chat/Table.svelte';
	import ActionSelector from '$lib/components/chat/ActionSelector.svelte';
	import Values from '$lib/components/chat/Values.svelte';
	import Gantt from '$lib/components/chat/Gantt.svelte';
	import Chart from '$lib/components/chat/Chart.svelte';
	import Kanban from '$lib/components/chat/Kanban.svelte';
	import Link from '$lib/components/chat/Link.svelte';
	import Bizcard from '$lib/components/chat/Bizcard.svelte';
	import TypingIndicator from '$lib/components/ui/TypingIndicator.svelte';
	import type { Message, MessageContent, ActionItem, ValuesContent, GanttContent, ChartContent, KanbanContent, LinkContent, BizcardContent } from '$lib/types/chat';
	import type { StreamEvent } from '$lib/server/ai/stream';
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
	let chatEl = $state<HTMLElement | null>(null);
	let inputWrapEl = $state<HTMLElement | null>(null);
	let textareaEl = $state<HTMLTextAreaElement | null>(null);
	let enterToSend = $state(ls('enterToSend', 'true') !== 'false');
	let hasStarted = $state(false);

	let streamingText = $state('');
	let streamingUIContents = $state<MessageContent[]>([]);

	$effect(() => {
		const handler = () => {
			enterToSend = (localStorage.getItem('enterToSend') ?? 'true') !== 'false';
		};
		window.addEventListener('storage', handler);
		return () => window.removeEventListener('storage', handler);
	});

	// Input position management
	function repositionInput(animate: boolean) {
		if (!chatEl || !inputWrapEl) return;
		const containerH = chatEl.offsetHeight;
		const inputH = inputWrapEl.offsetHeight;
		inputWrapEl.style.transition = animate
			? 'top 0.5s cubic-bezier(0.4, 0, 0.2, 1), opacity 0.3s ease'
			: 'top 0s, opacity 0.3s ease';
		if (!hasStarted) {
			inputWrapEl.style.top = `${(containerH - inputH) / 2}px`;
		} else {
			inputWrapEl.style.top = `${containerH - inputH - 24}px`;
		}
		// show after first positioning to prevent top-0 flash on mount
		inputWrapEl.style.opacity = '1';
	}

	let isFirstEffect = true;
	$effect(() => {
		void hasStarted;
		const animate = !isFirstEffect;
		isFirstEffect = false;
		requestAnimationFrame(() => repositionInput(animate));
	});

	$effect(() => {
		function handleResize() {
			requestAnimationFrame(() => repositionInput(false));
		}
		window.addEventListener('resize', handleResize);
		return () => window.removeEventListener('resize', handleResize);
	});

	function autoGrow() {
		if (!textareaEl) return;
		textareaEl.style.height = 'auto';
		const sh = textareaEl.scrollHeight;
		if (sh >= 192) {
			textareaEl.style.height = '192px';
			textareaEl.style.overflowY = 'auto';
		} else {
			textareaEl.style.height = sh + 'px';
			textareaEl.style.overflowY = 'hidden';
		}
		requestAnimationFrame(() => repositionInput(false));
	}

	async function scrollLatestToTop() {
		await tick();
		// wait for browser layout pass after DOM update
		await new Promise<void>((r) => requestAnimationFrame(() => r()));
		if (!listEl) return;
		const userMsgs = listEl.querySelectorAll('.message.user');
		const last = userMsgs[userMsgs.length - 1] as HTMLElement | undefined;
		if (!last) return;
		const containerTop = listEl.getBoundingClientRect().top;
		const msgTop = last.getBoundingClientRect().top;
		listEl.scrollTo({
			top: Math.max(0, listEl.scrollTop + msgTop - containerTop - 32),
			behavior: 'smooth'
		});
	}

	function addUserMessage(text: string) {
		messages = [
			...messages,
			{ id: crypto.randomUUID(), role: 'user', contents: [{ type: 'text', text }], createdAt: new Date() }
		];
	}

	function finalizeStreamingMessage() {
		const contents: MessageContent[] = [];
		if (streamingText.trim()) contents.push({ type: 'text', text: streamingText });
		contents.push(...streamingUIContents);
		if (contents.length === 0) contents.push({ type: 'text', text: m.chat_error() });
		messages = [
			...messages,
			{ id: crypto.randomUUID(), role: 'assistant', contents, createdAt: new Date() }
		];
		streamingText = '';
		streamingUIContents = [];
	}

	async function sendMessage(text: string) {
		addUserMessage(text);
		loading = true;
		streamingText = '';
		streamingUIContents = [];
		await scrollLatestToTop();
		repositionInput(false); // recalculate after textarea shrinks back to 1 row

		try {
			const res = await fetch('/api/chat', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ message: text, history: messages })
			});

			if (!res.ok || !res.body) {
				finalizeStreamingMessage();
				return;
			}

			const reader = res.body.getReader();
			const decoder = new TextDecoder();
			let buf = '';
			let finalized = false;

			const finalize = () => {
				if (finalized) return;
				finalized = true;
				finalizeStreamingMessage();
			};

			while (true) {
				const { done, value } = await reader.read();
				if (done) break;

				buf += decoder.decode(value, { stream: true });
				const parts = buf.split('\n\n');
				buf = parts.pop() ?? '';

				for (const part of parts) {
					const line = part.trim();
					if (!line.startsWith('data: ')) continue;
					try {
						const event = JSON.parse(line.slice(6)) as StreamEvent;
						if (event.type === 'delta') {
							streamingText += event.text;
						} else if (event.type === 'ui') {
							streamingUIContents = [...streamingUIContents, event.content];
						} else if (event.type === 'done') {
							finalize();
						} else if (event.type === 'error') {
							streamingText = m.chat_error();
							finalize();
						}
					} catch {
						// JSON parse error, skip
					}
				}
			}

			finalize();
		} catch {
			streamingText = '';
			messages = [
				...messages,
				{
					id: crypto.randomUUID(),
					role: 'assistant',
					contents: [{ type: 'text', text: m.chat_error() }],
					createdAt: new Date()
				}
			];
		} finally {
			loading = false;
		}
	}

	async function handleSubmit() {
		const text = input.trim();
		if (!text || loading) return;
		input = '';
		if (textareaEl) textareaEl.style.height = 'auto';
		if (!hasStarted) hasStarted = true;
		await sendMessage(text);
	}

	async function handleActionSelect(action: ActionItem) {
		if (loading) return;
		if (!hasStarted) hasStarted = true;
		await sendMessage(action.label);
	}

	async function handleFormSubmit(tool: string, data: Record<string, string>) {
		loading = true;
		try {
			const res = await fetch('/api/chat', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ tool, data, history: messages })
			});
			const result = (await res.json()) as { contents: MessageContent[] };
			messages = [
				...messages,
				{ id: crypto.randomUUID(), role: 'assistant', contents: result.contents, createdAt: new Date() }
			];
		} catch {
			messages = [
				...messages,
				{
					id: crypto.randomUUID(),
					role: 'assistant',
					contents: [{ type: 'text', text: m.chat_error() }],
					createdAt: new Date()
				}
			];
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

<div class="chat" bind:this={chatEl}>
	<!-- Greeting: visible only before first message -->
	<div class="greeting" class:hidden={hasStarted} aria-hidden={hasStarted}>
		<h1>MIDLETON</h1>
		<p>AIアシスタントに話しかけてください</p>
	</div>

	<!-- Messages list -->
	<div class="messages" class:visible={hasStarted} bind:this={listEl}>
		<div class="messages-inner">
			{#each messages as msg (msg.id)}
				<div class="message {msg.role}">
					{#if msg.role === 'user'}
						<div class="user-bubble">
							{#each msg.contents as content}
								{#if content.type === 'text'}{content.text}{/if}
							{/each}
						</div>
					{:else}
						<div class="assistant-message">
							{#each (msg.contents as MessageContent[]) as content}
								{#if content.type === 'text'}
									<div class="assistant-text">{@html renderMarkdown(content.text)}</div>
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
								{:else}
									{@const extra = content as ValuesContent | GanttContent | ChartContent | KanbanContent | LinkContent | BizcardContent}
									{#if extra.type === 'values'}
										<Values title={extra.title} items={extra.items} />
									{:else if extra.type === 'gantt'}
										<Gantt title={extra.title} filter={extra.filter} />
									{:else if extra.type === 'chart'}
										<Chart chartType={extra.chartType} title={extra.title} data={extra.data} />
									{:else if extra.type === 'kanban'}
										<Kanban title={extra.title} columns={extra.columns} cards={extra.cards} />
									{:else if extra.type === 'link'}
										<Link label={extra.label} href={extra.href} description={extra.description} />
									{:else if extra.type === 'bizcard'}
										<Bizcard title={extra.title} />
									{/if}
								{/if}
							{/each}
						</div>
					{/if}
				</div>
			{/each}

			{#if loading}
				<div class="message assistant">
					<div class="assistant-message">
						<TypingIndicator />
					</div>
				</div>
			{/if}
		</div>
	</div>

	<!-- Floating input card -->
	<div class="input-wrap" bind:this={inputWrapEl}>
		<div class="input-card">
			<textarea
				bind:this={textareaEl}
				bind:value={input}
				oninput={autoGrow}
				onkeydown={handleKey}
				placeholder={enterToSend ? m.chat_placeholder_enter() : m.chat_placeholder_noenter()}
				rows="1"
				disabled={loading}
			></textarea>
			<div class="input-footer">
				<div class="input-footer-left"></div>
				<button
					class="send-btn"
					onclick={handleSubmit}
					disabled={loading || !input.trim()}
					aria-label="送信"
				>
					<svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
						<path
							d="M8 13V3M8 3L3.5 7.5M8 3L12.5 7.5"
							stroke="currentColor"
							stroke-width="2"
							stroke-linecap="round"
							stroke-linejoin="round"
						/>
					</svg>
				</button>
			</div>
		</div>
	</div>
</div>

<style>
	.chat {
		position: relative;
		display: flex;
		flex-direction: column;
		height: 100%;
		overflow: hidden;
	}

	/* ---- Greeting ---- */
	.greeting {
		position: absolute;
		width: 100%;
		left: 0;
		bottom: calc(50% + 100px);
		text-align: center;
		pointer-events: none;
		z-index: 1;
		transition: opacity 0.3s ease;
	}

	.greeting.hidden {
		opacity: 0;
	}

	.greeting h1 {
		font-size: 2rem;
		font-weight: 700;
		color: var(--color-primary);
		margin: 0 0 10px;
		letter-spacing: -0.02em;
		font-family: Georgia, 'Times New Roman', Times, serif;
	}

	.greeting p {
		font-size: 1rem;
		color: var(--color-text-muted);
		margin: 0;
	}

	/* ---- Messages ---- */
	.messages {
		flex: 1;
		min-height: 0; /* flex child must shrink to enable overflow-y scroll */
		overflow-y: auto;
		padding: 48px 0 0;
		opacity: 0;
		pointer-events: none;
		transition: opacity 0.35s ease;
		scroll-behavior: smooth;
	}

	.messages.visible {
		opacity: 1;
		pointer-events: auto;
	}

	/* gradient curtain: fades messages into background before the input card */
	.chat::after {
		content: '';
		position: absolute;
		bottom: 0;
		left: 0;
		right: 0;
		height: 200px;
		background: linear-gradient(to bottom, transparent 0%, var(--color-background) 40%);
		pointer-events: none;
		z-index: 5; /* above messages, below input-wrap (z-index 10) */
	}

	.messages-inner {
		max-width: 720px;
		margin: 0 auto;
		padding: 0 24px 200px;
		display: flex;
		flex-direction: column;
		gap: 28px;
	}

	.message {
		display: flex;
		flex-direction: column;
	}

	/* User messages: quick slide-up */
	.message.user {
		align-items: flex-end;
		animation: fadeSlideUp 0.22s ease-out both;
	}

	@keyframes fadeSlideUp {
		from {
			opacity: 0;
			transform: translateY(8px);
		}
		to {
			opacity: 1;
			transform: translateY(0);
		}
	}

	/* Assistant messages: reveal top → bottom */
	.message.assistant {
		align-items: flex-start;
		animation: revealDown 0.55s cubic-bezier(0.25, 0.46, 0.45, 0.94) both;
	}

	@keyframes revealDown {
		from {
			clip-path: inset(0 0 100% 0);
			opacity: 0.5;
		}
		to {
			clip-path: inset(0 0 0% 0);
			opacity: 1;
		}
	}

	.user-bubble {
		background: var(--color-surface);
		border: 1px solid var(--color-border);
		border-radius: 18px;
		border-bottom-right-radius: 5px;
		padding: 10px 16px;
		max-width: 72%;
		font-size: 0.9375rem;
		line-height: 1.6;
		white-space: pre-wrap;
		word-break: break-word;
		color: var(--color-text);
	}



	.assistant-message {
		width: 100%;
		display: flex;
		flex-direction: column;
		gap: 14px;
	}

	.assistant-text {
		font-size: 0.9375rem;
		line-height: 1.75;
		color: var(--color-text);
	}

	/* Markdown inside assistant text */
	.assistant-text :global(p) {
		margin: 0 0 0.6em;
	}
	.assistant-text :global(p:last-child) {
		margin-bottom: 0;
	}
	.assistant-text :global(h1),
	.assistant-text :global(h2),
	.assistant-text :global(h3) {
		font-weight: 600;
		margin: 0.8em 0 0.3em;
		line-height: 1.4;
	}
	.assistant-text :global(h1) {
		font-size: 1.1em;
	}
	.assistant-text :global(h2) {
		font-size: 1.05em;
	}
	.assistant-text :global(h3) {
		font-size: 1em;
	}
	.assistant-text :global(ul),
	.assistant-text :global(ol) {
		padding-left: 1.5em;
		margin: 0.3em 0;
	}
	.assistant-text :global(li) {
		margin: 0.15em 0;
	}
	.assistant-text :global(code) {
		font-family: ui-monospace, monospace;
		font-size: 0.875em;
		background: var(--color-border);
		padding: 0.1em 0.35em;
		border-radius: 3px;
	}
	.assistant-text :global(pre) {
		background: var(--color-surface);
		border: 1px solid var(--color-border);
		border-radius: 8px;
		padding: 12px 16px;
		overflow-x: auto;
		margin: 0.5em 0;
	}
	.assistant-text :global(pre code) {
		background: none;
		padding: 0;
	}
	.assistant-text :global(strong) {
		font-weight: 600;
	}
	.assistant-text :global(blockquote) {
		border-left: 3px solid var(--color-border);
		margin: 0.5em 0;
		padding-left: 1em;
		color: var(--color-text-muted);
	}
	.assistant-text :global(table) {
		border-collapse: collapse;
		margin: 0.5em 0;
		font-size: 0.9em;
		width: 100%;
	}
	.assistant-text :global(th),
	.assistant-text :global(td) {
		border: 1px solid var(--color-border);
		padding: 6px 12px;
		text-align: left;
	}
	.assistant-text :global(th) {
		background: var(--color-surface);
		font-weight: 600;
	}
	.assistant-text :global(a) {
		color: var(--color-primary);
		text-decoration: underline;
	}

	/* ---- Floating input ---- */
	.input-wrap {
		position: absolute;
		left: 50%;
		transform: translateX(-50%);
		width: min(720px, calc(100% - 48px));
		z-index: 10;
		pointer-events: none; /* pass scroll events through to messages behind it */
		opacity: 0; /* hidden until JS positions it; set to 1 in repositionInput */
	}

	.input-card {
		pointer-events: auto; /* re-enable for the actual card */
		background: var(--color-surface);
		border: 1px solid var(--color-border);
		border-radius: 16px;
		box-shadow:
			0 4px 20px rgba(0, 0, 0, 0.06),
			0 1px 4px rgba(0, 0, 0, 0.04);
		padding: 14px 16px 12px;
		display: flex;
		flex-direction: column;
		gap: 10px;
	}

	.input-card textarea {
		width: 100%;
		border: none;
		outline: none;
		background: transparent;
		color: var(--color-text);
		font-size: 0.9375rem;
		font-family: inherit;
		line-height: 1.6;
		resize: none;
		overflow-y: hidden;
		min-height: 26px;
		max-height: 192px;
		padding: 0;
	}

	.input-card textarea::placeholder {
		color: var(--color-text-muted);
	}

	.input-footer {
		display: flex;
		align-items: center;
		justify-content: space-between;
	}

	.input-footer-left {
		display: flex;
		align-items: center;
		gap: 8px;
	}

	.send-btn {
		width: 32px;
		height: 32px;
		border-radius: 50%;
		background: var(--color-primary);
		color: #fff;
		border: none;
		cursor: pointer;
		display: flex;
		align-items: center;
		justify-content: center;
		flex-shrink: 0;
		transition:
			opacity 0.15s ease,
			transform 0.15s ease;
	}

	.send-btn:disabled {
		opacity: 0.25;
		cursor: not-allowed;
	}

	.send-btn:not(:disabled):hover {
		transform: scale(1.06);
	}

	.send-btn:not(:disabled):active {
		transform: scale(0.94);
	}
</style>
