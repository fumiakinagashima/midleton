import { and, eq, like, desc, gte, lte, sql, inArray } from 'drizzle-orm';
import { z } from 'zod';
import type { Tool } from '@anthropic-ai/sdk/resources/messages';
import type { Db } from '../db';
import { customers, deals, activities } from '../db/schema';
import { parseJson, toDate } from './shared';
import {
	buildFilterConditions,
	filterConditionSchema,
	filterFieldsDescription,
	type FilterableColumn
} from './filter';

// Allowlist for the generic filter parameter (filters), which lets callers filter by an arbitrary
// column without adding a dedicated parameter for each one.
// field only accepts the keys defined here (prevents raw SQL / arbitrary column name injection)
const CUSTOMER_FILTER_FIELDS: Record<string, FilterableColumn> = {
	name: { column: customers.name, type: 'text' },
	email: { column: customers.email, type: 'text' },
	phone: { column: customers.phone, type: 'text' },
	address: { column: customers.address, type: 'text' },
	postal_code: { column: customers.postalCode, type: 'text' },
	website: { column: customers.website, type: 'text' },
	status: { column: customers.status, type: 'enum' },
	notes: { column: customers.notes, type: 'text' },
	created_at: { column: customers.createdAt, type: 'date' },
	updated_at: { column: customers.updatedAt, type: 'date' }
};

const DEAL_FILTER_FIELDS: Record<string, FilterableColumn> = {
	title: { column: deals.title, type: 'text' },
	amount: { column: deals.amount, type: 'number' },
	status: { column: deals.status, type: 'enum' },
	notes: { column: deals.notes, type: 'text' },
	created_at: { column: deals.createdAt, type: 'date' },
	closed_at: { column: deals.closedAt, type: 'date' }
};

const ACTIVITY_FILTER_FIELDS: Record<string, FilterableColumn> = {
	type: { column: activities.type, type: 'enum' },
	content: { column: activities.content, type: 'text' },
	created_at: { column: activities.createdAt, type: 'date' },
	activity_date: { column: activities.activityDate, type: 'date' }
};

const FILTERS_PROPERTY = {
	type: 'array' as const,
	description:
		'Filter conditions that cannot be expressed via the dedicated parameters like name or status (e.g. address contains "Tokyo" -> {field:"address",op:"contains",value:"Tokyo"}). When multiple are given, they are combined with AND.',
	items: {
		type: 'object' as const,
		properties: {
			field: { type: 'string' as const, description: 'Name of the field to filter on' },
			op: {
				type: 'string' as const,
				enum: ['eq', 'not', 'contains', 'gt', 'gte', 'lt', 'lte']
			},
			value: { type: 'string' as const }
		},
		required: ['field', 'op', 'value']
	}
};

