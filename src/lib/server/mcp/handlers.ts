import { and, eq, like, desc } from 'drizzle-orm';
import { z } from 'zod';
import type { Db } from '../db';
import {
	customers,
	contacts,
	deals,
	activities,
	entityTypes,
	entityFields,
	entities
} from '../db/schema';

// ── Helpers ────────────────────────────────────────────────────────────────

function parseJson(s: string | null | undefined): Record<string, unknown> {
	try {
		return JSON.parse(s ?? '{}') ?? {};
	} catch {
		return {};
	}
}

function mergeCustom(existing: string | null | undefined, incoming: unknown): string {
	const base = parseJson(existing);
	const patch = (incoming && typeof incoming === 'object' && !Array.isArray(incoming))
		? (incoming as Record<string, unknown>)
		: {};
	return JSON.stringify({ ...base, ...patch });
}

function now(): Date {
	return new Date();
}

// ── Customers ──────────────────────────────────────────────────────────────

const getCustomersSchema = z.object({
	name: z.string().optional(),
	status: z.enum(['active', 'inactive']).optional(),
	limit: z.number().int().positive().default(50)
});

const getCustomerSchema = z.object({ id: z.string() });

const createCustomerSchema = z.object({
	name: z.string().min(1),
	contact_name: z.string().optional(),
	email: z.string().optional(),
	phone: z.string().optional(),
	address: z.string().optional(),
	notes: z.string().optional(),
	custom: z.record(z.string(), z.unknown()).optional()
});

const updateCustomerSchema = z.object({
	id: z.string(),
	name: z.string().optional(),
	contact_name: z.string().optional(),
	email: z.string().optional(),
	phone: z.string().optional(),
	address: z.string().optional(),
	status: z.enum(['active', 'inactive']).optional(),
	notes: z.string().optional(),
	custom: z.record(z.string(), z.unknown()).optional()
});

const deleteCustomerSchema = z.object({ id: z.string() });

async function handleGetCustomers(db: Db, input: unknown) {
	const { name, status, limit } = getCustomersSchema.parse(input);
	const result = await db
		.select()
		.from(customers)
		.where(
			and(
				name ? like(customers.name, `%${name}%`) : undefined,
				status ? eq(customers.status, status) : undefined
			)
		)
		.orderBy(desc(customers.createdAt))
		.limit(limit);
	return result.map((r) => ({ ...r, custom: parseJson(r.custom) }));
}

async function handleGetCustomer(db: Db, input: unknown) {
	const { id } = getCustomerSchema.parse(input);
	const [row] = await db.select().from(customers).where(eq(customers.id, id));
	if (!row) throw new Error(`顧客が見つかりません: ${id}`);
	return { ...row, custom: parseJson(row.custom) };
}

async function handleCreateCustomer(db: Db, input: unknown) {
	const data = createCustomerSchema.parse(input);
	const id = crypto.randomUUID();
	await db.insert(customers).values({
		id,
		name: data.name,
		contactName: data.contact_name,
		email: data.email,
		phone: data.phone,
		address: data.address,
		notes: data.notes,
		custom: JSON.stringify(data.custom ?? {})
	});
	const [row] = await db.select().from(customers).where(eq(customers.id, id));
	return { ...row, custom: parseJson(row.custom) };
}

async function handleUpdateCustomer(db: Db, input: unknown) {
	const data = updateCustomerSchema.parse(input);
	const [existing] = await db.select().from(customers).where(eq(customers.id, data.id));
	if (!existing) throw new Error(`顧客が見つかりません: ${data.id}`);

	await db
		.update(customers)
		.set({
			...(data.name !== undefined && { name: data.name }),
			...(data.contact_name !== undefined && { contactName: data.contact_name }),
			...(data.email !== undefined && { email: data.email }),
			...(data.phone !== undefined && { phone: data.phone }),
			...(data.address !== undefined && { address: data.address }),
			...(data.status !== undefined && { status: data.status }),
			...(data.notes !== undefined && { notes: data.notes }),
			...(data.custom !== undefined && { custom: mergeCustom(existing.custom, data.custom) }),
			updatedAt: now()
		})
		.where(eq(customers.id, data.id));

	const [row] = await db.select().from(customers).where(eq(customers.id, data.id));
	return { ...row, custom: parseJson(row.custom) };
}

async function handleDeleteCustomer(db: Db, input: unknown) {
	const { id } = deleteCustomerSchema.parse(input);
	await db.delete(customers).where(eq(customers.id, id));
	return { deleted: true, id };
}

