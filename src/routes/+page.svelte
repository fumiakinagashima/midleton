<script lang="ts">
	import Table from '$lib/components/chat/Table.svelte';
	import ActionSelector from '$lib/components/chat/ActionSelector.svelte';
	import Values from '$lib/components/chat/Values.svelte';
	import Gantt from '$lib/components/chat/Gantt.svelte';
	import Timeline from '$lib/components/chat/Timeline.svelte';
	import Kanban from '$lib/components/chat/Kanban.svelte';
	import Link from '$lib/components/chat/Link.svelte';
	import Bizcard from '$lib/components/chat/Bizcard.svelte';
	import DocumentJob from '$lib/components/chat/DocumentJob.svelte';
	import DocHandoff from '$lib/components/chat/DocHandoff.svelte';
	import FormButton from '$lib/components/chat/FormButton.svelte';
	import Reply from '$lib/components/chat/Reply.svelte';
	import FormDialog from '$lib/components/dialog/FormDialog.svelte';
	import RecordDialog from '$lib/components/dialog/RecordDialog.svelte';
	import TypingIndicator from '$lib/components/ui/TypingIndicator.svelte';
	import type { MessageContent, ValuesContent, GanttContent, TimelineContent, ChartContent, KanbanContent, LinkContent, BizcardContent, DocumentJobContent, DocHandoffContent, ReplyContent } from '$lib/types/chat';
	import * as m from '$lib/paraglide/messages.js';
	import Plus from '$lib/components/icon/Plus.svelte';
	import ArrowUp from '$lib/components/icon/ArrowUp.svelte';
	import { createChatState, renderMarkdown } from './index.svelte';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();
	const s = createChatState(() => data);
</script>

