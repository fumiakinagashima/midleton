import { eq, desc, sql } from 'drizzle-orm';
import type { Db } from './index';
import {
	customers, contacts, deals, activities,
	entityTypes, entityFields, entities, coreCustomFields
} from './schema';

export type CustomFieldType = 'text' | 'number' | 'select' | 'date' | 'email' | 'tel' | 'textarea';

export type FieldDef = {
	key: string;
	label: string;
	type: CustomFieldType | 'recordSelect';
	required?: boolean;
	options?: { label: string; value: string }[];
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

// /database/[type] ルートと衝突する予約済み名
const RESERVED_NAMES = new Set([
	...CORE_TABLE_NAMES,
	'approvals', 'accounts',          // 固定ルート
	'entity_types', 'entity_fields', 'entities', 'core_custom_fields',
	'approval_requests', 'approval_attachments', 'integrations', // 物理テーブル名
	'new', 'schema', 'gantt',         // サブルート名
]);

const CORE_TABLE_BASE: Record<string, Omit<TableInfo, 'fields'> & { fields: FieldDef[] }> = {
	customers: {
		id: 'customers', label: '顧客', icon: 'building', isCore: true,
		fields: [
			{ key: 'name', label: '会社名', type: 'text', required: true, listable: true },
			{ key: 'email', label: 'メール', type: 'email', listable: true },
			{ key: 'phone', label: '電話番号', type: 'tel' },
			{ key: 'postalCode', label: '郵便番号', type: 'text' },
			{ key: 'address', label: '住所', type: 'text' },
			{ key: 'website', label: 'ホームページ', type: 'text' },
			{
				key: 'status', label: 'ステータス', type: 'select', listable: true,
				options: [{ label: 'アクティブ', value: 'active' }, { label: '非アクティブ', value: 'inactive' }]
			},
			{ key: 'notes', label: '備考', type: 'textarea' }
		]
	},
	contacts: {
		id: 'contacts', label: '担当者', icon: 'user', isCore: true,
		fields: [
			{ key: 'name', label: '氏名', type: 'text', required: true, listable: true },
			{ key: 'customerId', label: '顧客', type: 'recordSelect', required: true, listable: true, refTable: 'customers' },
			{ key: 'email', label: 'メール', type: 'email', listable: true },
			{ key: 'phone', label: '電話番号', type: 'tel' },
			{ key: 'role', label: '役職', type: 'text', listable: true },
			{ key: 'department', label: '部署', type: 'text' },
			{ key: 'notes', label: '備考', type: 'textarea' }
		]
	},
	deals: {
		id: 'deals', label: '案件', icon: 'briefcase', isCore: true,
		fields: [
			{ key: 'title', label: '案件タイトル', type: 'text', required: true, listable: true },
			{ key: 'customerId', label: '顧客ID', type: 'text', required: true },
			{ key: 'amount', label: '金額', type: 'number', listable: true },
			{
				key: 'status', label: 'ステータス', type: 'select', listable: true,
				options: [{ label: '商談中', value: 'open' }, { label: '受注', value: 'won' }, { label: '失注', value: 'lost' }]
			},
			{ key: 'plannedStart', label: '開始予定日', type: 'date' },
			{ key: 'plannedEnd', label: '終了予定日', type: 'date' },
			{ key: 'notes', label: '備考', type: 'textarea' }
		]
	},
	activities: {
		id: 'activities', label: '活動履歴', icon: 'clipboard', isCore: true,
		fields: [
			{
				key: 'entityType', label: '対象種別', type: 'select', required: true, listable: true,
				options: [
					{ label: '顧客', value: 'customer' }, { label: '担当者', value: 'contact' },
					{ label: '案件', value: 'deal' }, { label: 'エンティティ', value: 'entity' }
				]
			},
			{ key: 'entityId', label: '対象ID', type: 'text', required: true },
			{
				key: 'type', label: '種類', type: 'select', required: true, listable: true,
				options: [
					{ label: 'メモ', value: 'note' }, { label: '電話', value: 'call' },
					{ label: 'メール', value: 'email' }, { label: '面談', value: 'meeting' }
				]
			},
			{ key: 'content', label: '内容', type: 'textarea', required: true, listable: true }
		]
	}
};

// Keep for backwards compatibility with MCP tools
export const CORE_TABLE_INFO = CORE_TABLE_BASE;

const CORE_COLUMN_KEYS: Record<string, string[]> = {
	customers: ['name', 'email', 'phone', 'postalCode', 'address', 'website', 'status', 'notes'],
	contacts: ['customerId', 'name', 'email', 'phone', 'role', 'department', 'notes'],
	deals: ['customerId', 'title', 'amount', 'status', 'plannedStart', 'plannedEnd', 'notes'],
	activities: ['entityType', 'entityId', 'type', 'content']
};

const SYSTEM_KEYS = new Set(['id', 'createdAt', 'updatedAt', 'entityTypeId']);

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
		options: JSON.parse(f.options ?? '[]'), listable: true, isCustom: true
	}));
}

