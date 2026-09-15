import { eq, desc } from 'drizzle-orm';
import { z } from 'zod';
import type { Tool } from '@anthropic-ai/sdk/resources/messages';
import type { Db } from '../db';
import { activities } from '../db/schema';
import type { ToolEnv } from './shared';
import { parseJstDatetime } from '$lib/datetime';

export const tools: Tool[] = [
	{
		name: 'get_activities',
		description: 'Fetches the activity history for a given customer.',
		input_schema: {
			type: 'object',
			properties: {
				customer_id: { type: 'string', description: 'Customer ID' },
				limit: { type: 'number', description: 'Maximum number of results to return (default: 20)' }
			},
			required: ['customer_id']
		}
	},
	{
		name: 'create_activity',
		description: 'Records an activity history entry (note, call, email, or meeting).',
		input_schema: {
			type: 'object',
			properties: {
				customer_id: { type: 'string', description: 'Customer ID to record the activity against' },
				type: {
					type: 'string',
					enum: ['note', 'call', 'email', 'meeting', 'deal_created'],
					description:
						'Activity type (note: memo / call: phone call / email: email / meeting: in-person meeting / deal_created: deal registered)'
				},
				content: { type: 'string', description: 'Activity content (required)' },
				activity_date: {
					type: 'string',
					description:
						'Date/time the activity actually took place (JST, "YYYY-MM-DDTHH:mm" format, optional). Specify when it differs from the recorded timestamp'
				}
			},
			required: ['customer_id', 'content']
		}
	}
];

const getActivitiesSchema = z.object({
	customer_id: z.string(),
	limit: z.number().int().positive().default(20)
});

const createActivitySchema = z.object({
	customer_id: z.string(),
	type: z.enum(['note', 'call', 'email', 'meeting', 'deal_created']).default('note'),
	content: z.string().min(1),
	activity_date: z.string().optional()
});

export async function handleGetActivities(db: Db, input: unknown) {
	const { customer_id, limit } = getActivitiesSchema.parse(input);
	return db
		.select()
		.from(activities)
		.where(eq(activities.customerId, customer_id))
		.orderBy(desc(activities.createdAt))
		.limit(limit);
}

export async function handleCreateActivity(db: Db, input: unknown, env?: ToolEnv) {
	const data = createActivitySchema.parse(input);
	const id = crypto.randomUUID();
	const actDate = data.activity_date ? parseJstDatetime(data.activity_date) : null;
	await db.insert(activities).values({
		id,
		customerId: data.customer_id,
		type: data.type,
		content: data.content,
		...(actDate !== null ? { activityDate: actDate } : {}),
		createdBy: env?.accountId ?? ''
	});
	const [row] = await db.select().from(activities).where(eq(activities.id, id));
	return row;
}
