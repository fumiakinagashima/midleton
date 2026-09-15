import { eq, desc, sql } from 'drizzle-orm';
import { parseJstDatetime } from '$lib/datetime';
import type { Db } from './index';
import {
	customers, contacts, deals, activities, coreCustomFields
} from './schema';

export type CustomFieldType = 'text' | 'number' | 'select' | 'date' | 'email' | 'tel' | 'textarea';

export type FieldDef = {
	key: string;
	label: string;
	type: CustomFieldType | 'recordSelect' | 'datetime-local';
	required?: boolean;
	options?: { label: string; value: string }[];
	// Options for the create/edit form (uses `options` if omitted).
	// Specify this when a value the system assigns automatically (e.g. "Deal Registered" in the activity log)
	// should remain in the display `options` but not be selectable in the form
	formOptions?: { label: string; value: string }[];
	listable?: boolean;
	isCustom?: boolean;
	refTable?: string;
};

export type TableInfo = {
	id: string;
	label: string;
	icon: string;
	isCore: boolean;
	fields: FieldDef[];
};

export type RecordRow = Record<string, string | number | null>;

const toTs = (d: Date | null | undefined): number | null =>
	d ? Math.floor(d.getTime() / 1000) : null;

export const CORE_TABLE_NAMES = ['customers', 'contacts', 'deals', 'activities'];

// Reserved names that would collide with the /database/[type] route
const RESERVED_NAMES = new Set([
	...CORE_TABLE_NAMES,
	'accounts', 'reminders',
	'core_custom_fields', 'integrations',
	'new', 'schema', 'gantt',
]);

const CORE_TABLE_BASE: Record<string, Omit<TableInfo, 'fields'> & { fields: FieldDef[] }> = {
	customers: {
		id: 'customers', label: 'Customers', icon: 'building', isCore: true,
		fields: [
			{ key: 'name', label: 'Company Name', type: 'text', required: true, listable: true },
			{ key: 'email', label: 'Email', type: 'email', listable: true },
			{ key: 'phone', label: 'Phone', type: 'tel' },
			{ key: 'postalCode', label: 'Postal Code', type: 'text' },
			{ key: 'address', label: 'Address', type: 'text' },
			{ key: 'website', label: 'Website', type: 'text' },
			{
				key: 'status', label: 'Status', type: 'select', listable: true,
				options: [{ label: 'Active', value: 'active' }, { label: 'Inactive', value: 'inactive' }]
			},
			{ key: 'notes', label: 'Notes', type: 'textarea' }
		]
	},
	contacts: {
		id: 'contacts', label: 'Contacts', icon: 'user', isCore: true,
		fields: [
			{ key: 'name', label: 'Name', type: 'text', required: true, listable: true },
			{ key: 'nameKana', label: 'Name (Reading)', type: 'text' },
			{ key: 'customerId', label: 'Customer', type: 'recordSelect', required: true, listable: true, refTable: 'customers' },
			{ key: 'email', label: 'Email', type: 'email', listable: true },
			{ key: 'phone', label: 'Phone', type: 'tel' },
			{ key: 'role', label: 'Title', type: 'text', listable: true },
			{ key: 'department', label: 'Department', type: 'text' },
			{ key: 'notes', label: 'Notes', type: 'textarea' }
		]
	},
	deals: {
		id: 'deals', label: 'Deals', icon: 'briefcase', isCore: true,
		fields: [
			{ key: 'title', label: 'Deal Title', type: 'text', required: true, listable: true },
			{ key: 'customerId', label: 'Customer', type: 'recordSelect', required: true, listable: true, refTable: 'customers' },
			{ key: 'amount', label: 'Amount', type: 'number', listable: true },
			{
				key: 'status', label: 'Status', type: 'select', listable: true,
				options: [{ label: 'Open', value: 'open' }, { label: 'Won', value: 'won' }, { label: 'Lost', value: 'lost' }]
			},
			{ key: 'plannedStart', label: 'Planned Start Date', type: 'date' },
			{ key: 'plannedEnd', label: 'Planned End Date', type: 'date' },
			{ key: 'notes', label: 'Notes', type: 'textarea' }
		]
	},
	activities: {
		id: 'activities', label: 'Activity History', icon: 'clipboard', isCore: true,
		fields: [
			{ key: 'customerId', label: 'Customer', type: 'recordSelect', required: true, listable: true, refTable: 'customers' },
			{
				key: 'type', label: 'Type', type: 'select', required: true, listable: true,
				options: [
					{ label: 'Note', value: 'note' }, { label: 'Call', value: 'call' },
					{ label: 'Email', value: 'email' }, { label: 'Meeting', value: 'meeting' },
					{ label: 'Deal Registered', value: 'deal_created' }
				],
				// "Deal Registered" is recorded automatically by the system when a deal is created, so it is not selectable in the form
				formOptions: [
					{ label: 'Note', value: 'note' }, { label: 'Call', value: 'call' },
					{ label: 'Email', value: 'email' }, { label: 'Meeting', value: 'meeting' }
				]
			},
			{ key: 'content', label: 'Content', type: 'textarea', required: true, listable: true },
			{ key: 'activityDate', label: 'Activity Date/Time', type: 'datetime-local' }
		]
	}
};

