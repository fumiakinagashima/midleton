<script lang="ts">
	import '$lib/styles/app.scss';
	import favicon from '$lib/assets/favicon.svg';
	import * as m from '$lib/paraglide/messages.js';
	import Toast from '$lib/components/ui/Toast.svelte';
	import NotificationDrawer from '$lib/components/ui/NotificationDrawer.svelte';
	import { themeStore } from '$lib/stores/theme.svelte';
	import { notificationCenter } from '$lib/stores/notifications.svelte';
	import { chatSession } from '$lib/stores/chat-session.svelte';
	import { untrack } from 'svelte';

	let { data, children } = $props();

	notificationCenter.unreadCount = untrack(() => data.unreadNotificationCount);

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

	const historyGroups = [
		{
			label: m.history_today(),
			items: [{ id: '1', title: '顧客情報を登録したい' }]
		}
	];
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
</svelte:head>

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
					<a href="/?id={item.id}" class="history-item">{item.title}</a>
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

			<a href="/database/accounts" class="settings-row">
				<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
					<path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
					<circle cx="9" cy="7" r="4"/>
					<path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
					<path d="M16 3.13a4 4 0 0 1 0 7.75"/>
				</svg>
				アカウント
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
		</div>
	</aside>

	<main class="content">
		{@render children()}
	</main>
</div>

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

	.history-item {
		display: block;
		padding: 7px 10px;
		border-radius: 8px;
		font-size: 0.875rem;
		color: var(--sidebar-text);
		text-decoration: none;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
		transition: background 0.15s;
	}

	.history-item:hover { background: var(--sidebar-hover); }

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

	/* ── Main ── */
	.content {
		overflow: hidden;
		display: flex;
		flex-direction: column;
	}
</style>
