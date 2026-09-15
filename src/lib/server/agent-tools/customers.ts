import { and, eq, like, desc, sql } from 'drizzle-orm';
import { z } from 'zod';
import type { Tool } from '@anthropic-ai/sdk/resources/messages';
import type { Db } from '../db';
import { customers, contacts, deals, activities } from '../db/schema';
import { computeCustomerHealthScore, getCachedCustomerHealthScore } from '../ai/customer-health';
import { computeCustomerHandoverSummary } from '../ai/customer-handover';
import { parseJson, mergeCustom, now, type ToolEnv } from './shared';

export const tools: Tool[] = [
	{
		name: 'get_customer_detail',
		description:
			'Fetches full customer detail (basic info, contacts, deals, and activity history) in one call. Search by name (partial match) or ID.',
		input_schema: {
			type: 'object',
			properties: {
				id: { type: 'string', description: 'Customer ID (specify either id or name)' },
				name: {
					type: 'string',
					description: 'Customer name (partial match) (specify either id or name)'
				},
				activities_limit: { type: 'number', description: 'Number of activity history records to fetch (default: 10)' }
			},
			required: []
		}
	},
	{
		name: 'get_customer_health_score',
		description:
			'Fetches a customer\'s health score (an AI-assessed rating of relationship health on a 0-100 scale). Search by name (partial match) or ID. Used for questions like "What is Acme Corp\'s health score?" or "Is our relationship with X in good shape?". The result is cached in the DB and, normally, the cached value is returned immediately (a new calculation is only run if none exists yet). Set force to true to refresh with the latest calculation.',
		input_schema: {
			type: 'object',
			properties: {
				id: { type: 'string', description: 'Customer ID (specify either id or name)' },
				name: {
					type: 'string',
					description: 'Customer name (partial match) (specify either id or name)'
				},
				force: {
					type: 'boolean',
					description: 'If true, ignore the cache and recompute (default: false)'
				}
			},
			required: []
		}
	},
	{
		name: 'get_customer_health_ranking',
		description:
			'Ranks customers whose health score has already been computed, from highest to lowest score (or vice versa). Used for questions like "Which company has the highest/lowest health score?". Customers without a computed score are excluded; only their count is shown via uncomputedCount / uncomputedNames (to see an uncomputed customer\'s score, call get_customer_health_score individually).',
		input_schema: {
			type: 'object',
			properties: {
				order: {
					type: 'string',
					enum: ['asc', 'desc'],
					description: 'Sort order (default: desc = highest first)'
				},
				limit: { type: 'number', description: 'Maximum number of results to return (default: 5)' }
			},
			required: []
		}
	},
	{
		name: 'get_customer_handover_summary',
		description:
			'Has AI summarize the history with a customer (deals and activity history) to generate a handover summary and points of attention for a rep handoff. Search by name (partial match) or ID. Used for requests like "Create handover materials for Acme Corp" or "Summarize our interactions with Acme Corp". Not cached, so it is generated fresh each time and may take a while. attentionItems includes link info (sourceType, sourceId) pointing to the underlying deals/activity history that back each point.',
		input_schema: {
			type: 'object',
			properties: {
				id: { type: 'string', description: 'Customer ID (specify either id or name)' },
				name: {
					type: 'string',
					description: 'Customer name (partial match) (specify either id or name)'
				}
			},
			required: []
		}
	},
	{
		name: 'get_customers',
		description: 'Fetches the customer list. Can be filtered by name and status.',
		input_schema: {
			type: 'object',
			properties: {
				name: { type: 'string', description: 'Customer name (partial match)' },
				status: {
					type: 'string',
					enum: ['active', 'inactive'],
					description: 'Filter by status'
				},
				limit: { type: 'number', description: 'Maximum number of results to return (default: 50)' }
			},
			required: []
		}
	},
	{
		name: 'get_customer',
		description: 'Fetches a single customer by ID.',
		input_schema: {
			type: 'object',
			properties: { id: { type: 'string', description: 'Customer ID' } },
			required: ['id']
		}
	},
	{
		name: 'create_customer',
		description: 'Registers a new customer.',
		input_schema: {
			type: 'object',
			properties: {
				name: { type: 'string', description: 'Company name (required)' },
				email: { type: 'string', description: 'Email address' },
				phone: { type: 'string', description: 'Phone number' },
				postal_code: { type: 'string', description: 'Postal code' },
				address: { type: 'string', description: 'Address' },
				website: { type: 'string', description: 'Website URL' },
				notes: { type: 'string', description: 'Notes' },
				custom: { type: 'object', description: 'Custom fields (arbitrary key/value pairs)' }
			},
			required: ['name']
		}
	},
	{
		name: 'update_customer',
		description: 'Updates an existing customer. Only the specified fields are updated.',
		input_schema: {
			type: 'object',
			properties: {
				id: { type: 'string', description: 'Customer ID (required)' },
				name: { type: 'string', description: 'Company name' },
				email: { type: 'string', description: 'Email address' },
				phone: { type: 'string', description: 'Phone number' },
				postal_code: { type: 'string', description: 'Postal code' },
				address: { type: 'string', description: 'Address' },
				website: { type: 'string', description: 'Website URL' },
				status: { type: 'string', enum: ['active', 'inactive'], description: 'Status' },
				notes: { type: 'string', description: 'Notes' },
				custom: {
					type: 'object',
					description: 'Custom fields (merged with existing data)'
				}
			},
			required: ['id']
		}
	},
	{
		name: 'delete_customer',
		description: 'Deletes a customer.',
		input_schema: {
			type: 'object',
			properties: { id: { type: 'string', description: 'Customer ID' } },
			required: ['id']
		}
	},
	{
		name: 'create_customer_with_contact',
		description:
			'Registers a new customer (company) together with a contact at that company at the same time. Used to register a company and its contact together from business card information, etc.',
		input_schema: {
			type: 'object',
			properties: {
				name: { type: 'string', description: 'Company name (required)' },
				email: { type: 'string', description: 'Email address (shared by the company and contact)' },
				phone: { type: 'string', description: 'Phone number (shared by the company and contact)' },
				address: { type: 'string', description: 'Address' },
				website: { type: 'string', description: 'Website URL' },
				notes: { type: 'string', description: 'Notes' },
				contact_name: { type: 'string', description: 'Contact name (required)' },
				contact_name_kana: { type: 'string', description: 'Contact name reading (kana)' },
				contact_role: { type: 'string', description: 'Contact\'s job title' },
				contact_department: { type: 'string', description: 'Contact\'s department' },
				custom: { type: 'object', description: 'Custom fields (customer side, arbitrary key/value pairs)' }
			},
			required: ['name', 'contact_name']
		}
	}
];