// Keep for backwards compatibility with agent tools
export const CORE_TABLE_INFO = CORE_TABLE_BASE;

const CORE_COLUMN_KEYS: Record<string, string[]> = {
	customers: ['name', 'email', 'phone', 'postalCode', 'address', 'website', 'status', 'notes'],
	contacts: ['customerId', 'name', 'nameKana', 'email', 'phone', 'role', 'department', 'notes'],
	deals: ['customerId', 'title', 'amount', 'status', 'plannedStart', 'plannedEnd', 'notes'],
	activities: ['customerId', 'type', 'content', 'activityDate']
};

const SYSTEM_KEYS = new Set(['id', 'createdAt', 'updatedAt']);

function extractCustomData(type: string, data: Record<string, unknown>): Record<string, unknown> {
	const coreKeys = new Set(CORE_COLUMN_KEYS[type] ?? []);
	const result: Record<string, unknown> = {};
	for (const [k, v] of Object.entries(data)) {
		if (!coreKeys.has(k) && !SYSTEM_KEYS.has(k)) {
			result[k] = v;
		}
	}
	return result;
}

export async function getCoreCustomFields(db: Db, tableName: string): Promise<FieldDef[]> {
	const fields = await db.select().from(coreCustomFields)
		.where(eq(coreCustomFields.tableName, tableName))
		.orderBy(coreCustomFields.sortOrder);
	return fields.map(f => ({
		key: f.key, label: f.label, type: f.type, required: f.required,
		options: JSON.parse(f.options ?? '[]'), listable: true, isCustom: true,
		refTable: f.refTable ?? undefined
	}));
}

export type EditableField = Omit<FieldDef, 'listable' | 'isCustom'> & { _id: string };

export async function updateCoreCustomFields(db: Db, tableName: string, fields: EditableField[]): Promise<void> {
	await db.batch([
		db.delete(coreCustomFields).where(eq(coreCustomFields.tableName, tableName)),
		...fields.map((f, i) =>
			db.insert(coreCustomFields).values({
				id: crypto.randomUUID(), tableName,
				key: f.key, label: f.label, type: f.type as CustomFieldType,
				required: f.required ?? false,
				options: JSON.stringify(f.options ?? []),
				refTable: f.refTable ?? null,
				sortOrder: i
			})
		)
	]);
}

export async function getTableInfo(db: Db, type: string): Promise<TableInfo | null> {
	if (!CORE_TABLE_BASE[type]) return null;
	const customFields = await getCoreCustomFields(db, type);
	return {
		...CORE_TABLE_BASE[type],
		fields: [...CORE_TABLE_BASE[type].fields, ...customFields]
	};
}

export async function listAllTables(db: Db): Promise<(TableInfo & { count: number })[]> {
	const [[c1], [c2], [c3], [c4]] = await Promise.all([
		db.select({ count: sql<number>`count(*)` }).from(customers),
		db.select({ count: sql<number>`count(*)` }).from(contacts),
		db.select({ count: sql<number>`count(*)` }).from(deals),
		db.select({ count: sql<number>`count(*)` }).from(activities)
	]);

	return [
		{ ...CORE_TABLE_BASE.customers, count: c1.count },
		{ ...CORE_TABLE_BASE.contacts, count: c2.count },
		{ ...CORE_TABLE_BASE.deals, count: c3.count },
		{ ...CORE_TABLE_BASE.activities, count: c4.count }
	];
}