export async function updateCoreCustomFields(db: Db, tableName: string, fields: EditableField[]): Promise<void> {
	await db.delete(coreCustomFields).where(eq(coreCustomFields.tableName, tableName));
	for (let i = 0; i < fields.length; i++) {
		const f = fields[i];
		await db.insert(coreCustomFields).values({
			id: crypto.randomUUID(), tableName,
			key: f.key, label: f.label, type: f.type,
			required: f.required ?? false,
			options: JSON.stringify(f.options ?? []),
			sortOrder: i
		});
	}
}

export async function getTableInfo(db: Db, type: string): Promise<TableInfo | null> {
	if (CORE_TABLE_BASE[type]) {
		const customFields = await getCoreCustomFields(db, type);
		return {
			...CORE_TABLE_BASE[type],
			fields: [...CORE_TABLE_BASE[type].fields, ...customFields]
		};
	}

	const [et] = await db.select().from(entityTypes).where(eq(entityTypes.name, type));
	if (!et) return null;

	const fields = await db.select().from(entityFields)
		.where(eq(entityFields.entityTypeId, et.id))
		.orderBy(entityFields.sortOrder);

	return {
		id: et.name, label: et.label, icon: et.icon ?? 'table', isCore: false,
		fields: fields.map(f => ({
			key: f.key, label: f.label, type: f.type, required: f.required,
			options: JSON.parse(f.options ?? '[]'), listable: true
		}))
	};
}

