import type { FieldDef } from '$lib/server/db/table-service';
import type { FormField } from '$lib/types/chat';
import { toJstDatetimeLocal } from '$lib/datetime';

/** Core entity types handled by RecordDialog */
export type CoreType = 'customers' | 'contacts' | 'deals' | 'activities';

/** Spec for opening an edit/create form from the detail view. Uses camelCase prefill rather than snake_case FormContent */
export type RecordFormSpec = {
	type: string;
	recordId?: string;
	prefill?: Record<string, string>;
};

/**
 * Converts a FieldDef (camelCase) from getTableInfo into a FormField for chat/Form.svelte.
 * - Prefers formOptions for form choices (to exclude values that should remain visible in the
 *   display but not be selectable in the form, e.g. "Deal created" for activities)
 * - values is injected by the caller into each field's value (record value when editing, prefill when creating)
 */
export function fieldDefToFormField(
	field: FieldDef,
	value?: string
): FormField {
	return {
		key: field.key,
		label: field.label,
		type: field.type,
		required: field.required,
		refTable: field.refTable,
		options: field.formOptions ?? field.options,
		value: value ?? ''
	};
}

export function fieldDefsToFormFields(
	fields: FieldDef[],
	values: Record<string, unknown> = {}
): FormField[] {
	return fields.map((f) => {
		const raw = values[f.key];
		let value = '';
		if (raw != null && raw !== '') {
			if (f.type === 'datetime-local' && typeof raw === 'number') {
				// Convert unix timestamp → JST datetime-local string
				value = toJstDatetimeLocal(new Date(raw * 1000));
			} else {
				value = String(raw);
			}
		}
		return fieldDefToFormField(f, value);
	});
}