<div class="chat" bind:this={s.chatEl}>
	<!-- Greeting: visible only before first message -->
	<div class="greeting" class:hidden={s.hasStarted} aria-hidden={s.hasStarted}>
		<h1>MIDLETON</h1>
		<p>Tell it what you need done</p>
	</div>

	<!-- Messages list -->
	<div class="messages" class:visible={s.hasStarted} bind:this={s.listEl}>
		<div class="messages-inner">
			{#each s.messages as msg (msg.id)}
				<div class="message {msg.role}" class:wide={s.isMessageWide(msg)}>
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
									<FormButton form={content} onclick={() => s.handleFormButtonClick(content)} />
								{:else if content.type === 'table'}
									<Table
										columns={content.columns}
										rows={content.rows}
										onRowClick={content.entity ? (row) => s.openRecordDetail(content.entity!, String(row.id)) : undefined}
										expanded={s.isMessageWide(msg)}
										onToggleExpand={() => s.toggleMessageWidth(msg.id)}
									/>
								{:else if content.type === 'actions'}
									<ActionSelector
										title={content.title}
										actions={content.actions}
										onselect={s.handleActionSelect}
									/>
								{:else}
									{@const extra = content as ValuesContent | GanttContent | TimelineContent | ChartContent | KanbanContent | LinkContent | BizcardContent | DocumentJobContent | DocHandoffContent | ReplyContent}
									{#if extra.type === 'values'}
										<Values title={extra.title} items={extra.items} />
									{:else if extra.type === 'gantt'}
										<Gantt
											title={extra.title}
											filter={extra.filter}
											expanded={s.isMessageWide(msg)}
											onToggleExpand={() => s.toggleMessageWidth(msg.id)}
											onDealClick={(id: string) => s.openRecordDetail('deals', id)}
										/>
									{:else if extra.type === 'timeline'}
										<Timeline title={extra.title} filter={extra.filter} />
									<!-- chart display temporarily disabled -->
									<!-- {:else if extra.type === 'chart'}
										<Chart chartType={extra.chartType} title={extra.title} data={extra.data} /> -->
									{:else if extra.type === 'kanban'}
										{#if !extra.completed}
											<Kanban
												title={extra.title}
												columns={extra.columns}
												cards={extra.cards}
												onchange={s.isDealStatusKanban(extra) ? s.handleDealKanbanChange : undefined}
											/>
										{/if}
									{:else if extra.type === 'link'}
										<Link label={extra.label} href={extra.href} description={extra.description} newTab={extra.newTab} />
									{:else if extra.type === 'bizcard'}
										{#if !extra.completed}
											<Bizcard title={extra.title} onComplete={() => s.handleBizcardComplete(msg, extra)} />
										{/if}
									{:else if extra.type === 'document_job'}
										<DocumentJob jobId={extra.jobId} label={extra.label} onResolved={(result) => s.resolveDocumentJob(msg, extra.jobId, result)} />
									{:else if extra.type === 'doc_handoff'}
										<DocHandoff label={extra.label} downloadUrl={extra.downloadUrl} filename={extra.filename} prompt={extra.prompt} />
									{:else if extra.type === 'reply'}
										{#if !extra.completed}
											<Reply
												title={extra.title}
												fields={extra.fields}
												submitLabel={extra.submitLabel}
												onsubmit={(answer) => s.handleReplySubmit(msg, extra, answer)}
											/>
										{/if}
									{/if}
								{/if}
							{/each}
						</div>
					{/if}
				</div>
			{/each}

			{#if s.loading}
				<div class="message assistant">
					<div class="assistant-message">
						<TypingIndicator />
					</div>
				</div>
			{/if}
		</div>
	</div>

	<!-- Floating input card -->
	<div class="input-wrap" bind:this={s.inputWrapEl} style:opacity={s.inputReady ? 1 : 0}>
		<div class="input-card">
			<textarea
				bind:this={s.textareaEl}
				bind:value={s.input}
				oninput={s.autoGrow}
				onkeydown={s.handleKey}
				placeholder={s.enterToSend ? m.chat_placeholder_enter() : m.chat_placeholder_noenter()}
				rows="1"
				disabled={s.loading}
			></textarea>
			<div class="input-footer">
				<div class="input-footer-left">
					<div class="quick-action-wrap">
						<button
							class="icon-btn"
							onclick={(e) => {
								e.stopPropagation();
								s.quickActionMenuOpen = !s.quickActionMenuOpen;
							}}
							disabled={s.loading}
							aria-label="Quick actions"
							aria-expanded={s.quickActionMenuOpen}
						>
							<Plus size={16} />
						</button>
						{#if s.quickActionMenuOpen}
							<div class="quick-action-menu">
								{#if s.quickActions.length === 0}
									<p class="menu-empty">
										No quick actions configured. Add some from <a href="/settings/quick-actions">Settings</a>.
									</p>
								{:else}
									{#each s.quickActions as action}
										<button class="menu-item" onclick={() => s.runQuickAction(action)}>
											<span class="menu-icon">{action.icon}</span>
											<span class="menu-text">
												<span class="menu-label">{action.label}</span>
												<span class="menu-desc">{action.description}</span>
											</span>
										</button>
									{/each}
								{/if}
							</div>
						{/if}
					</div>
				</div>
				<button
					class="send-btn"
					onclick={s.handleSubmit}
					disabled={s.loading || !s.input.trim()}
					aria-label="Send"
				>
					<ArrowUp size={16} />
				</button>
			</div>
		</div>
	</div>

	{#if s.panelForm}
		<FormDialog
			form={s.panelForm}
			onsubmit={s.handlePanelSubmit}
			oncancel={s.handlePanelCancel}
		/>
	{/if}
	{#if s.panelRecord}
		<RecordDialog
			type={s.panelRecord.type}
			recordId={s.panelRecord.recordId}
			initialView={s.panelRecord.view}
			prefill={s.panelRecord.prefill}
			onclose={s.closePanelRecord}
			onSaved={s.closePanelRecord}
			onDeleted={(id) => s.handleRecordDeleted(id)}
		/>
	{/if}
</div>

<style lang="scss">
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
		width: 100%;
		padding: 0 24px 200px;
		display: flex;
		flex-direction: column;
		gap: 28px;
	}

	.message {
		width: 100%;
		max-width: var(--chat-width);
		margin: 0 auto;
		display: flex;
		flex-direction: column;
	}

	/* Messages containing a table or Gantt chart don't fit the centered --chat-width
	   column; they use the full width of messages-inner (for readability with many
	   columns or long date ranges) */
	.message.wide {
		max-width: none;
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
		/* Before the chat starts, initial centering is done via CSS (no JS needed —
		   correct position already at SSR). After it starts, JS (repositionInput)
		   sets top(px)/translateX(-50%) to slide it down to the bottom. */
		top: 50%;
		transform: translate(-50%, -50%);
		width: min(var(--chat-width), calc(100% - 48px));
		z-index: 10;
		pointer-events: none; /* pass scroll events through to messages behind it */
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
		max-height: 192px; /* matches CHAT_TEXTAREA_MAX_HEIGHT_PX */
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

	.quick-action-wrap {
		position: relative;
	}

	.icon-btn {
		width: 32px;
		height: 32px;
		border-radius: 50%;
		background: transparent;
		color: var(--color-text-muted);
		border: 1px solid var(--color-border);
		cursor: pointer;
		display: flex;
		align-items: center;
		justify-content: center;
		flex-shrink: 0;
		transition:
			color 0.15s ease,
			border-color 0.15s ease,
			transform 0.15s ease;
	}

	.icon-btn:disabled {
		opacity: 0.25;
		cursor: not-allowed;
	}

	.icon-btn:not(:disabled):hover {
		color: var(--color-primary);
		border-color: var(--color-primary);
	}

	.icon-btn[aria-expanded='true'] {
		color: var(--color-primary);
		border-color: var(--color-primary);
		transform: rotate(45deg);
	}

	.quick-action-menu {
		position: absolute;
		bottom: calc(100% + 8px);
		left: 0;
		min-width: 240px;
		max-width: 300px;
		background: var(--color-surface);
		border: 1px solid var(--color-border);
		border-radius: 12px;
		box-shadow:
			0 8px 24px rgba(0, 0, 0, 0.08),
			0 1px 4px rgba(0, 0, 0, 0.04);
		padding: 6px;
		display: flex;
		flex-direction: column;
		gap: 2px;
		animation: menuFadeIn 0.15s ease-out;
	}

	@keyframes menuFadeIn {
		from {
			opacity: 0;
			transform: translateY(4px);
		}
		to {
			opacity: 1;
			transform: translateY(0);
		}
	}

	.menu-item {
		display: flex;
		align-items: center;
		gap: 10px;
		width: 100%;
		padding: 8px 10px;
		border: none;
		border-radius: 8px;
		background: transparent;
		color: var(--color-text);
		font-size: 0.8125rem;
		text-align: left;
		cursor: pointer;
		transition: background 0.1s ease;
	}

	.menu-item:hover {
		background: var(--color-background);
	}

	.menu-icon {
		flex-shrink: 0;
		width: 22px;
		font-size: 1.05rem;
		text-align: center;
	}

	.menu-text {
		display: flex;
		flex-direction: column;
		gap: 1px;
		min-width: 0;
	}

	.menu-label {
		font-size: 0.875rem;
		font-weight: 500;
	}

	.menu-desc {
		font-size: 0.75rem;
		color: var(--color-text-muted);
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.menu-empty {
		padding: 10px 12px;
		font-size: 0.8125rem;
		color: var(--color-text-muted);
		line-height: 1.6;
	}

	.menu-empty a {
		color: var(--color-primary);
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