export async function listAllTables(db: Db): Promise<(TableInfo & { count: number })[]> {
	const [[c1], [c2], [c3], [c4]] = await Promise.all([
		db.select({ count: sql<number>`count(*)` }).from(customers),
		db.select({ count: sql<number>`count(*)` }).from(contacts),
		db.select({ count: sql<number>`count(*)` }).from(deals),
		db.select({ count: sql<number>`count(*)` }).from(activities)
	]);

	const coreTables = [
		{ ...CORE_TABLE_BASE.customers, count: c1.count },
		{ ...CORE_TABLE_BASE.contacts, count: c2.count },
		{ ...CORE_TABLE_BASE.deals, count: c3.count },
		{ ...CORE_TABLE_BASE.activities, count: c4.count }
	];

	const customTypes = await db.select().from(entityTypes);
	const customTables = await Promise.all(
		customTypes.map(async (et) => {
			const [fields, [{ count }]] = await Promise.all([
				db.select().from(entityFields)
					.where(eq(entityFields.entityTypeId, et.id))
					.orderBy(entityFields.sortOrder),
				db.select({ count: sql<number>`count(*)` })
					.from(entities).where(eq(entities.entityTypeId, et.id))
			]);
			return {
				id: et.name, label: et.label, icon: et.icon ?? 'table', isCore: false, count,
				fields: fields.map(f => ({
					key: f.key, label: f.label, type: f.type, required: f.required,
					options: JSON.parse(f.options ?? '[]'), listable: true
				}))
			};
		})
	);

	return [...coreTables, ...customTables];
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
				id: c.id, customerId: c.customerId, name: c.name, email: c.email,
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
		return (await db.select().from(activities).orderBy(desc(activities.createdAt)).limit(limit))
			.map(a => ({
				id: a.id, entityType: a.entityType, entityId: a.entityId,
				type: a.type, content: a.content,
				...(JSON.parse(a.custom ?? '{}') as RecordRow),
				createdAt: toTs(a.createdAt)
			}));
	}

	const [et] = await db.select().from(entityTypes).where(eq(entityTypes.name, type));
	if (!et) return [];

	return (await db.select().from(entities)
		.where(eq(entities.entityTypeId, et.id))
		.orderBy(desc(entities.createdAt)).limit(limit))
		.map(e => ({
			id: e.id,
			...(JSON.parse(e.data ?? '{}') as RecordRow),
			createdAt: toTs(e.createdAt), updatedAt: toTs(e.updatedAt)
		}));
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
			id: c.id, customerId: c.customerId, name: c.name, email: c.email,
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
			id: a.id, entityType: a.entityType, entityId: a.entityId,
			type: a.type, content: a.content,
			...(JSON.parse(a.custom ?? '{}') as RecordRow),
			createdAt: toTs(a.createdAt)
		};
	}

	const [e] = await db.select().from(entities).where(eq(entities.id, id));
	if (!e) return null;
	return {
		id: e.id,
		...(JSON.parse(e.data ?? '{}') as RecordRow),
		createdAt: toTs(e.createdAt), updatedAt: toTs(e.updatedAt)
	};
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
			email: s('email'), phone: s('phone'), role: s('role'), department: s('department'),
			notes: s('notes'), custom: JSON.stringify(customData)
		});
		return (await getRecord(db, 'contacts', id))!;
	}
	if (type === 'deals') {
		const customData = extractCustomData('deals', data);
		await db.insert(deals).values({
			id, customerId: String(data.customerId ?? ''), title: String(data.title ?? ''),
			amount: n('amount'), status: (data.status as 'open' | 'won' | 'lost') ?? 'open',
			plannedStart: s('plannedStart'), plannedEnd: s('plannedEnd'),
			notes: s('notes'), custom: JSON.stringify(customData)
		});
		return (await getRecord(db, 'deals', id))!;
	}
	if (type === 'activities') {
		const customData = extractCustomData('activities', data);
		await db.insert(activities).values({
			id,
			entityType: (data.entityType as 'customer' | 'contact' | 'deal' | 'entity') ?? 'customer',
			entityId: String(data.entityId ?? ''),
			type: (data.type as 'note' | 'call' | 'email' | 'meeting') ?? 'note',
			content: String(data.content ?? ''),
			custom: JSON.stringify(customData)
		});
		return (await getRecord(db, 'activities', id))!;
	}

	const [et] = await db.select().from(entityTypes).where(eq(entityTypes.name, type));
	if (!et) throw new Error(`Table not found: ${type}`);

	const { id: _, entityTypeId: __, createdAt: ___, updatedAt: ____, ...entityData } = data;
	await db.insert(entities).values({ id, entityTypeId: et.id, data: JSON.stringify(entityData) });
	return (await getRecord(db, type, id))!;
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
			email: s('email'), phone: s('phone'), role: s('role'), department: s('department'),
			notes: s('notes'), custom: JSON.stringify(mergedCustom), updatedAt: new Date()
		}).where(eq(contacts.id, id));
		return (await getRecord(db, 'contacts', id))!;
	}
	if (type === 'deals') {
		const [existing] = await db.select({ custom: deals.custom }).from(deals).where(eq(deals.id, id));
		const existingCustom = JSON.parse(existing?.custom ?? '{}') as Record<string, unknown>;
		const mergedCustom = { ...existingCustom, ...extractCustomData('deals', data) };
		await db.update(deals).set({
			...(data.customerId != null ? { customerId: String(data.customerId) } : {}),
			...(data.title != null ? { title: String(data.title) } : {}),
			amount: n('amount'),
			...(data.status != null ? { status: data.status as 'open' | 'won' | 'lost' } : {}),
			...(data.plannedStart !== undefined ? { plannedStart: s('plannedStart') } : {}),
			...(data.plannedEnd !== undefined ? { plannedEnd: s('plannedEnd') } : {}),
			notes: s('notes'), custom: JSON.stringify(mergedCustom), updatedAt: new Date()
		}).where(eq(deals.id, id));
		return (await getRecord(db, 'deals', id))!;
	}
	if (type === 'activities') {
		const [existing] = await db.select({ custom: activities.custom }).from(activities).where(eq(activities.id, id));
		const existingCustom = JSON.parse(existing?.custom ?? '{}') as Record<string, unknown>;
		const mergedCustom = { ...existingCustom, ...extractCustomData('activities', data) };
		await db.update(activities).set({
			...(data.entityType != null ? { entityType: data.entityType as 'customer' | 'contact' | 'deal' | 'entity' } : {}),
			...(data.entityId != null ? { entityId: String(data.entityId) } : {}),
			...(data.type != null ? { type: data.type as 'note' | 'call' | 'email' | 'meeting' } : {}),
			...(data.content != null ? { content: String(data.content) } : {}),
			custom: JSON.stringify(mergedCustom)
		}).where(eq(activities.id, id));
		return (await getRecord(db, 'activities', id))!;
	}

	const { id: _, entityTypeId: __, createdAt: ___, updatedAt: ____, ...entityData } = data;
	await db.update(entities).set({
		data: JSON.stringify(entityData), updatedAt: new Date()
	}).where(eq(entities.id, id));
	return (await getRecord(db, type, id))!;
}