export const tools: Tool[] = [
	{
		name: 'search_customers',
		description:
			'The one tool for listing/searching customers (always use this whenever you need a customer list). In addition to name and status, filters lets you filter on arbitrary columns such as address, email, or phone number. Also supports deal/activity relationship conditions that a simple filter cannot express, such as "customers with an open deal" or "customers met with this month".',
		input_schema: {
			type: 'object',
			properties: {
				name: { type: 'string', description: 'Customer name (partial match)' },
				status: { type: 'string', enum: ['active', 'inactive'] },
				has_deal_status: {
					type: 'string',
					enum: ['open', 'won', 'lost'],
					description: 'Restrict to customers with a deal in the given status'
				},
				deal_since: { type: 'string', description: 'Deal date range start (ISO 8601)' },
				deal_until: { type: 'string', description: 'Deal date range end (ISO 8601)' },
				has_activity_type: {
					type: 'string',
					enum: ['note', 'call', 'email', 'meeting', 'deal_created'],
					description: 'Restrict to customers with an activity of the given type'
				},
				activity_since: { type: 'string', description: 'Activity date range start (ISO 8601)' },
				activity_until: { type: 'string', description: 'Activity date range end (ISO 8601)' },
				filters: {
					...FILTERS_PROPERTY,
					description: `${FILTERS_PROPERTY.description} Available fields: ${filterFieldsDescription(CUSTOMER_FILTER_FIELDS)}`
				},
				limit: { type: 'number', description: 'Number of results to return (default: 50)' }
			},
			required: []
		}
	},
	{
		name: 'search_deals',
		description:
			'Searches deals with composite conditions. Offers more flexible filtering than get_deals, including customer ID, customer name (via JOIN), amount range, and date range.',
		input_schema: {
			type: 'object',
			properties: {
				customer_id: { type: 'string', description: 'Filter by customer ID' },
				customer_name: { type: 'string', description: 'Customer name (partial match)' },
				status: { type: 'string', enum: ['open', 'won', 'lost'] },
				amount_min: { type: 'number', description: 'Minimum amount (JPY)' },
				amount_max: { type: 'number', description: 'Maximum amount (JPY)' },
				since: { type: 'string', description: 'Start date (ISO 8601)' },
				until: { type: 'string', description: 'End date (ISO 8601)' },
				date_field: {
					type: 'string',
					enum: ['created_at', 'closed_at'],
					description: 'Date field used for the date range (default: created_at)'
				},
				filters: {
					...FILTERS_PROPERTY,
					description: `${FILTERS_PROPERTY.description} Available fields: ${filterFieldsDescription(DEAL_FILTER_FIELDS)}`
				},
				limit: { type: 'number', description: 'Number of results to return (default: 50)' }
			},
			required: []
		}
	},
	{
		name: 'search_activities',
		description:
			'Searches activity history with composite conditions. Can be filtered by customer_id. Also supports keyword search on content.',
		input_schema: {
			type: 'object',
			properties: {
				customer_id: { type: 'string', description: 'Filter by customer ID' },
				type: {
					type: 'string',
					enum: ['note', 'call', 'email', 'meeting', 'deal_created']
				},
				content: { type: 'string', description: 'Keyword to search for in activity content (partial match)' },
				since: { type: 'string', description: 'Start date (ISO 8601)' },
				until: { type: 'string', description: 'End date (ISO 8601)' },
				filters: {
					...FILTERS_PROPERTY,
					description: `${FILTERS_PROPERTY.description} Available fields: ${filterFieldsDescription(ACTIVITY_FILTER_FIELDS)}`
				},
				limit: { type: 'number', description: 'Number of results to return (default: 50)' }
			},
			required: []
		}
	},
	{
		name: 'summarize_deals',
		description:
			'Aggregates deals by status, with count and amount totals. Used for questions like "What is the total won this month?" or "What is the total value of open deals?". Can be filtered by date range and customer.',
		input_schema: {
			type: 'object',
			properties: {
				customer_id: { type: 'string', description: 'Restrict to a specific customer' },
				since: {
					type: 'string',
					description: 'Aggregation start date (ISO 8601 format, e.g. 2025-01-01)'
				},
				until: {
					type: 'string',
					description: 'Aggregation end date (ISO 8601 format, e.g. 2025-12-31)'
				},
				date_field: {
					type: 'string',
					enum: ['created_at', 'closed_at'],
					description: 'Date field used for the date range filter (default: created_at)'
				}
			},
			required: []
		}
	},
	{
		name: 'summarize_customers',
		description:
			'Aggregates customer counts by status (active/inactive). Used for questions like "How many customers do we have?" or "How many active customers are there?".',
		input_schema: {
			type: 'object',
			properties: {
				since: { type: 'string', description: 'Registration date range start (ISO 8601 format)' },
				until: { type: 'string', description: 'Registration date range end (ISO 8601 format)' }
			},
			required: []
		}
	},
	{
		name: 'summarize_activities',
		description:
			'Counts activity history entries by type (note/call/email/meeting/deal_created). Used for questions like "How many meetings this month?" or "How many calls were made?". Can be filtered by date range and customer.',
		input_schema: {
			type: 'object',
			properties: {
				customer_id: { type: 'string', description: 'Restrict to a specific customer' },
				since: { type: 'string', description: 'Aggregation start date (ISO 8601 format)' },
				until: { type: 'string', description: 'Aggregation end date (ISO 8601 format)' }
			},
			required: []
		}
	}
];