export async function listRecords(db: Db, type: string, limit = 200): Promise<RecordRow[]> {
	if (type === 'customers') {
		return (await db.select().from(customers).orderBy(desc(customers.createdAt)).limit(limit))
			.map(c => ({
				id: c.id, name: c.name, email: c.email, phone: c.phone,
				postalCode: c.postalCode, address: c.address, website: c.website,
				status: c.status, notes: c.notes,
				...(JSON.parse(c.custom ?? '{}') as RecordRow),
				createdAt: toTs(c.createdAt), updatedAt: toTs(c.updatedAt)
			}));
	}
	if (type === 'contacts') {
		return (await db.select().from(contacts).orderBy(desc(contacts.createdAt)).limit(limit))
			.map(c => ({
				id: c.id, customerId: c.customerId, name: c.name, nameKana: c.nameKana, email: c.email,
				phone: c.phone, role: c.role, department: c.department, notes: c.notes,
				...(JSON.parse(c.custom ?? '{}') as RecordRow),
				createdAt: toTs(c.createdAt), updatedAt: toTs(c.updatedAt)
			}));
	}
	if (type === 'deals') {
		return (await db.select().from(deals).orderBy(desc(deals.createdAt)).limit(limit))
			.map(d => ({
				id: d.id, customerId: d.customerId, title: d.title, amount: d.amount,
				status: d.status, plannedStart: d.plannedStart, plannedEnd: d.plannedEnd,
				notes: d.notes,
				...(JSON.parse(d.custom ?? '{}') as RecordRow),
				createdAt: toTs(d.createdAt), updatedAt: toTs(d.updatedAt)
			}));
	}
	if (type === 'activities') {
		return (await db.select().from(activities)
			.orderBy(desc(sql`COALESCE(${activities.activityDate}, ${activities.createdAt})`))
			.limit(limit))
			.map(a => ({
				id: a.id, customerId: a.customerId,
				type: a.type, content: a.content,
				activityDate: toTs(a.activityDate),
				...(JSON.parse(a.custom ?? '{}') as RecordRow),
				createdAt: toTs(a.createdAt)
			}));
	}
	return [];
}

export async function getRecord(db: Db, type: string, id: string): Promise<RecordRow | null> {
	if (type === 'customers') {
		const [c] = await db.select().from(customers).where(eq(customers.id, id));
		if (!c) return null;
		return {
			id: c.id, name: c.name, email: c.email, phone: c.phone,
			postalCode: c.postalCode, address: c.address, website: c.website,
			status: c.status, notes: c.notes,
			...(JSON.parse(c.custom ?? '{}') as RecordRow),
			createdAt: toTs(c.createdAt), updatedAt: toTs(c.updatedAt)
		};
	}
	if (type === 'contacts') {
		const [c] = await db.select().from(contacts).where(eq(contacts.id, id));
		if (!c) return null;
		return {
			id: c.id, customerId: c.customerId, name: c.name, nameKana: c.nameKana, email: c.email,
			phone: c.phone, role: c.role, department: c.department, notes: c.notes,
			...(JSON.parse(c.custom ?? '{}') as RecordRow),
			createdAt: toTs(c.createdAt), updatedAt: toTs(c.updatedAt)
		};
	}
	if (type === 'deals') {
		const [d] = await db.select().from(deals).where(eq(deals.id, id));
		if (!d) return null;
		return {
			id: d.id, customerId: d.customerId, title: d.title, amount: d.amount,
			status: d.status, plannedStart: d.plannedStart, plannedEnd: d.plannedEnd,
			notes: d.notes,
			...(JSON.parse(d.custom ?? '{}') as RecordRow),
			createdAt: toTs(d.createdAt), updatedAt: toTs(d.updatedAt)
		};
	}
	if (type === 'activities') {
		const [a] = await db.select().from(activities).where(eq(activities.id, id));
		if (!a) return null;
		return {
			id: a.id, customerId: a.customerId,
			type: a.type, content: a.content,
			activityDate: toTs(a.activityDate),
			...(JSON.parse(a.custom ?? '{}') as RecordRow),
			createdAt: toTs(a.createdAt)
		};
	}
	return null;
}

