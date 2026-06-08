<script lang="ts">
	import type { FormField } from '$lib/types/chat';
	import * as m from '$lib/paraglide/messages.js';

	type Props = {
		title?: string;
		fields: FormField[];
		onsubmit: (data: Record<string, string>) => void;
	};

	let { title, fields, onsubmit }: Props = $props();

	let values = $state<Record<string, string>>(
		Object.fromEntries(fields.map((f) => [f.key, '']))
	);

	function handleSubmit(e: Event) {
		e.preventDefault();
		onsubmit(values);
	}
</script>

<form class="form" onsubmit={handleSubmit}>
	{#if title}
		<p class="form-title">{title}</p>
	{/if}

	{#each fields as field}
		<div class="field">
			<label for={field.key}>
				{field.label}
				{#if field.required}<span class="required">*</span>{/if}
			</label>

			{#if field.type === 'textarea'}
				<textarea
					id={field.key}
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
	{/each}

	<button type="submit">{m.form_submit()}</button>
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
		max-width: 480px;
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

	label {
		font-size: 0.875rem;
		color: var(--color-text-muted);
	}

	.required {
		color: var(--color-danger);
		margin-left: 2px;
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