// ── Contacts ───────────────────────────────────────────────────────────────

const getContactsSchema = z.object({
	customer_id: z.string().optional(),
	limit: z.number().int().positive().default(50)
});

const createContactSchema = z.object({
	customer_id: z.string(),
	name: z.string().min(1),
	email: z.string().optional(),
	phone: z.string().optional(),
	role: z.string().optional(),
	notes: z.string().optional(),
	custom: z.record(z.string(), z.unknown()).optional()
});

const updateContactSchema = z.object({
	id: z.string(),
	name: z.string().optional(),
	email: z.string().optional(),
	phone: z.string().optional(),
	role: z.string().optional(),
	notes: z.string().optional(),
	custom: z.record(z.string(), z.unknown()).optional()
});

async function handleGetContacts(db: Db, input: unknown) {
	const { customer_id, limit } = getContactsSchema.parse(input);
	const result = await db
		.select()
		.from(contacts)
		.where(customer_id ? eq(contacts.customerId, customer_id) : undefined)
		.orderBy(desc(contacts.createdAt))
		.limit(limit);
	return result.map((r) => ({ ...r, custom: parseJson(r.custom) }));
}

async function handleCreateContact(db: Db, input: unknown) {
	const data = createContactSchema.parse(input);
	const id = crypto.randomUUID();
	await db.insert(contacts).values({
		id,
		customerId: data.customer_id,
		name: data.name,
		email: data.email,
		phone: data.phone,
		role: data.role,
		notes: data.notes,
		custom: JSON.stringify(data.custom ?? {})
	});
	const [row] = await db.select().from(contacts).where(eq(contacts.id, id));
	return { ...row, custom: parseJson(row.custom) };
}

async function handleUpdateContact(db: Db, input: unknown) {
	const data = updateContactSchema.parse(input);
	const [existing] = await db.select().from(contacts).where(eq(contacts.id, data.id));
	if (!existing) throw new Error(`担当者が見つかりません: ${data.id}`);

	await db
		.update(contacts)
		.set({
			...(data.name !== undefined && { name: data.name }),
			...(data.email !== undefined && { email: data.email }),
			...(data.phone !== undefined && { phone: data.phone }),
			...(data.role !== undefined && { role: data.role }),
			...(data.notes !== undefined && { notes: data.notes }),
			...(data.custom !== undefined && { custom: mergeCustom(existing.custom, data.custom) }),
			updatedAt: now()
		})
		.where(eq(contacts.id, data.id));

	const [row] = await db.select().from(contacts).where(eq(contacts.id, data.id));
	return { ...row, custom: parseJson(row.custom) };
}

// ── Deals ──────────────────────────────────────────────────────────────────

const getDealsSchema = z.object({
	customer_id: z.string().optional(),
	status: z.enum(['open', 'won', 'lost']).optional(),
	limit: z.number().int().positive().default(50)
});

const createDealSchema = z.object({
	customer_id: z.string(),
	title: z.string().min(1),
	amount: z.number().int().optional(),
	status: z.enum(['open', 'won', 'lost']).default('open'),
	notes: z.string().optional(),
	custom: z.record(z.string(), z.unknown()).optional()
});

const updateDealSchema = z.object({
	id: z.string(),
	title: z.string().optional(),
	amount: z.number().int().optional(),
	status: z.enum(['open', 'won', 'lost']).optional(),
	notes: z.string().optional(),
	custom: z.record(z.string(), z.unknown()).optional()
});

async function handleGetDeals(db: Db, input: unknown) {
	const { customer_id, status, limit } = getDealsSchema.parse(input);
	const result = await db
		.select()
		.from(deals)
		.where(
			and(
				customer_id ? eq(deals.customerId, customer_id) : undefined,
				status ? eq(deals.status, status) : undefined
			)
		)
		.orderBy(desc(deals.createdAt))
		.limit(limit);
	return result.map((r) => ({ ...r, custom: parseJson(r.custom) }));
}

async function handleCreateDeal(db: Db, input: unknown) {
	const data = createDealSchema.parse(input);
	const id = crypto.randomUUID();
	await db.insert(deals).values({
		id,
		customerId: data.customer_id,
		title: data.title,
		amount: data.amount,
		status: data.status,
		notes: data.notes,
		custom: JSON.stringify(data.custom ?? {})
	});
	const [row] = await db.select().from(deals).where(eq(deals.id, id));
	return { ...row, custom: parseJson(row.custom) };
}

