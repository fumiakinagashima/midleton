<script lang="ts">
	import '$lib/styles/app.scss';
	import favicon from '$lib/assets/favicon.svg';
	import * as m from '$lib/paraglide/messages.js';
	import Toast from '$lib/components/ui/Toast.svelte';
	import NotificationDrawer from '$lib/components/ui/NotificationDrawer.svelte';
	import { themeStore } from '$lib/stores/theme.svelte';
	import { notificationCenter } from '$lib/stores/notifications.svelte';
	import { chatSession } from '$lib/stores/chat-session.svelte';
	import { chatHistory, type ChatSummary } from '$lib/stores/chat-history.svelte';
	import { page } from '$app/state';
	import { goto } from '$app/navigation';
	import { untrack } from 'svelte';

	let { data, children } = $props();

	notificationCenter.unreadCount = untrack(() => data.unreadNotificationCount);
	chatHistory.seed(untrack(() => data.chats));

	async function handleSignout() {
		if (!confirm(m.signout_confirm())) return;
		await fetch('/api/auth/signout', { method: 'POST' });
		window.location.href = '/signin';
	}

	let notificationDrawerOpen = $state(false);

	function toggleNotificationDrawer() {
		notificationDrawerOpen = !notificationDrawerOpen;
		if (notificationDrawerOpen) notificationCenter.loadItems();
	}

	function formatBadgeCount(count: number): string {
		return count > 99 ? '99+' : String(count);
	}

	// 未読件数バッジを最新化するための軽量ポーリング（TODO: docs/ROADMAP.md参照、セッション数増加時のコストを再検討）
	const NOTIFICATION_POLL_INTERVAL_MS = 15000;

	$effect(() => {
		const interval = setInterval(() => {
			notificationCenter.refreshUnreadCount();
		}, NOTIFICATION_POLL_INTERVAL_MS);
		return () => clearInterval(interval);
	});

	$effect(() => {
		const root = document.documentElement;
		if (themeStore.value === 'system') {
			root.removeAttribute('data-theme');
		} else {
			root.setAttribute('data-theme', themeStore.value);
		}
		localStorage.setItem('theme', themeStore.value);
	});

	const historyGroups = $derived.by(() => {
		const startOfToday = new Date();
		startOfToday.setHours(0, 0, 0, 0);
		const startOfYesterday = new Date(startOfToday);
		startOfYesterday.setDate(startOfYesterday.getDate() - 1);
		const startOfLast7Days = new Date(startOfToday);
		startOfLast7Days.setDate(startOfLast7Days.getDate() - 7);

		const groups = [
			{ label: m.history_today(), items: [] as typeof chatHistory.items },
			{ label: m.history_yesterday(), items: [] as typeof chatHistory.items },
			{ label: m.history_last_7_days(), items: [] as typeof chatHistory.items },
			{ label: m.history_older(), items: [] as typeof chatHistory.items }
		];

		for (const chat of chatHistory.items) {
			const updatedAt = new Date(chat.updatedAt);
			if (updatedAt >= startOfToday) groups[0].items.push(chat);
			else if (updatedAt >= startOfYesterday) groups[1].items.push(chat);
			else if (updatedAt >= startOfLast7Days) groups[2].items.push(chat);
			else groups[3].items.push(chat);
		}

		return groups.filter((g) => g.items.length > 0);
	});

	// チャット履歴の「...」メニュー（タイトル変更・削除）
	let openMenuId = $state<string | null>(null);
	let renamingId = $state<string | null>(null);
	let renameValue = $state('');

	function toggleHistoryMenu(id: string) {
		openMenuId = openMenuId === id ? null : id;
	}

	function startRename(item: ChatSummary) {
		renamingId = item.id;
		renameValue = item.title;
		openMenuId = null;
	}

	async function commitRename(id: string) {
		if (renamingId !== id) return;
		renamingId = null;
		const title = renameValue.trim();
		const current = chatHistory.items.find((c) => c.id === id);
		if (!title || !current || title === current.title) return;
		chatHistory.updateTitle(id, title);
		try {
			await fetch(`/api/chats/${id}`, {
				method: 'PATCH',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ title })
			});
		} catch {
			// 失敗時もUI上は変更後のタイトルを維持する（再読み込みで元に戻る）
		}
	}

	function handleRenameKeydown(e: KeyboardEvent) {
		if (e.key === 'Enter' && !e.isComposing) {
			e.preventDefault();
			(e.currentTarget as HTMLInputElement).blur();
		} else if (e.key === 'Escape') {
			renamingId = null;
		}
	}

	async function deleteChatItem(item: ChatSummary) {
		openMenuId = null;
		if (!confirm(m.history_delete_confirm())) return;
		chatHistory.remove(item.id);
		if (page.url.searchParams.get('id') === item.id) goto('/');
		try {
			await fetch(`/api/chats/${item.id}`, { method: 'DELETE' });
		} catch {
			// ローカル一覧からは削除済み。失敗時はリロードで復活する
		}
	}

	function focusOnMount(node: HTMLInputElement) {
		node.focus();
		node.select();
	}

	// メニュー外クリックで閉じる
	$effect(() => {
		if (!openMenuId) return;
		const close = () => (openMenuId = null);
		const id = setTimeout(() => document.addEventListener('click', close), 0);
		return () => {
			clearTimeout(id);
			document.removeEventListener('click', close);
		};
	});
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
</svelte:head>

