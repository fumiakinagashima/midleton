import { like, eq } from 'drizzle-orm';
import { z } from 'zod';
import type { Db } from '../db';
import { customers } from '../db/schema';

const getCustomersInputSchema = z.object({
	name: z.string().optional(),
	status: z.enum(['active', 'inactive']).optional(),
	limit: z.number().int().positive().default(50)
});

const createCustomerInputSchema = z.object({
	name: z.string().min(1),
	contact_name: z.string().optional(),
	email: z.string().email().optional(),
	phone: z.string().optional(),
	address: z.string().optional(),
	notes: z.string().optional()
});

export async function handleGetCustomers(db: Db, input: unknown) {
	const { name, status, limit } = getCustomersInputSchema.parse(input);

	let query = db.select().from(customers).$dynamic();

	if (name) query = query.where(like(customers.name, `%${name}%`));
	if (status) query = query.where(eq(customers.status, status));

	const result = await query.limit(limit);
	return result;
}

export async function handleCreateCustomer(db: Db, input: unknown) {
	const data = createCustomerInputSchema.parse(input);

	const id = crypto.randomUUID();
	await db.insert(customers).values({
		id,
		name: data.name,
		contactName: data.contact_name,
		email: data.email,
		phone: data.phone,
		address: data.address,
		notes: data.notes
	});

	const [created] = await db.select().from(customers).where(eq(customers.id, id));
	return created;
}

export type ToolName = 'get_customers' | 'create_customer';

export async function dispatchTool(db: Db, name: ToolName, input: unknown) {
	switch (name) {
		case 'get_customers':
			return handleGetCustomers(db, input);
		case 'create_customer':
			return handleCreateCustomer(db, input);
		default:
			throw new Error(`Unknown tool: ${name}`);
	}
}