async function handleUpdateDeal(db: Db, input: unknown) {
	const data = updateDealSchema.parse(input);
	const [existing] = await db.select().from(deals).where(eq(deals.id, data.id));
	if (!existing) throw new Error(`案件が見つかりません: ${data.id}`);

	const closedAt =
		data.status === 'won' || data.status === 'lost'
			? now()
			: data.status === 'open'
				? null
				: undefined;

	await db
		.update(deals)
		.set({
			...(data.title !== undefined && { title: data.title }),
			...(data.amount !== undefined && { amount: data.amount }),
			...(data.status !== undefined && { status: data.status }),
			...(data.notes !== undefined && { notes: data.notes }),
			...(data.custom !== undefined && { custom: mergeCustom(existing.custom, data.custom) }),
			...(closedAt !== undefined && { closedAt }),
			updatedAt: now()
		})
		.where(eq(deals.id, data.id));

	const [row] = await db.select().from(deals).where(eq(deals.id, data.id));
	return { ...row, custom: parseJson(row.custom) };
}

// ── Activities ─────────────────────────────────────────────────────────────

const getActivitiesSchema = z.object({
	entity_id: z.string(),
	entity_type: z.enum(['customer', 'contact', 'deal', 'entity']),
	limit: z.number().int().positive().default(20)
});

const createActivitySchema = z.object({
	entity_id: z.string(),
	entity_type: z.enum(['customer', 'contact', 'deal', 'entity']),
	type: z.enum(['note', 'call', 'email', 'meeting']).default('note'),
	content: z.string().min(1)
});

async function handleGetActivities(db: Db, input: unknown) {
	const { entity_id, entity_type, limit } = getActivitiesSchema.parse(input);
	return db
		.select()
		.from(activities)
		.where(
			and(eq(activities.entityId, entity_id), eq(activities.entityType, entity_type))
		)
		.orderBy(desc(activities.createdAt))
		.limit(limit);
}

async function handleCreateActivity(db: Db, input: unknown) {
	const data = createActivitySchema.parse(input);
	const id = crypto.randomUUID();
	await db.insert(activities).values({
		id,
		entityId: data.entity_id,
		entityType: data.entity_type,
		type: data.type,
		content: data.content
	});
	const [row] = await db.select().from(activities).where(eq(activities.id, id));
	return row;
}

// ── User-defined entity types ──────────────────────────────────────────────

const createEntityTypeSchema = z.object({
	name: z.string().min(1).regex(/^[a-z0-9_]+$/, '英小文字・数字・アンダースコアのみ使用可'),
	label: z.string().min(1),
	icon: z.string().optional()
});

const getEntityFieldsSchema = z.object({ entity_type_id: z.string() });

const addEntityFieldSchema = z.object({
	entity_type_id: z.string(),
	key: z.string().min(1).regex(/^[a-z0-9_]+$/),
	label: z.string().min(1),
	type: z.enum(['text', 'number', 'select', 'date', 'email', 'tel', 'textarea']).default('text'),
	required: z.boolean().default(false),
	options: z
		.array(z.object({ value: z.string(), label: z.string() }))
		.optional()
		.default([])
});

const getEntitiesSchema = z.object({
	entity_type_id: z.string(),
	limit: z.number().int().positive().default(50)
});

const createEntitySchema = z.object({
	entity_type_id: z.string(),
	data: z.record(z.string(), z.unknown())
});

const updateEntitySchema = z.object({
	id: z.string(),
	data: z.record(z.string(), z.unknown())
});

async function handleListEntityTypes(db: Db) {
	return db.select().from(entityTypes).orderBy(entityTypes.label);
}

async function handleGetEntityFields(db: Db, input: unknown) {
	const { entity_type_id } = getEntityFieldsSchema.parse(input);
	return db
		.select()
		.from(entityFields)
		.where(eq(entityFields.entityTypeId, entity_type_id))
		.orderBy(entityFields.sortOrder, entityFields.createdAt)
		.then((rows) => rows.map((r) => ({ ...r, options: parseJson(r.options) })));
}

async function handleCreateEntityType(db: Db, input: unknown) {
	const data = createEntityTypeSchema.parse(input);
	const id = crypto.randomUUID();
	await db.insert(entityTypes).values({ id, name: data.name, label: data.label, icon: data.icon });
	const [row] = await db.select().from(entityTypes).where(eq(entityTypes.id, id));
	return row;
}

