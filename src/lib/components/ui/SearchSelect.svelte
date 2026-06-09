<script lang="ts">
	type Option = { value: string; label: string };

	type Props = {
		label?: string;
		value?: string;
		options: Option[];
		placeholder?: string;
		required?: boolean;
		disabled?: boolean;
		error?: string;
	};

	let {
		label,
		value = $bindable(''),
		options,
		placeholder = '選択または検索...',
		required = false,
		disabled = false,
		error
	}: Props = $props();

	let open = $state(false);
	let query = $state('');
	let highlighted = $state(-1);
	let containerEl = $state<HTMLDivElement | null>(null);

	const selectedLabel = $derived(options.find((o) => o.value === value)?.label ?? '');

	const filtered = $derived(
		query.trim()
			? options.filter((o) => o.label.includes(query) || o.value.includes(query))
			: options
	);

	$effect(() => {
		filtered;
		highlighted = -1;
	});

	function openDropdown() {
		if (disabled) return;
		query = '';
		open = true;
	}

	function select(opt: Option) {
		value = opt.value;
		query = '';
		open = false;
	}

	function clear(e: MouseEvent) {
		e.stopPropagation();
		value = '';
		open = false;
	}

	function handleKeydown(e: KeyboardEvent) {
		if (e.key === 'ArrowDown') {
			e.preventDefault();
			highlighted = Math.min(highlighted + 1, filtered.length - 1);
		} else if (e.key === 'ArrowUp') {
			e.preventDefault();
			highlighted = Math.max(highlighted - 1, 0);
		} else if (e.key === 'Enter') {
			e.preventDefault();
			if (highlighted >= 0 && filtered[highlighted]) select(filtered[highlighted]);
		} else if (e.key === 'Escape') {
			open = false;
			query = '';
		}
	}

	function handleFocusOut() {
		// relatedTarget is unreliable when DOM swaps (button → input on open).
		// Check activeElement after focus settles instead.
		setTimeout(() => {
			if (!containerEl?.contains(document.activeElement)) {
				open = false;
				query = '';
			}
		}, 0);
	}

	function focusInput(node: HTMLElement) {
		node.focus();
	}
</script>

<div
	class="field"
	class:has-error={!!error}
	bind:this={containerEl}
	onfocusout={handleFocusOut}
>
	{#if label}
		<p class="label">{label}{#if required}<span class="req">*</span>{/if}</p>
	{/if}

	<div class="trigger" class:open class:disabled>
		{#if open}
			<input
				class="search"
				use:focusInput
				bind:value={query}
				{placeholder}
				{disabled}
				onkeydown={handleKeydown}
			/>
		{:else}
			<button type="button" class="display" onclick={openDropdown} {disabled}>
				<span class:muted={!value}>{value ? selectedLabel : placeholder}</span>
			</button>
		{/if}

		{#if value && !open}
			<button type="button" class="icon-btn" onclick={clear} tabindex="-1" aria-label="クリア">
				<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
					<line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
				</svg>
			</button>
		{:else}
			<span class="icon-btn" aria-hidden="true">
				<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
					<polyline points="6 9 12 15 18 9" />
				</svg>
			</span>
		{/if}
	</div>

	{#if open}
		<ul class="dropdown" role="listbox">
			{#if filtered.length === 0}
				<li class="empty">該当なし</li>
			{:else}
				{#each filtered as opt, i}
					<li
						role="option"
						aria-selected={opt.value === value}
						class:hl={i === highlighted}
						class:selected={opt.value === value}
						onmousedown={(e) => { e.preventDefault(); select(opt); }}
					>{opt.label}</li>
				{/each}
			{/if}
		</ul>
	{/if}

	{#if error}<p class="err">{error}</p>{/if}
</div>

<style>
	.field { display: flex; flex-direction: column; gap: 4px; position: relative; }
	.label { font-size: 0.875rem; color: var(--color-text-muted); }
	.req { color: var(--color-danger); margin-left: 2px; }

	.trigger {
		position: relative;
		display: flex;
		align-items: center;
		border: 1px solid var(--color-border);
		border-radius: 6px;
		background: var(--color-background);
		transition: border-color 0.15s;
	}
	.trigger.open, .trigger:focus-within { border-color: var(--color-primary); }
	.trigger.disabled { opacity: 0.5; pointer-events: none; }
	.has-error .trigger { border-color: var(--color-danger); }

	.display {
		flex: 1;
		padding: 8px 10px;
		background: none;
		border: none;
		color: var(--color-text);
		font-size: 0.9375rem;
		text-align: left;
		cursor: pointer;
		min-width: 0;
	}
	.display .muted { color: var(--color-text-muted); }

	.search {
		flex: 1;
		padding: 8px 10px;
		background: none;
		border: none;
		color: var(--color-text);
		font-size: 0.9375rem;
		outline: none;
		min-width: 0;
	}

	.icon-btn {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 32px;
		height: 32px;
		background: none;
		border: none;
		cursor: pointer;
		color: var(--color-text-muted);
		flex-shrink: 0;
	}
	button.icon-btn:hover { color: var(--color-danger); }
	.icon-btn svg { width: 14px; height: 14px; }

	.dropdown {
		position: absolute;
		top: calc(100% + 4px);
		left: 0; right: 0;
		list-style: none;
		background: var(--color-background);
		border: 1px solid var(--color-border);
		border-radius: 6px;
		max-height: 220px;
		overflow-y: auto;
		z-index: 50;
		box-shadow: 0 4px 16px rgba(0,0,0,0.18);
	}
	.dropdown li {
		padding: 8px 12px;
		font-size: 0.9375rem;
		cursor: pointer;
		color: var(--color-text);
	}
	.dropdown li.hl { background: var(--color-surface); }
	.dropdown li.selected {
		color: var(--color-primary);
		font-weight: 500;
		background: color-mix(in srgb, var(--color-primary) 10%, transparent);
	}
	.dropdown li.empty { color: var(--color-text-muted); cursor: default; }
	.err { font-size: 0.75rem; color: var(--color-danger); }
</style>