const searchCustomersSchema = z.object({
	name: z.string().optional(),
	status: z.enum(['active', 'inactive']).optional(),
	has_deal_status: z.enum(['open', 'won', 'lost']).optional(),
	deal_since: z.string().optional(),
	deal_until: z.string().optional(),
	has_activity_type: z
		.enum(['note', 'call', 'email', 'meeting', 'deal_created'])
		.optional(),
	activity_since: z.string().optional(),
	activity_until: z.string().optional(),
	filters: z.array(filterConditionSchema).optional(),
	limit: z.number().int().positive().default(50)
});

export async function handleSearchCustomers(db: Db, input: unknown) {
	const p = searchCustomersSchema.parse(input);
	const filterConditions = buildFilterConditions(p.filters, CUSTOMER_FILTER_FIELDS);
	const dealSub = p.has_deal_status
		? db.selectDistinct({ id: deals.customerId }).from(deals).where(
				and(
					eq(deals.status, p.has_deal_status),
					p.deal_since ? gte(deals.createdAt, toDate(p.deal_since)) : undefined,
					p.deal_until ? lte(deals.createdAt, toDate(p.deal_until)) : undefined
				)
			)
		: null;

	const actSub = p.has_activity_type
		? db.selectDistinct({ id: activities.customerId }).from(activities).where(
				and(
					eq(activities.type, p.has_activity_type),
					p.activity_since
						? gte(activities.createdAt, toDate(p.activity_since))
						: undefined,
					p.activity_until ? lte(activities.createdAt, toDate(p.activity_until)) : undefined
				)
			)
		: null;

	const rows = await db
		.select()
		.from(customers)
		.where(
			and(
				p.name ? like(customers.name, `%${p.name}%`) : undefined,
				p.status ? eq(customers.status, p.status) : undefined,
				dealSub ? inArray(customers.id, dealSub) : undefined,
				actSub ? inArray(customers.id, actSub) : undefined,
				...filterConditions
			)
		)
		.orderBy(desc(customers.createdAt))
		.limit(p.limit);

	return rows.map((r) => ({ ...r, custom: parseJson(r.custom) }));
}

const searchDealsSchema = z.object({
	customer_id: z.string().optional(),
	customer_name: z.string().optional(),
	status: z.enum(['open', 'won', 'lost']).optional(),
	amount_min: z.number().optional(),
	amount_max: z.number().optional(),
	since: z.string().optional(),
	until: z.string().optional(),
	date_field: z.enum(['created_at', 'closed_at']).default('created_at'),
	filters: z.array(filterConditionSchema).optional(),
	limit: z.number().int().positive().default(50)
});

export async function handleSearchDeals(db: Db, input: unknown) {
	const p = searchDealsSchema.parse(input);
	const dateCol = p.date_field === 'closed_at' ? deals.closedAt : deals.createdAt;
	const filterConditions = buildFilterConditions(p.filters, DEAL_FILTER_FIELDS);

	const rows = await db
		.select({
			id: deals.id,
			customerId: deals.customerId,
			customerName: customers.name,
			title: deals.title,
			amount: deals.amount,
			status: deals.status,
			closedAt: deals.closedAt,
			notes: deals.notes,
			custom: deals.custom,
			createdAt: deals.createdAt,
			updatedAt: deals.updatedAt
		})
		.from(deals)
		.leftJoin(customers, eq(deals.customerId, customers.id))
		.where(
			and(
				p.customer_id ? eq(deals.customerId, p.customer_id) : undefined,
				p.customer_name ? like(customers.name, `%${p.customer_name}%`) : undefined,
				p.status ? eq(deals.status, p.status) : undefined,
				p.amount_min !== undefined ? gte(deals.amount, p.amount_min) : undefined,
				p.amount_max !== undefined ? lte(deals.amount, p.amount_max) : undefined,
				p.since ? gte(dateCol, toDate(p.since)) : undefined,
				p.until ? lte(dateCol, toDate(p.until)) : undefined,
				...filterConditions
			)
		)
		.orderBy(desc(deals.createdAt))
		.limit(p.limit);

	return rows.map((r) => ({ ...r, custom: parseJson(r.custom) }));
}

const searchActivitiesSchema = z.object({
	customer_id: z.string().optional(),
	type: z.enum(['note', 'call', 'email', 'meeting', 'deal_created']).optional(),
	content: z.string().optional(),
	since: z.string().optional(),
	until: z.string().optional(),
	filters: z.array(filterConditionSchema).optional(),
	limit: z.number().int().positive().default(50)
});