export async function recordActivity(
	db: Db,
	customerId: string,
	type: 'note' | 'call' | 'email' | 'meeting' | 'deal_created',
	content: string,
	createdBy?: string
): Promise<void> {
	await db.insert(activities).values({ id: crypto.randomUUID(), customerId, type, content, createdBy: createdBy ?? '' });
}

/**
 * Builds (without executing) the insert query for the activity log entry created when a deal is registered.
 * Used to run it atomically together with the deal insert via `db.batch([...])`.
 */
export function dealRegisteredActivityInsert(db: Db, customerId: string, dealTitle: string, createdBy?: string) {
	return db.insert(activities).values({
		id: crypto.randomUUID(),
		customerId,
		type: 'deal_created' as const,
		content: `Registered deal "${dealTitle}"`,
		createdBy: createdBy ?? ''
	});
}

export async function createRecord(db: Db, type: string, data: Record<string, unknown>): Promise<RecordRow> {
	const id = crypto.randomUUID();
	const s = (k: string) => (data[k] != null && data[k] !== '' ? String(data[k]) : null);
	const n = (k: string) => (data[k] != null && data[k] !== '' ? Number(data[k]) : null);

	if (type === 'customers') {
		const customData = extractCustomData('customers', data);
		await db.insert(customers).values({
			id, name: String(data.name ?? ''),
			email: s('email'), phone: s('phone'),
			postalCode: s('postalCode'), address: s('address'), website: s('website'),
			status: (data.status as 'active' | 'inactive') ?? 'active',
			notes: s('notes'), custom: JSON.stringify(customData)
		});
		return (await getRecord(db, 'customers', id))!;
	}
	if (type === 'contacts') {
		const customData = extractCustomData('contacts', data);
		await db.insert(contacts).values({
			id, customerId: String(data.customerId ?? ''), name: String(data.name ?? ''),
			nameKana: s('nameKana'),
			email: s('email'), phone: s('phone'), role: s('role'), department: s('department'),
			notes: s('notes'), custom: JSON.stringify(customData)
		});
		return (await getRecord(db, 'contacts', id))!;
	}
	if (type === 'deals') {
		const customData = extractCustomData('deals', data);
		await db.batch([
			db.insert(deals).values({
				id, customerId: String(data.customerId ?? ''), title: String(data.title ?? ''),
				amount: n('amount'), status: (data.status as 'open' | 'won' | 'lost') ?? 'open',
				plannedStart: s('plannedStart'), plannedEnd: s('plannedEnd'),
				notes: s('notes'), custom: JSON.stringify(customData)
			}),
			dealRegisteredActivityInsert(db, String(data.customerId ?? ''), String(data.title ?? ''))
		]);
		return (await getRecord(db, 'deals', id))!;
	}
	if (type === 'activities') {
		const customData = extractCustomData('activities', data);
		const actDate = data.activityDate ? parseJstDatetime(String(data.activityDate)) : null;
		await db.insert(activities).values({
			id,
			customerId: String(data.customerId ?? ''),
			type: (data.type as 'note' | 'call' | 'email' | 'meeting' | 'deal_created') ?? 'note',
			content: String(data.content ?? ''),
			...(actDate !== null ? { activityDate: actDate } : {}),
			custom: JSON.stringify(customData)
		});
		return (await getRecord(db, 'activities', id))!;
	}

	throw new Error(`Table not found: ${type}`);
}