async function handleAddEntityField(db: Db, input: unknown) {
	const data = addEntityFieldSchema.parse(input);
	const [type] = await db
		.select()
		.from(entityTypes)
		.where(eq(entityTypes.id, data.entity_type_id));
	if (!type) throw new Error(`エンティティ種別が見つかりません: ${data.entity_type_id}`);

	const [maxRow] = await db
		.select({ sortOrder: entityFields.sortOrder })
		.from(entityFields)
		.where(eq(entityFields.entityTypeId, data.entity_type_id))
		.orderBy(desc(entityFields.sortOrder))
		.limit(1);
	const sortOrder = (maxRow?.sortOrder ?? -1) + 1;

	const id = crypto.randomUUID();
	await db.insert(entityFields).values({
		id,
		entityTypeId: data.entity_type_id,
		key: data.key,
		label: data.label,
		type: data.type,
		required: data.required,
		options: JSON.stringify(data.options),
		sortOrder
	});
	const [row] = await db.select().from(entityFields).where(eq(entityFields.id, id));
	return { ...row, options: parseJson(row.options) };
}

async function handleGetEntities(db: Db, input: unknown) {
	const { entity_type_id, limit } = getEntitiesSchema.parse(input);
	const rows = await db
		.select()
		.from(entities)
		.where(eq(entities.entityTypeId, entity_type_id))
		.orderBy(desc(entities.createdAt))
		.limit(limit);
	return rows.map((r) => ({ ...r, data: parseJson(r.data) }));
}

async function handleCreateEntity(db: Db, input: unknown) {
	const { entity_type_id, data } = createEntitySchema.parse(input);
	const id = crypto.randomUUID();
	await db.insert(entities).values({ id, entityTypeId: entity_type_id, data: JSON.stringify(data) });
	const [row] = await db.select().from(entities).where(eq(entities.id, id));
	return { ...row, data: parseJson(row.data) };
}

async function handleUpdateEntity(db: Db, input: unknown) {
	const { id, data } = updateEntitySchema.parse(input);
	const [existing] = await db.select().from(entities).where(eq(entities.id, id));
	if (!existing) throw new Error(`レコードが見つかりません: ${id}`);

	const merged = JSON.stringify({ ...parseJson(existing.data), ...data });
	await db.update(entities).set({ data: merged, updatedAt: now() }).where(eq(entities.id, id));
	const [row] = await db.select().from(entities).where(eq(entities.id, id));
	return { ...row, data: parseJson(row.data) };
}

// ── Dispatch ───────────────────────────────────────────────────────────────

export type ToolName =
	| 'get_customers'
	| 'get_customer'
	| 'create_customer'
	| 'update_customer'
	| 'delete_customer'
	| 'get_contacts'
	| 'create_contact'
	| 'update_contact'
	| 'get_deals'
	| 'create_deal'
	| 'update_deal'
	| 'get_activities'
	| 'create_activity'
	| 'list_entity_types'
	| 'get_entity_fields'
	| 'create_entity_type'
	| 'add_entity_field'
	| 'get_entities'
	| 'create_entity'
	| 'update_entity';

export async function dispatchTool(db: Db, name: ToolName, input: unknown) {
	switch (name) {
		case 'get_customers':      return handleGetCustomers(db, input);
		case 'get_customer':       return handleGetCustomer(db, input);
		case 'create_customer':    return handleCreateCustomer(db, input);
		case 'update_customer':    return handleUpdateCustomer(db, input);
		case 'delete_customer':    return handleDeleteCustomer(db, input);
		case 'get_contacts':       return handleGetContacts(db, input);
		case 'create_contact':     return handleCreateContact(db, input);
		case 'update_contact':     return handleUpdateContact(db, input);
		case 'get_deals':          return handleGetDeals(db, input);
		case 'create_deal':        return handleCreateDeal(db, input);
		case 'update_deal':        return handleUpdateDeal(db, input);
		case 'get_activities':     return handleGetActivities(db, input);
		case 'create_activity':    return handleCreateActivity(db, input);
		case 'list_entity_types':  return handleListEntityTypes(db);
		case 'get_entity_fields':  return handleGetEntityFields(db, input);
		case 'create_entity_type': return handleCreateEntityType(db, input);
		case 'add_entity_field':   return handleAddEntityField(db, input);
		case 'get_entities':       return handleGetEntities(db, input);
		case 'create_entity':      return handleCreateEntity(db, input);
		case 'update_entity':      return handleUpdateEntity(db, input);
		default:
			throw new Error(`Unknown tool: ${name}`);
	}
}
