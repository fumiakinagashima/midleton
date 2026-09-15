import { and, eq, desc } from 'drizzle-orm';
import { z } from 'zod';
import type { Tool } from '@anthropic-ai/sdk/resources/messages';
import type { Db } from '../db';
import { deals } from '../db/schema';
import { dealRegisteredActivityInsert } from '../db/table-service';
import { parseJson, mergeCustom, now, type ToolEnv } from './shared';

export const tools: Tool[] = [
	{
		name: 'get_deals',
		description: 'Fetches the deal list. Can be filtered by customer ID or status.',
		input_schema: {
			type: 'object',
			properties: {
				customer_id: { type: 'string', description: 'Filter by customer ID' },
				status: {
					type: 'string',
					enum: ['open', 'won', 'lost'],
					description: 'Filter by status'
				},
				limit: { type: 'number', description: 'Maximum number of results to return (default: 50)' }
			},
			required: []
		}
	},
	{
		name: 'create_deal',
		description: 'Registers a deal. Customer ID is required.',
		input_schema: {
			type: 'object',
			properties: {
				customer_id: { type: 'string', description: 'Customer ID (required)' },
				title: { type: 'string', description: 'Deal title (required)' },
				amount: { type: 'number', description: 'Amount (JPY)' },
				status: {
					type: 'string',
					enum: ['open', 'won', 'lost'],
					description: 'Status (default: open)'
				},
				notes: { type: 'string', description: 'Notes' },
				custom: { type: 'object', description: 'Custom fields' }
			},
			required: ['customer_id', 'title']
		}
	},
	{
		name: 'update_deal',
		description: 'Updates deal information. Also used to change status (won, lost, etc.).',
		input_schema: {
			type: 'object',
			properties: {
				id: { type: 'string', description: 'Deal ID (required)' },
				title: { type: 'string', description: 'Deal title' },
				amount: { type: 'number', description: 'Amount (JPY)' },
				status: { type: 'string', enum: ['open', 'won', 'lost'], description: 'Status' },
				notes: { type: 'string', description: 'Notes' },
				custom: { type: 'object', description: 'Custom fields (merged with existing data)' }
			},
			required: ['id']
		}
	}
];

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

export async function handleGetDeals(db: Db, input: unknown) {
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

export async function handleCreateDeal(db: Db, input: unknown, env?: ToolEnv) {
	const data = createDealSchema.parse(input);
	const id = crypto.randomUUID();
	await db.batch([
		db.insert(deals).values({
			id,
			customerId: data.customer_id,
			title: data.title,
			amount: data.amount,
			status: data.status,
			notes: data.notes,
			custom: JSON.stringify(data.custom ?? {})
		}),
		dealRegisteredActivityInsert(db, data.customer_id, data.title, env?.accountId)
	]);
	const [row] = await db.select().from(deals).where(eq(deals.id, id));
	return { ...row, custom: parseJson(row.custom) };
}

export async function handleUpdateDeal(db: Db, input: unknown) {
	const data = updateDealSchema.parse(input);
	const [existing] = await db.select().from(deals).where(eq(deals.id, data.id));
	if (!existing) throw new Error(`Deal not found: ${data.id}`);

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