{#if !data.account}
	<main class="content-full">
		{@render children()}
	</main>
{:else}
<div class="shell">
	<aside class="sidebar">
		<div class="sidebar-header">
			<span class="logo">MIDLETON</span>
			<!--<a href="/" class="new-chat-btn" title={m.new_chat()} onclick={() => chatSession.startNew()}>
				<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
					<path d="M12 5v14M5 12h14" />
				</svg>
			</a>-->
		</div>

		<a href="/" class="new-chat-row" onclick={() => chatSession.startNew()}>
			<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
				<path d="M12 5v14M5 12h14" />
			</svg>
			{m.new_chat()}
		</a>

		<nav class="history">
			{#each historyGroups as group}
				<p class="group-label">{group.label}</p>
				{#each group.items as item}
					<div class="history-item-row" class:active={page.url.searchParams.get('id') === item.id}>
						{#if renamingId === item.id}
							<input
								class="history-rename-input"
								bind:value={renameValue}
								onkeydown={handleRenameKeydown}
								onblur={() => commitRename(item.id)}
								use:focusOnMount
							/>
						{:else}
							<a href="/?id={item.id}" class="history-item">
								{item.title || m.new_chat()}
							</a>
						{/if}
						<div class="history-menu-wrap">
							<button
								class="history-menu-btn"
								aria-label={m.history_menu()}
								aria-expanded={openMenuId === item.id}
								onclick={(e) => {
									e.preventDefault();
									e.stopPropagation();
									toggleHistoryMenu(item.id);
								}}
							>
								<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
									<circle cx="12" cy="5" r="1.6" />
									<circle cx="12" cy="12" r="1.6" />
									<circle cx="12" cy="19" r="1.6" />
								</svg>
							</button>
							{#if openMenuId === item.id}
								<div class="history-menu">
									<button class="history-menu-item" onclick={() => startRename(item)}>
										{m.history_rename()}
									</button>
									<button class="history-menu-item danger" onclick={() => deleteChatItem(item)}>
										{m.history_delete()}
									</button>
								</div>
							{/if}
						</div>
					</div>
				{/each}
			{/each}
		</nav>

		<div class="sidebar-footer">
			<button class="settings-row notification-toggle" onclick={toggleNotificationDrawer}>
				<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
					<path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
					<path d="M13.73 21a2 2 0 0 1-3.46 0"/>
				</svg>
				{m.notifications()}
				{#if notificationCenter.unreadCount > 0}
					<span class="notification-badge">{formatBadgeCount(notificationCenter.unreadCount)}</span>
				{/if}
			</button>

			<a href="/database" class="settings-row">
				<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
					<ellipse cx="12" cy="5" rx="9" ry="3"/>
					<path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3"/>
					<path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"/>
				</svg>
				データ管理
			</a>

			<a href="/database/approvals" class="settings-row">
				<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
					<path d="M9 11l3 3L22 4"/>
					<path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/>
				</svg>
				申請管理
			</a>

			{#if data.account.permission === 'admin'}
				<a href="/database/accounts" class="settings-row">
					<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
						<path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
						<circle cx="9" cy="7" r="4"/>
						<path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
						<path d="M16 3.13a4 4 0 0 1 0 7.75"/>
					</svg>
					アカウント
				</a>
			{/if}

			<a href="/database/reminders" class="settings-row">
				<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
					<circle cx="12" cy="12" r="10"/>
					<polyline points="12 6 12 12 16 14"/>
				</svg>
				リマインダー
			</a>

			<a href="/bizcard" class="settings-row">
				<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
					<rect x="2" y="6" width="20" height="14" rx="2"/>
					<path d="M2 10h20"/>
					<circle cx="7" cy="8" r="0.5" fill="currentColor"/>
					<circle cx="9" cy="8" r="0.5" fill="currentColor"/>
				</svg>
				名刺取り込み
			</a>

			<a href="/ui" class="settings-row">
				<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
					<rect x="3" y="3" width="7" height="7" rx="1"/>
					<rect x="14" y="3" width="7" height="7" rx="1"/>
					<rect x="3" y="14" width="7" height="7" rx="1"/>
					<rect x="14" y="14" width="7" height="7" rx="1"/>
				</svg>
				{m.ui_components()}
			</a>

			<a href="/settings" class="settings-row">
				<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
					<circle cx="12" cy="12" r="3"/>
					<path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>
				</svg>
				{m.settings()}
			</a>

			<div class="account-row">
				<span class="account-name">{data.account.name}</span>
				<button class="signout-btn" onclick={handleSignout} title={m.signout()} aria-label={m.signout()}>
					<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
						<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
						<polyline points="16 17 21 12 16 7"/>
						<line x1="21" y1="12" x2="9" y2="12"/>
					</svg>
				</button>
			</div>
		</div>
	</aside>

	<main class="content">
		{@render children()}
	</main>
</div>
{/if}

<NotificationDrawer open={notificationDrawerOpen} onclose={() => (notificationDrawerOpen = false)} />

<Toast />

<style>
	.shell {
		display: grid;
		grid-template-columns: 240px 1fr;
		height: 100vh;
		overflow: hidden;
	}

	/* ── Sidebar ── */
	.sidebar {
		display: flex;
		flex-direction: column;
		background: var(--sidebar-bg);
		overflow: hidden;
	}

	.sidebar-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 14px 12px 10px;
	}

	.logo {
		font-size: 1rem;
		font-weight: 700;
		color: var(--color-primary);
		padding: 0 4px;
		letter-spacing: -0.01em;
		font-family: Georgia, 'Times New Roman', Times, serif;
	}

	.new-chat-btn {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 28px;
		height: 28px;
		border-radius: 6px;
		color: var(--sidebar-text);
		text-decoration: none;
		transition: background 0.15s;
	}

	.new-chat-btn:hover { background: var(--sidebar-hover); }

	.new-chat-row {
		display: flex;
		align-items: center;
		gap: 8px;
		margin: 0 8px 4px;
		padding: 8px 10px;
		border-radius: 8px;
		font-size: 0.875rem;
		color: var(--sidebar-text);
		text-decoration: none;
		transition: background 0.15s;
	}

	.new-chat-row:hover { background: var(--sidebar-hover); }

	.history {
		flex: 1;
		overflow-y: auto;
		padding: 4px 8px;
		display: flex;
		flex-direction: column;
		gap: 2px;
	}

	.group-label {
		font-size: 0.75rem;
		color: var(--sidebar-text-muted);
		padding: 8px 10px 4px;
		font-weight: 500;
	}

	.history-item-row {
		position: relative;
		display: flex;
		align-items: center;
		border-radius: 8px;
		transition: background 0.15s;
	}

	.history-item-row:hover,
	.history-item-row.active {
		background: var(--sidebar-hover);
	}

	.history-item-row.active .history-item {
		color: var(--color-text);
	}

	.history-item {
		flex: 1;
		min-width: 0;
		display: block;
		padding: 7px 10px;
		border-radius: 8px;
		font-size: 0.875rem;
		color: var(--sidebar-text);
		text-decoration: none;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.history-rename-input {
		flex: 1;
		min-width: 0;
		padding: 6px 9px;
		margin: 1px 0;
		border: 1px solid var(--color-primary);
		border-radius: 8px;
		background: var(--color-surface);
		color: var(--color-text);
		font-size: 0.875rem;
		font-family: inherit;
		outline: none;
	}

	.history-menu-wrap {
		position: relative;
		flex-shrink: 0;
	}

	.history-menu-btn {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 26px;
		height: 26px;
		margin-right: 4px;
		border: none;
		border-radius: 6px;
		background: transparent;
		color: var(--sidebar-text-muted);
		cursor: pointer;
		transition: background 0.1s ease, color 0.1s ease;
	}

	.history-menu-btn:hover,
	.history-menu-btn[aria-expanded='true'] {
		background: var(--color-border);
		color: var(--sidebar-text);
	}

	.history-menu {
		position: absolute;
		top: calc(100% + 2px);
		right: 0;
		min-width: 140px;
		background: var(--color-surface);
		border: 1px solid var(--color-border);
		border-radius: 10px;
		box-shadow:
			0 8px 24px rgba(0, 0, 0, 0.08),
			0 1px 4px rgba(0, 0, 0, 0.04);
		padding: 4px;
		display: flex;
		flex-direction: column;
		gap: 1px;
		z-index: 20;
	}

	.history-menu-item {
		display: block;
		width: 100%;
		padding: 7px 10px;
		border: none;
		border-radius: 7px;
		background: transparent;
		color: var(--color-text);
		font-size: 0.8125rem;
		text-align: left;
		cursor: pointer;
		transition: background 0.1s ease;
	}

	.history-menu-item:hover {
		background: var(--color-background);
	}

	.history-menu-item.danger {
		color: var(--color-danger);
	}

	.sidebar-footer {
		padding: 8px;
		border-top: 1px solid var(--sidebar-border);
		display: flex;
		flex-direction: column;
		gap: 4px;
	}

	.settings-row {
		display: flex;
		align-items: center;
		gap: 8px;
		padding: 8px 10px;
		border-radius: 8px;
		font-size: 0.875rem;
		color: var(--sidebar-text-muted);
		text-decoration: none;
		transition: background 0.15s, color 0.15s;
	}

	.settings-row:hover {
		background: var(--sidebar-hover);
		color: var(--sidebar-text);
	}

	button.settings-row {
		width: 100%;
		border: none;
		background: transparent;
		font: inherit;
		text-align: left;
		cursor: pointer;
	}

	.notification-badge {
		margin-left: auto;
		min-width: 18px;
		padding: 1px 5px;
		border-radius: 999px;
		background: var(--color-primary);
		color: #fff;
		font-size: 0.6875rem;
		font-weight: 700;
		line-height: 1.4;
		text-align: center;
	}

	.account-row {
		display: flex;
		align-items: center;
		gap: 8px;
		padding: 8px 10px;
		margin-top: 4px;
		border-top: 1px solid var(--sidebar-border);
	}

	.account-name {
		flex: 1;
		min-width: 0;
		font-size: 0.8125rem;
		color: var(--sidebar-text-muted);
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.signout-btn {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 26px;
		height: 26px;
		flex-shrink: 0;
		border: none;
		border-radius: 6px;
		background: transparent;
		color: var(--sidebar-text-muted);
		cursor: pointer;
		transition: background 0.15s, color 0.15s;
	}

	.signout-btn:hover {
		background: var(--sidebar-hover);
		color: var(--sidebar-text);
	}

	/* ── Main ── */
	.content {
		overflow: hidden;
		display: flex;
		flex-direction: column;
	}

	.content-full {
		height: 100vh;
		overflow: auto;
		display: flex;
		flex-direction: column;
	}
</style>
