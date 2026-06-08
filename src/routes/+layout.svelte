<script lang="ts">
	import '$lib/styles/app.scss';
	import favicon from '$lib/assets/favicon.svg';
	import * as m from '$lib/paraglide/messages.js';

	type Theme = 'light' | 'dark' | 'system';

	let { children } = $props();

	let theme = $state<Theme>(
		(typeof localStorage !== 'undefined'
			? (localStorage.getItem('theme') as Theme)
			: null) ?? 'system'
	);

	$effect(() => {
		const root = document.documentElement;
		if (theme === 'system') {
			root.removeAttribute('data-theme');
		} else {
			root.setAttribute('data-theme', theme);
		}
		localStorage.setItem('theme', theme);
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
				<span class="logo">Midleton</span>
				<a href="/" class="new-chat-btn" title={m.new_chat()}>
					<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
						<path d="M12 5v14M5 12h14" />
					</svg>
				</a>
			</div>

			<a href="/" class="new-chat-row">
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
				<div class="theme-switcher">
					<button class:active={theme === 'light'} onclick={() => (theme = 'light')} title={m.theme_light()}>
						<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
							<circle cx="12" cy="12" r="4"/>
							<path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41"/>
						</svg>
						<span>{m.theme_light()}</span>
					</button>
					<button class:active={theme === 'system'} onclick={() => (theme = 'system')} title={m.theme_auto()}>
						<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
							<rect x="2" y="3" width="20" height="14" rx="2"/>
							<path d="M8 21h8M12 17v4"/>
						</svg>
						<span>{m.theme_auto()}</span>
					</button>
					<button class:active={theme === 'dark'} onclick={() => (theme = 'dark')} title={m.theme_dark()}>
						<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
							<path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
						</svg>
						<span>{m.theme_dark()}</span>
					</button>
				</div>

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
		color: var(--sidebar-text);
		padding: 0 4px;
		letter-spacing: -0.01em;
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

	.theme-switcher {
		display: flex;
		border-radius: 8px;
		overflow: hidden;
		background: var(--sidebar-hover);
		padding: 2px;
		gap: 2px;
	}

	.theme-switcher button {
		flex: 1;
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 4px;
		padding: 5px 4px;
		border: none;
		border-radius: 6px;
		background: transparent;
		color: var(--sidebar-text-muted);
		font-size: 0.75rem;
		cursor: pointer;
		transition: background 0.15s, color 0.15s;
	}

	.theme-switcher button.active {
		background: var(--sidebar-active);
		color: var(--sidebar-text);
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

	/* ── Main ── */
	.content {
		overflow: hidden;
		display: flex;
		flex-direction: column;
	}
</style>
