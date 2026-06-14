<script lang="ts">
	import { onMount, untrack } from 'svelte';
	import SearchSelect from '$lib/components/ui/SearchSelect.svelte';
	import type { FormField } from '$lib/types/chat';
	import * as m from '$lib/paraglide/messages.js';

	type Props = {
		title?: string;
		fields: FormField[];
		submitLabel?: string;
		onsubmit: (data: Record<string, string>) => void;
	};

	let { title, fields, submitLabel, onsubmit }: Props = $props();

	let values = $state<Record<string, string>>(
		untrack(() => Object.fromEntries(fields.map((f) => [f.key, f.value ?? ''])))
	);

	let recordOptions = $state<Record<string, { value: string; label: string }[]>>({});

	onMount(async () => {
		const refTables = [...new Set(
			fields.filter((f) => f.type === 'recordSelect' && f.refTable).map((f) => f.refTable!)
		)];
		for (const refTable of refTables) {
			const res = await fetch(`/api/database/${refTable}/records`);
			if (res.ok) {
				const data = (await res.json()) as { rows: Record<string, unknown>[] };
				recordOptions[refTable] = data.rows.map((r) => ({
					value: String(r.id),
					label: String(r.name ?? r.id)
				}));
			}
		}
	});

	function handleSubmit(e: Event) {
		e.preventDefault();
		onsubmit(values);
	}

	function toggleMultiselect(key: string, value: string, checked: boolean) {
		const current = (values[key] ?? '').split(',').filter(Boolean);
		if (checked) {
			if (!current.includes(value)) current.push(value);
		} else {
			const idx = current.indexOf(value);
			if (idx !== -1) current.splice(idx, 1);
		}
		values[key] = current.join(',');
	}
</script>

<form class="form" onsubmit={handleSubmit}>
	{#if title}
		<p class="form-title">{title}</p>
	{/if}

	{#each fields as field}
		{#if field.type === 'hidden'}
			<input type="hidden" id={field.key} bind:value={values[field.key]} />
		{:else if field.type === 'recordSelect'}
			<SearchSelect
				label={field.label}
				required={field.required}
				bind:value={values[field.key]}
				options={recordOptions[field.refTable ?? ''] ?? []}
			/>
		{:else if field.type === 'multiselect'}
			<fieldset class="field">
				<legend>
					{field.label}
					{#if field.required}<span class="required">*</span>{/if}
				</legend>
				<div class="checkbox-group">
					{#each field.options ?? [] as opt}
						<label class="checkbox-option">
							<input
								type="checkbox"
								checked={(values[field.key] ?? '').split(',').filter(Boolean).includes(opt.value)}
								onchange={(e) => toggleMultiselect(field.key, opt.value, e.currentTarget.checked)}
							/>
							{opt.label}
						</label>
					{/each}
				</div>
			</fieldset>
		{:else}
		<div class="field">
			<label for={field.key}>
				{field.label}
				{#if field.required}<span class="required">*</span>{/if}
			</label>

			{#if field.type === 'textarea'}
				<textarea
					id={field.key}
					class:large={field.key === 'body'}
					placeholder={field.placeholder ?? ''}
					required={field.required}
					bind:value={values[field.key]}
				></textarea>
			{:else if field.type === 'select'}
				<select id={field.key} required={field.required} bind:value={values[field.key]}>
					<option value="">{m.form_select_placeholder()}</option>
					{#each field.options ?? [] as opt}
						<option value={opt.value}>{opt.label}</option>
					{/each}
				</select>
			{:else}
				<input
					id={field.key}
					type={field.type}
					placeholder={field.placeholder ?? ''}
					required={field.required}
					bind:value={values[field.key]}
				/>
			{/if}
		</div>
		{/if}
	{/each}

	<button type="submit">{submitLabel ?? m.form_submit()}</button>
</form>

<style>
	.form {
		display: flex;
		flex-direction: column;
		gap: 12px;
		padding: 16px;
		background: var(--color-surface);
		border: 1px solid var(--color-border);
		border-radius: 8px;
		width: 100%;
		max-width: 620px;
	}

	.form-title {
		font-weight: 600;
		margin: 0 0 4px;
	}

	.field {
		display: flex;
		flex-direction: column;
		gap: 4px;
	}

	fieldset.field {
		border: none;
		padding: 0;
		margin: 0;
	}

	label,
	legend {
		font-size: 0.875rem;
		color: var(--color-text-muted);
		padding: 0;
	}

	.required {
		color: var(--color-danger);
		margin-left: 2px;
	}

	.checkbox-group {
		display: flex;
		flex-direction: column;
		gap: 6px;
		margin-top: 4px;
	}
	
	.checkbox-option {
		display: flex;
		align-items: center;
		gap: 6px;
		width: fit-content;
		font-size: 0.9375rem;
		padding: 2px 4px;
		color: var(--color-text);
		cursor: pointer;
	}
	.checkbox-option input[type='checkbox'] {
		width: auto;
		padding: 0;
	}

	input,
	textarea,
	select {
		padding: 8px 10px;
		border: 1px solid var(--color-border);
		border-radius: 6px;
		background: var(--color-background);
		color: var(--color-text);
		font-size: 0.9375rem;
		outline: none;
	}

	input:focus,
	textarea:focus,
	select:focus {
		border-color: var(--color-primary);
	}

	textarea {
		min-height: 80px;
		resize: vertical;
	}

	textarea.large {
		min-height: 240px;
	}

	button {
		align-self: flex-end;
		padding: 8px 20px;
		background: var(--color-primary);
		color: #fff;
		border: none;
		border-radius: 6px;
		font-size: 0.9375rem;
		cursor: pointer;
	}

	button:hover {
		opacity: 0.88;
	}
</style>