export async function handleSearchActivities(db: Db, input: unknown) {
	const p = searchActivitiesSchema.parse(input);
	const filterConditions = buildFilterConditions(p.filters, ACTIVITY_FILTER_FIELDS);

	return db
		.select()
		.from(activities)
		.where(
			and(
				p.customer_id ? eq(activities.customerId, p.customer_id) : undefined,
				p.type ? eq(activities.type, p.type) : undefined,
				p.content ? like(activities.content, `%${p.content}%`) : undefined,
				p.since ? gte(activities.createdAt, toDate(p.since)) : undefined,
				p.until ? lte(activities.createdAt, toDate(p.until)) : undefined,
				...filterConditions
			)
		)
		.orderBy(desc(activities.createdAt))
		.limit(p.limit);
}

const summarizeDealsSchema = z.object({
	customer_id: z.string().optional(),
	since: z.string().optional(),
	until: z.string().optional(),
	date_field: z.enum(['created_at', 'closed_at']).default('created_at')
});

export async function handleSummarizeDeals(db: Db, input: unknown) {
	const { customer_id, since, until, date_field } = summarizeDealsSchema.parse(input);
	const dateCol = date_field === 'closed_at' ? deals.closedAt : deals.createdAt;

	const rows = await db
		.select({
			status: deals.status,
			count: sql<number>`cast(count(*) as integer)`,
			totalAmount: sql<number>`cast(coalesce(sum(${deals.amount}), 0) as integer)`,
			avgAmount: sql<number>`cast(coalesce(avg(${deals.amount}), 0) as integer)`
		})
		.from(deals)
		.where(
			and(
				customer_id ? eq(deals.customerId, customer_id) : undefined,
				since ? gte(dateCol, toDate(since)) : undefined,
				until ? lte(dateCol, toDate(until)) : undefined
			)
		)
		.groupBy(deals.status);

	const byStatus: Record<string, { count: number; total_amount: number; avg_amount: number }> = {};
	let totalCount = 0;
	let totalAmount = 0;
	for (const r of rows) {
		byStatus[r.status] = { count: r.count, total_amount: r.totalAmount, avg_amount: r.avgAmount };
		totalCount += r.count;
		totalAmount += r.totalAmount;
	}

	return { by_status: byStatus, total: { count: totalCount, total_amount: totalAmount } };
}

const summarizeCustomersSchema = z.object({
	since: z.string().optional(),
	until: z.string().optional()
});

export async function handleSummarizeCustomers(db: Db, input: unknown) {
	const { since, until } = summarizeCustomersSchema.parse(input);

	const rows = await db
		.select({
			status: customers.status,
			count: sql<number>`cast(count(*) as integer)`
		})
		.from(customers)
		.where(
			and(
				since ? gte(customers.createdAt, toDate(since)) : undefined,
				until ? lte(customers.createdAt, toDate(until)) : undefined
			)
		)
		.groupBy(customers.status);

	const byStatus: Record<string, number> = {};
	let total = 0;
	for (const r of rows) {
		byStatus[r.status] = r.count;
		total += r.count;
	}

	return { total, by_status: byStatus };
}

const summarizeActivitiesSchema = z.object({
	customer_id: z.string().optional(),
	since: z.string().optional(),
	until: z.string().optional()
});

export async function handleSummarizeActivities(db: Db, input: unknown) {
	const { customer_id, since, until } = summarizeActivitiesSchema.parse(input);

	const rows = await db
		.select({
			type: activities.type,
			count: sql<number>`cast(count(*) as integer)`
		})
		.from(activities)
		.where(
			and(
				customer_id ? eq(activities.customerId, customer_id) : undefined,
				since ? gte(activities.createdAt, toDate(since)) : undefined,
				until ? lte(activities.createdAt, toDate(until)) : undefined
			)
		)
		.groupBy(activities.type);

	const byType: Record<string, number> = {};
	let total = 0;
	for (const r of rows) {
		byType[r.type] = r.count;
		total += r.count;
	}

	return { total, by_type: byType };
}