export async function updateRecord(db: Db, type: string, id: string, data: Record<string, unknown>): Promise<RecordRow> {
	const s = (k: string) => (data[k] != null && data[k] !== '' ? String(data[k]) : null);
	const n = (k: string) => (data[k] != null && data[k] !== '' ? Number(data[k]) : null);

	if (type === 'customers') {
		const [existing] = await db.select({ custom: customers.custom }).from(customers).where(eq(customers.id, id));
		const existingCustom = JSON.parse(existing?.custom ?? '{}') as Record<string, unknown>;
		const mergedCustom = { ...existingCustom, ...extractCustomData('customers', data) };
		await db.update(customers).set({
			...(data.name != null ? { name: String(data.name) } : {}),
			email: s('email'), phone: s('phone'),
			postalCode: s('postalCode'), address: s('address'), website: s('website'),
			...(data.status != null ? { status: data.status as 'active' | 'inactive' } : {}),
			notes: s('notes'), custom: JSON.stringify(mergedCustom), updatedAt: new Date()
		}).where(eq(customers.id, id));
		return (await getRecord(db, 'customers', id))!;
	}
	if (type === 'contacts') {
		const [existing] = await db.select({ custom: contacts.custom }).from(contacts).where(eq(contacts.id, id));
		const existingCustom = JSON.parse(existing?.custom ?? '{}') as Record<string, unknown>;
		const mergedCustom = { ...existingCustom, ...extractCustomData('contacts', data) };
		await db.update(contacts).set({
			...(data.customerId != null ? { customerId: String(data.customerId) } : {}),
			...(data.name != null ? { name: String(data.name) } : {}),
			nameKana: s('nameKana'),
			email: s('email'), phone: s('phone'), role: s('role'), department: s('department'),
			notes: s('notes'), custom: JSON.stringify(mergedCustom), updatedAt: new Date()
		}).where(eq(contacts.id, id));
		return (await getRecord(db, 'contacts', id))!;
	}
	if (type === 'deals') {
		const [existing] = await db.select({ custom: deals.custom }).from(deals).where(eq(deals.id, id));
		const existingCustom = JSON.parse(existing?.custom ?? '{}') as Record<string, unknown>;
		const mergedCustom = { ...existingCustom, ...extractCustomData('deals', data) };
		const closedAt =
			data.status === 'won' || data.status === 'lost'
				? new Date()
				: data.status === 'open'
					? null
					: undefined;
		await db.update(deals).set({
			...(data.customerId != null ? { customerId: String(data.customerId) } : {}),
			...(data.title != null ? { title: String(data.title) } : {}),
			amount: n('amount'),
			...(data.status != null ? { status: data.status as 'open' | 'won' | 'lost' } : {}),
			...(data.plannedStart !== undefined ? { plannedStart: s('plannedStart') } : {}),
			...(data.plannedEnd !== undefined ? { plannedEnd: s('plannedEnd') } : {}),
			...(closedAt !== undefined ? { closedAt } : {}),
			notes: s('notes'), custom: JSON.stringify(mergedCustom), updatedAt: new Date()
		}).where(eq(deals.id, id));
		return (await getRecord(db, 'deals', id))!;
	}
	if (type === 'activities') {
		const [existing] = await db.select({ custom: activities.custom }).from(activities).where(eq(activities.id, id));
		const existingCustom = JSON.parse(existing?.custom ?? '{}') as Record<string, unknown>;
		const mergedCustom = { ...existingCustom, ...extractCustomData('activities', data) };
		const actDate = data.activityDate
			? (String(data.activityDate) !== '' ? parseJstDatetime(String(data.activityDate)) : null)
			: undefined;
		await db.update(activities).set({
			...(data.customerId != null ? { customerId: String(data.customerId) } : {}),
			...(data.type != null ? { type: data.type as 'note' | 'call' | 'email' | 'meeting' | 'deal_created' } : {}),
			...(data.content != null ? { content: String(data.content) } : {}),
			...(actDate !== undefined ? { activityDate: actDate } : {}),
			custom: JSON.stringify(mergedCustom)
		}).where(eq(activities.id, id));
		return (await getRecord(db, 'activities', id))!;
	}

	throw new Error(`Table not found: ${type}`);
}

export async function deleteRecord(db: Db, type: string, id: string): Promise<void> {
	if (type === 'customers') { await db.delete(customers).where(eq(customers.id, id)); return; }
	if (type === 'contacts') { await db.delete(contacts).where(eq(contacts.id, id)); return; }
	if (type === 'deals') { await db.delete(deals).where(eq(deals.id, id)); return; }
	if (type === 'activities') { await db.delete(activities).where(eq(activities.id, id)); return; }
	throw new Error(`Table not found: ${type}`);
}
