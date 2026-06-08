<script lang="ts">
	import Toggle from '$lib/components/ui/Toggle.svelte';
	import Select from '$lib/components/ui/Select.svelte';
	import Textbox from '$lib/components/ui/Textbox.svelte';
	import * as m from '$lib/paraglide/messages.js';

	const ls = (key: string, def: string) =>
		typeof localStorage !== 'undefined' ? (localStorage.getItem(key) ?? def) : def;

	const MODEL_OPTIONS = [
		{ value: 'claude-haiku-4-5-20251001', label: 'Claude Haiku 4.5（速い・安い）' },
		{ value: 'claude-sonnet-4-6', label: 'Claude Sonnet 4.6（バランス）' },
		{ value: 'claude-opus-4-8', label: 'Claude Opus 4.8（高精度）' }
	];

	let enterToSend = $state(ls('enterToSend', 'true') !== 'false');
	let model = $state(ls('aiModel', 'claude-haiku-4-5-20251001'));
	let apiKey = $state(ls('apiKey', ''));
	let savedApiKey = $state(false);
	let currentPath = $state('');
	$effect(() => { currentPath = location.pathname; });

	$effect(() => { localStorage.setItem('enterToSend', String(enterToSend)); });
	$effect(() => { localStorage.setItem('aiModel', model); });

	function saveApiKey() {
		localStorage.setItem('apiKey', apiKey);
		savedApiKey = true;
		setTimeout(() => (savedApiKey = false), 2000);
	}
</script>

<div class="page">
	<h1>設定</h1>

	<nav class="subnav">
		<a href="/settings" class:active={currentPath === '/settings'}>一般</a>
		<a href="/settings/integrations" class:active={currentPath === '/settings/integrations'}>{m.integrations()}</a>
	</nav>

	<section>
		<h2>{m.settings_chat()}</h2>
		<div class="row">
			<div class="row-info">
				<span class="label">{m.settings_enter_to_send()}</span>
				<span class="desc">{m.settings_enter_to_send_desc()}</span>
			</div>
			<Toggle bind:checked={enterToSend} />
		</div>
	</section>

	<section>
		<h2>{m.settings_ai()}</h2>
		<div class="field-row">
			<Select label={m.settings_model()} bind:value={model} options={MODEL_OPTIONS} />
		</div>
		<div class="field-row api-key-row">
			<div class="api-key-input">
				<Textbox
					label={m.settings_api_key()}
					type="password"
					bind:value={apiKey}
					placeholder={m.settings_api_key_placeholder()}
				/>
			</div>
			<button class="save-btn" class:saved={savedApiKey} onclick={saveApiKey}>
				{savedApiKey ? m.settings_saved() : m.settings_save()}
			</button>
		</div>
		<p class="hint">{m.settings_api_key_desc()}</p>
	</section>
</div>

<style>
	.page {
		padding: 40px 48px;
		max-width: 640px;
	}

	h1 {
		font-size: 1.25rem;
		font-weight: 600;
		margin-bottom: 32px;
	}

	section {
		margin-bottom: 40px;
	}

	h2 {
		font-size: 0.75rem;
		font-weight: 600;
		text-transform: uppercase;
		letter-spacing: 0.06em;
		color: var(--color-text-muted);
		margin-bottom: 16px;
		padding-bottom: 8px;
		border-bottom: 1px solid var(--color-border);
	}

	.row {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 24px;
		padding: 12px 0;
	}

	.row-info {
		display: flex;
		flex-direction: column;
		gap: 2px;
	}

	.label {
		font-size: 0.9375rem;
	}

	.desc {
		font-size: 0.8125rem;
		color: var(--color-text-muted);
	}

	.field-row {
		padding: 12px 0;
	}

	.api-key-row {
		display: flex;
		align-items: flex-end;
		gap: 10px;
	}

	.api-key-input {
		flex: 1;
	}

	.save-btn {
		padding: 8px 16px;
		background: var(--color-primary);
		color: #fff;
		border: none;
		border-radius: 6px;
		font-size: 0.875rem;
		cursor: pointer;
		white-space: nowrap;
		transition: opacity 0.15s, background 0.2s;
		flex-shrink: 0;
	}

	.save-btn:hover { opacity: 0.85; }

	.save-btn.saved {
		background: #10b981;
	}

	.hint {
		font-size: 0.8125rem;
		color: var(--color-text-muted);
		margin-top: 4px;
	}

	.subnav {
		display: flex;
		gap: 4px;
		margin-bottom: 32px;
		border-bottom: 1px solid var(--color-border);
		padding-bottom: 0;
	}

	.subnav a {
		padding: 8px 14px;
		font-size: 0.875rem;
		color: var(--color-text-muted);
		text-decoration: none;
		border-bottom: 2px solid transparent;
		margin-bottom: -1px;
		transition: color 0.15s;
	}

	.subnav a:hover { color: var(--color-text); }
	.subnav a.active {
		color: var(--color-text);
		border-bottom-color: var(--color-primary);
		font-weight: 500;
	}
</style>