const getCustomerDetailSchema = z.object({
	id: z.string().optional(),
	name: z.string().optional(),
	activities_limit: z.number().int().positive().default(10)
});

async function resolveCustomerByIdOrName(db: Db, id?: string, name?: string) {
	if (!id && !name) throw new Error('Please specify either id or name');
	if (id) {
		const [row] = await db.select().from(customers).where(eq(customers.id, id));
		if (!row) throw new Error(`Customer not found: ${id}`);
		return row;
	}
	const rows = await db
		.select()
		.from(customers)
		.where(like(customers.name, `%${name}%`))
		.limit(1);
	if (!rows[0]) throw new Error(`Customer not found: ${name}`);
	return rows[0];
}

export async function handleGetCustomerDetail(db: Db, input: unknown) {
	const { id, name, activities_limit } = getCustomerDetailSchema.parse(input);
	const customer = await resolveCustomerByIdOrName(db, id, name);

	const [customerContacts, customerDeals, customerActivities] = await Promise.all([
		db
			.select()
			.from(contacts)
			.where(eq(contacts.customerId, customer.id))
			.orderBy(desc(contacts.createdAt)),
		db
			.select()
			.from(deals)
			.where(eq(deals.customerId, customer.id))
			.orderBy(desc(deals.createdAt)),
		db
			.select()
			.from(activities)
			.where(eq(activities.customerId, customer.id))
			.orderBy(desc(sql`COALESCE(${activities.activityDate}, ${activities.createdAt})`))
			.limit(activities_limit)
	]);

	return {
		...customer,
		custom: parseJson(customer.custom),
		contacts: customerContacts.map((r) => ({ ...r, custom: parseJson(r.custom) })),
		deals: customerDeals.map((r) => ({ ...r, custom: parseJson(r.custom) })),
		activities: customerActivities
	};
}

