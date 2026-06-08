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
		placeholder = '選択してください',
		required = false,
		disabled = false,
		error
	}: Props = $props();

	const uid = `sel-${Math.random().toString(36).slice(2, 7)}`;
</script>

<div class="field" class:has-error={!!error}>
	{#if label}
		<label for={uid}>{label}{#if required}<span class="req">*</span>{/if}</label>
	{/if}
	<div class="wrap">
		<select id={uid} bind:value {required} {disabled}>
			<option value="">{placeholder}</option>
			{#each options as opt}
				<option value={opt.value}>{opt.label}</option>
			{/each}
		</select>
		<svg class="arrow" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
			<polyline points="6 9 12 15 18 9" />
		</svg>
	</div>
	{#if error}<p class="err">{error}</p>{/if}
</div>

<style>
	.field { display: flex; flex-direction: column; gap: 4px; }
	label { font-size: 0.875rem; color: var(--color-text-muted); }
	.req { color: var(--color-danger); margin-left: 2px; }
	.wrap { position: relative; display: flex; align-items: center; }
	select {
		width: 100%;
		padding: 8px 32px 8px 10px;
		border: 1px solid var(--color-border);
		border-radius: 6px;
		background: var(--color-background);
		color: var(--color-text);
		font-size: 0.9375rem;
		outline: none;
		appearance: none;
		cursor: pointer;
		transition: border-color 0.15s;
	}
	select:focus { border-color: var(--color-primary); }
	select:disabled { opacity: 0.5; cursor: not-allowed; }
	.has-error select { border-color: var(--color-danger); }
	.arrow {
		position: absolute;
		right: 10px;
		width: 14px;
		height: 14px;
		color: var(--color-text-muted);
		pointer-events: none;
	}
	.err { font-size: 0.75rem; color: var(--color-danger); }
</style>