export async function deleteRecord(db: Db, type: string, id: string): Promise<void> {
	if (type === 'customers') { await db.delete(customers).where(eq(customers.id, id)); return; }
	if (type === 'contacts') { await db.delete(contacts).where(eq(contacts.id, id)); return; }
	if (type === 'deals') { await db.delete(deals).where(eq(deals.id, id)); return; }
	if (type === 'activities') { await db.delete(activities).where(eq(activities.id, id)); return; }
	await db.delete(entities).where(eq(entities.id, id));
}

// ── Entity type (custom table) management ──────────────────────────────────

export type EditableField = Omit<FieldDef, 'listable' | 'isCustom' | 'type'> & { _id: string; type: CustomFieldType };

export type EntityTypeInput = {
	name: string;
	label: string;
	icon?: string;
	fields: EditableField[];
};

export async function createEntityType(db: Db, input: EntityTypeInput): Promise<void> {
	if (RESERVED_NAMES.has(input.name)) {
		throw new Error(`テーブル名 "${input.name}" はシステムで予約されています。別の名前を使用してください。`);
	}
	const [existing] = await db.select({ name: entityTypes.name }).from(entityTypes).where(eq(entityTypes.name, input.name));
	if (existing) {
		throw new Error(`テーブル名 "${input.name}" はすでに使用されています。`);
	}

	const id = crypto.randomUUID();
	await db.insert(entityTypes).values({ id, name: input.name, label: input.label, icon: input.icon });
	for (let i = 0; i < input.fields.length; i++) {
		const f = input.fields[i];
		await db.insert(entityFields).values({
			id: crypto.randomUUID(), entityTypeId: id,
			key: f.key, label: f.label, type: f.type,
			required: f.required ?? false,
			options: JSON.stringify(f.options ?? []),
			sortOrder: i
		});
	}
}

export async function updateEntityType(db: Db, name: string, input: Partial<EntityTypeInput>): Promise<void> {
	const [et] = await db.select().from(entityTypes).where(eq(entityTypes.name, name));
	if (!et) throw new Error(`Table not found: ${name}`);

	if (input.label != null || input.icon != null) {
		await db.update(entityTypes).set({
			...(input.label != null ? { label: input.label } : {}),
			...(input.icon != null ? { icon: input.icon } : {})
		}).where(eq(entityTypes.id, et.id));
	}

	if (input.fields != null) {
		await db.delete(entityFields).where(eq(entityFields.entityTypeId, et.id));
		for (let i = 0; i < input.fields.length; i++) {
			const f = input.fields[i];
			await db.insert(entityFields).values({
				id: crypto.randomUUID(), entityTypeId: et.id,
				key: f.key, label: f.label, type: f.type,
				required: f.required ?? false,
				options: JSON.stringify(f.options ?? []),
				sortOrder: i
			});
		}
	}
}

export async function deleteEntityType(db: Db, name: string): Promise<void> {
	const [et] = await db.select().from(entityTypes).where(eq(entityTypes.name, name));
	if (!et) return;
	await db.delete(entities).where(eq(entities.entityTypeId, et.id));
	await db.delete(entityFields).where(eq(entityFields.entityTypeId, et.id));
	await db.delete(entityTypes).where(eq(entityTypes.id, et.id));
}