const getCustomerHealthScoreSchema = z.object({
	id: z.string().optional(),
	name: z.string().optional(),
	force: z.boolean().optional().default(false)
});

export async function handleGetCustomerHealthScore(db: Db, input: unknown, env?: ToolEnv) {
	const { id, name, force } = getCustomerHealthScoreSchema.parse(input);
	const customer = await resolveCustomerByIdOrName(db, id, name);

	if (!force) {
		const cached = getCachedCustomerHealthScore(customer);
		if (cached) {
			return {
				id: customer.id,
				name: customer.name,
				...cached,
				updatedAt: cached.updatedAt.toISOString(),
				cached: true
			};
		}
	}

	const apiKey = env?.ANTHROPIC_API_KEY;
	if (!apiKey) throw new Error('ANTHROPIC_API_KEY is not set.');

	const result = await computeCustomerHealthScore(db, customer, apiKey);
	return {
		id: customer.id,
		name: customer.name,
		...result,
		updatedAt: result.updatedAt.toISOString(),
		cached: false
	};
}

const getCustomerHealthRankingSchema = z.object({
	order: z.enum(['asc', 'desc']).optional().default('desc'),
	limit: z.number().int().positive().optional().default(5)
});

export async function handleGetCustomerHealthRanking(db: Db, input: unknown) {
	const { order, limit } = getCustomerHealthRankingSchema.parse(input);
	const rows = await db.select().from(customers);

	const ranked: {
		id: string;
		name: string;
		score: number;
		level: string;
		summary: string;
		updatedAt: string;
	}[] = [];
	const uncomputedNames: string[] = [];

	for (const customer of rows) {
		const cached = getCachedCustomerHealthScore(customer);
		if (cached) {
			ranked.push({
				id: customer.id,
				name: customer.name,
				score: cached.score,
				level: cached.level,
				summary: cached.summary,
				updatedAt: cached.updatedAt.toISOString()
			});
		} else {
			uncomputedNames.push(customer.name);
		}
	}

	ranked.sort((a, b) => (order === 'asc' ? a.score - b.score : b.score - a.score));

	return {
		ranking: ranked.slice(0, limit),
		uncomputedCount: uncomputedNames.length,
		uncomputedNames
	};
}

const getCustomerHandoverSummarySchema = z.object({
	id: z.string().optional(),
	name: z.string().optional()
});

export async function handleGetCustomerHandoverSummary(db: Db, input: unknown, env?: ToolEnv) {
	const { id, name } = getCustomerHandoverSummarySchema.parse(input);
	const customer = await resolveCustomerByIdOrName(db, id, name);

	const apiKey = env?.ANTHROPIC_API_KEY;
	if (!apiKey) throw new Error('ANTHROPIC_API_KEY is not set.');

	const result = await computeCustomerHandoverSummary(db, customer, apiKey);
	return { id: customer.id, name: customer.name, ...result };
}

const getCustomersSchema = z.object({
	name: z.string().optional(),
	status: z.enum(['active', 'inactive']).optional(),
	limit: z.number().int().positive().default(50)
});

const getCustomerSchema = z.object({ id: z.string() });

const createCustomerSchema = z.object({
	name: z.string().min(1),
	email: z.string().optional(),
	phone: z.string().optional(),
	postal_code: z.string().optional(),
	address: z.string().optional(),
	website: z.string().optional(),
	notes: z.string().optional(),
	custom: z.record(z.string(), z.unknown()).optional()
});

const updateCustomerSchema = z.object({
	id: z.string(),
	name: z.string().optional(),
	email: z.string().optional(),
	phone: z.string().optional(),
	postal_code: z.string().optional(),
	address: z.string().optional(),
	website: z.string().optional(),
	status: z.enum(['active', 'inactive']).optional(),
	notes: z.string().optional(),
	custom: z.record(z.string(), z.unknown()).optional()
});

