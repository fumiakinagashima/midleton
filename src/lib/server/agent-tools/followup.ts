import { z } from 'zod';
import type { Tool } from '@anthropic-ai/sdk/resources/messages';
import type { Db } from '../db';
import { customers } from '../db/schema';
import { eq, like, or } from 'drizzle-orm';
import { computeCustomerFollowupSingle, computeCustomerFollowupList } from '../ai/customer-followup';
import type { ToolEnv } from './shared';

export const tools: Tool[] = [
	{
		name: 'suggest_customer_followup',
		description:
			'Has AI analyze a customer\'s deals and activity history to suggest follow-up actions. ' +
			'If a customer name or ID is given, returns detailed suggestions for that customer; otherwise returns a list of customers who need follow-up. ' +
			'Used for requests like "Which companies need follow-up this week?" or "Suggest the next action for Acme Corp".',
		input_schema: {
			type: 'object',
			properties: {
				customer_id: {
					type: 'string',
					description:
						'Customer ID (specify either id or name, or omit both for the full-customer-list mode)'
				},
				customer_name: {
					type: 'string',
					description: 'Customer name (partial match)'
				},
				period: {
					type: 'string',
					enum: ['this_week', 'next_week', 'this_month'],
					description: 'Target period for the full-customer-list mode (default: this_week)'
				},
				limit: {
					type: 'number',
					description: 'Maximum number of results for the full-customer-list mode (default: 10)'
				}
			},
			required: []
		}
	}
];

const inputSchema = z.object({
	customer_id: z.string().optional(),
	customer_name: z.string().optional(),
	period: z.enum(['this_week', 'next_week', 'this_month']).optional(),
	limit: z.number().int().positive().optional().default(10)
});

export async function handleSuggestCustomerFollowup(db: Db, input: unknown, env?: ToolEnv) {
	const { customer_id, customer_name, period, limit } = inputSchema.parse(input);

	const apiKey = env?.ANTHROPIC_API_KEY;
	if (!apiKey) throw new Error('ANTHROPIC_API_KEY is not set.');

	// Customer specified -> single-customer mode
	if (customer_id || customer_name) {
		let customer;
		if (customer_id) {
			const [row] = await db.select().from(customers).where(eq(customers.id, customer_id));
			customer = row;
		} else {
			const rows = await db.select().from(customers)
				.where(like(customers.name, `%${customer_name}%`));
			customer = rows[0];
		}
		if (!customer) throw new Error(`Customer not found: ${customer_id ?? customer_name}`);
		return computeCustomerFollowupSingle(db, customer, apiKey);
	}

	// No customer specified -> full-customer-list mode
	return computeCustomerFollowupList(db, period, limit, apiKey);
}
