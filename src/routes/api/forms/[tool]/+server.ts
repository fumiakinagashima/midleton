import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { createDb } from '$lib/server/db';
import { getReminderChannelOptions } from '$lib/server/db/reminder-service';
import type { FormField } from '$lib/types/chat';
import type { ToolEnv } from '$lib/server/agent-tools';

const DEAL_STATUS_OPTIONS = [
	{ label: 'In Progress', value: 'open' },
	{ label: 'Won', value: 'won' },
	{ label: 'Lost', value: 'lost' }
];

const ACTIVITY_TYPE_OPTIONS = [
	{ label: 'Note', value: 'note' },
	{ label: 'Call', value: 'call' },
	{ label: 'Email', value: 'email' },
	{ label: 'Meeting', value: 'meeting' }
];

// Returns server-defined forms for known tools.
// FormDialog fetches the field structure from this endpoint and applies AI-provided values as prefill.
export const GET: RequestHandler = async ({ params, platform, locals }) => {
	if (!platform?.env?.DB) {
		return json({ error: 'DB not configured' }, { status: 500 });
	}

	const db = createDb(platform.env.DB);
	const toolEnv: ToolEnv = {
		...platform.env,
		accountId: locals.account?.id,
		accountName: locals.account?.name
	};

	const { tool } = params;

	// ── Reminder ──────────────────────────────────────────────
	if (tool === 'create_reminder') {
		const options = await getReminderChannelOptions(db, toolEnv);
		const fields: FormField[] = [
			{ key: 'remind_at', label: 'Date/Time', type: 'datetime-local', required: true },
			{ key: 'channels', label: 'Notify Via', type: 'multiselect', required: true, value: 'notification', options },
			{ key: 'content', label: 'Content', type: 'textarea', required: true }
		];
		return json({ title: 'Set Reminder', fields });
	}

	// ── Customer ─────────────────────────────────────────────────────
	if (tool === 'create_customer') {
		const fields: FormField[] = [
			{ key: 'name', label: 'Company Name', type: 'text', required: true },
			{ key: 'email', label: 'Email Address', type: 'email' },
			{ key: 'phone', label: 'Phone Number', type: 'tel' },
			{ key: 'postal_code', label: 'Postal Code', type: 'text' },
			{ key: 'address', label: 'Address', type: 'text' },
			{ key: 'website', label: 'Website', type: 'text' },
			{
				key: 'status',
				label: 'Status',
				type: 'select',
				value: 'active',
				options: [
					{ label: 'Active', value: 'active' },
					{ label: 'Inactive', value: 'inactive' }
				]
			},
			{ key: 'notes', label: 'Notes', type: 'textarea' }
		];
		return json({ title: 'Register Customer', fields });
	}

	if (tool === 'update_customer') {
		const fields: FormField[] = [
			{ key: 'id', label: '', type: 'hidden' },
			{ key: 'name', label: 'Company Name', type: 'text', required: true },
			{ key: 'email', label: 'Email Address', type: 'email' },
			{ key: 'phone', label: 'Phone Number', type: 'tel' },
			{ key: 'postal_code', label: 'Postal Code', type: 'text' },
			{ key: 'address', label: 'Address', type: 'text' },
			{ key: 'website', label: 'Website', type: 'text' },
			{
				key: 'status',
				label: 'Status',
				type: 'select',
				options: [
					{ label: 'Active', value: 'active' },
					{ label: 'Inactive', value: 'inactive' }
				]
			},
			{ key: 'notes', label: 'Notes', type: 'textarea' }
		];
		return json({ title: 'Edit Customer', fields });
	}

	// ── Deal ─────────────────────────────────────────────────────
	if (tool === 'create_deal') {
		const fields: FormField[] = [
			{ key: 'customer_id', label: 'Customer', type: 'recordSelect', required: true, refTable: 'customers' },
			{ key: 'title', label: 'Deal Title', type: 'text', required: true },
			{ key: 'amount', label: 'Amount (JPY)', type: 'number' },
			{ key: 'status', label: 'Status', type: 'select', value: 'open', options: DEAL_STATUS_OPTIONS },
			{ key: 'planned_start', label: 'Planned Start Date', type: 'date' },
			{ key: 'planned_end', label: 'Planned End Date', type: 'date' },
			{ key: 'notes', label: 'Notes', type: 'textarea' }
		];
		return json({ title: 'Register Deal', fields });
	}

	if (tool === 'update_deal') {
		const fields: FormField[] = [
			{ key: 'id', label: '', type: 'hidden' },
			{ key: 'customer_id', label: '', type: 'hidden' },
			{ key: 'title', label: 'Deal Title', type: 'text', required: true },
			{ key: 'amount', label: 'Amount (JPY)', type: 'number' },
			{ key: 'status', label: 'Status', type: 'select', options: DEAL_STATUS_OPTIONS },
			{ key: 'planned_start', label: 'Planned Start Date', type: 'date' },
			{ key: 'planned_end', label: 'Planned End Date', type: 'date' },
			{ key: 'notes', label: 'Notes', type: 'textarea' }
		];
		return json({ title: 'Edit Deal', fields });
	}

	// ── Contact ───────────────────────────────────────────────────
	if (tool === 'create_contact') {
		const fields: FormField[] = [
			{ key: 'customer_id', label: 'Customer', type: 'recordSelect', required: true, refTable: 'customers' },
			{ key: 'name', label: 'Name', type: 'text', required: true },
			{ key: 'name_kana', label: 'Name (Kana)', type: 'text' },
			{ key: 'role', label: 'Role', type: 'text' },
			{ key: 'department', label: 'Department', type: 'text' },
			{ key: 'email', label: 'Email Address', type: 'email' },
			{ key: 'phone', label: 'Phone Number', type: 'tel' },
			{ key: 'notes', label: 'Notes', type: 'textarea' }
		];
		return json({ title: 'Register Contact', fields });
	}

	if (tool === 'update_contact') {
		const fields: FormField[] = [
			{ key: 'id', label: '', type: 'hidden' },
			{ key: 'customer_id', label: '', type: 'hidden' },
			{ key: 'name', label: 'Name', type: 'text', required: true },
			{ key: 'name_kana', label: 'Name (Kana)', type: 'text' },
			{ key: 'role', label: 'Role', type: 'text' },
			{ key: 'department', label: 'Department', type: 'text' },
			{ key: 'email', label: 'Email Address', type: 'email' },
			{ key: 'phone', label: 'Phone Number', type: 'tel' },
			{ key: 'notes', label: 'Notes', type: 'textarea' }
		];
		return json({ title: 'Edit Contact', fields });
	}

	// ── Activity ─────────────────────────────────────────────────
	if (tool === 'create_activity') {
		const fields: FormField[] = [
			{ key: 'customer_id', label: 'Customer', type: 'recordSelect', required: true, refTable: 'customers' },
			{ key: 'type', label: 'Type', type: 'select', value: 'note', options: ACTIVITY_TYPE_OPTIONS },
			{ key: 'content', label: 'Content', type: 'textarea', required: true }
		];
		return json({ title: 'Register Activity', fields });
	}

	return json({ error: 'Not found' }, { status: 404 });
};