const deleteCustomerSchema = z.object({ id: z.string() });

const createCustomerWithContactSchema = z.object({
	name: z.string().min(1),
	email: z.string().optional(),
	phone: z.string().optional(),
	address: z.string().optional(),
	website: z.string().optional(),
	notes: z.string().optional(),
	contact_name: z.string().min(1),
	contact_name_kana: z.string().optional(),
	contact_role: z.string().optional(),
	contact_department: z.string().optional(),
	custom: z.record(z.string(), z.unknown()).optional()
});

export async function handleGetCustomers(db: Db, input: unknown) {
	const { name, status, limit } = getCustomersSchema.parse(input);
	const rows = await db
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
	return rows.map((r) => ({ ...r, custom: parseJson(r.custom) }));
}

export async function handleGetCustomer(db: Db, input: unknown) {
	const { id } = getCustomerSchema.parse(input);
	const [row] = await db.select().from(customers).where(eq(customers.id, id));
	if (!row) throw new Error(`Customer not found: ${id}`);
	return { ...row, custom: parseJson(row.custom) };
}

export async function handleCreateCustomer(db: Db, input: unknown) {
	const data = createCustomerSchema.parse(input);
	const id = crypto.randomUUID();
	await db.insert(customers).values({
		id,
		name: data.name,
		email: data.email,
		phone: data.phone,
		postalCode: data.postal_code,
		address: data.address,
		website: data.website,
		notes: data.notes,
		custom: JSON.stringify(data.custom ?? {})
	});
	const [row] = await db.select().from(customers).where(eq(customers.id, id));
	return { ...row, custom: parseJson(row.custom) };
}

export async function handleUpdateCustomer(db: Db, input: unknown) {
	const data = updateCustomerSchema.parse(input);
	const [existing] = await db.select().from(customers).where(eq(customers.id, data.id));
	if (!existing) throw new Error(`Customer not found: ${data.id}`);

	await db
		.update(customers)
		.set({
			...(data.name !== undefined && { name: data.name }),
			...(data.email !== undefined && { email: data.email }),
			...(data.phone !== undefined && { phone: data.phone }),
			...(data.postal_code !== undefined && { postalCode: data.postal_code }),
			...(data.address !== undefined && { address: data.address }),
			...(data.website !== undefined && { website: data.website }),
			...(data.status !== undefined && { status: data.status }),
			...(data.notes !== undefined && { notes: data.notes }),
			...(data.custom !== undefined && { custom: mergeCustom(existing.custom, data.custom) }),
			updatedAt: now()
		})
		.where(eq(customers.id, data.id));

	const [row] = await db.select().from(customers).where(eq(customers.id, data.id));
	return { ...row, custom: parseJson(row.custom) };
}

export async function handleDeleteCustomer(db: Db, input: unknown) {
	const { id } = deleteCustomerSchema.parse(input);
	await db.delete(customers).where(eq(customers.id, id));
	return { deleted: true, id };
}

export async function handleCreateCustomerWithContact(db: Db, input: unknown) {
	const data = createCustomerWithContactSchema.parse(input);

	const customerId = crypto.randomUUID();
	const contactId = crypto.randomUUID();
	await db.batch([
		db.insert(customers).values({
			id: customerId,
			name: data.name,
			email: data.email,
			phone: data.phone,
			address: data.address,
			website: data.website,
			notes: data.notes,
			custom: JSON.stringify(data.custom ?? {})
		}),
		db.insert(contacts).values({
			id: contactId,
			customerId,
			name: data.contact_name,
			nameKana: data.contact_name_kana,
			email: data.email,
			phone: data.phone,
			role: data.contact_role,
			department: data.contact_department,
			custom: JSON.stringify({})
		})
	]);

	const [customer] = await db.select().from(customers).where(eq(customers.id, customerId));
	const [contact] = await db.select().from(contacts).where(eq(contacts.id, contactId));
	return {
		customer: { ...customer, custom: parseJson(customer.custom) },
		contact: { ...contact, custom: parseJson(contact.custom) }
	};
}
