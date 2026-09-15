import { eq, desc } from 'drizzle-orm';
import { z } from 'zod';
import type { Tool } from '@anthropic-ai/sdk/resources/messages';
import type { Db } from '../db';
import { contacts } from '../db/schema';
import { parseJson, mergeCustom, now } from './shared';

export const tools: Tool[] = [
	{
		name: 'get_contacts',
		description: 'Fetches the contact list. Can be filtered by customer ID.',
		input_schema: {
			type: 'object',
			properties: {
				customer_id: { type: 'string', description: 'Filter by customer ID' },
				limit: { type: 'number', description: 'Maximum number of results to return (default: 50)' }
			},
			required: []
		}
	},
	{
		name: 'create_contact',
		description: 'Registers a contact. Customer ID is required.',
		input_schema: {
			type: 'object',
			properties: {
				customer_id: { type: 'string', description: 'ID of the customer to link this contact to (required)' },
				name: { type: 'string', description: 'Contact name (required)' },
				name_kana: { type: 'string', description: 'Contact name reading (kana)' },
				email: { type: 'string', description: 'Email address' },
				phone: { type: 'string', description: 'Phone number' },
				role: { type: 'string', description: 'Job title' },
				department: { type: 'string', description: 'Department' },
				notes: { type: 'string', description: 'Notes' },
				custom: { type: 'object', description: 'Custom fields' }
			},
			required: ['customer_id', 'name']
		}
	},
	{
		name: 'update_contact',
		description: 'Updates contact information.',
		input_schema: {
			type: 'object',
			properties: {
				id: { type: 'string', description: 'Contact ID (required)' },
				name: { type: 'string', description: 'Contact name' },
				name_kana: { type: 'string', description: 'Contact name reading (kana)' },
				email: { type: 'string', description: 'Email address' },
				phone: { type: 'string', description: 'Phone number' },
				role: { type: 'string', description: 'Job title' },
				department: { type: 'string', description: 'Department' },
				notes: { type: 'string', description: 'Notes' },
				custom: { type: 'object', description: 'Custom fields (merged with existing data)' }
			},
			required: ['id']
		}
	}
];

const getContactsSchema = z.object({
	customer_id: z.string().optional(),
	limit: z.number().int().positive().default(50)
});

const createContactSchema = z.object({
	customer_id: z.string(),
	name: z.string().min(1),
	name_kana: z.string().optional(),
	email: z.string().optional(),
	phone: z.string().optional(),
	role: z.string().optional(),
	department: z.string().optional(),
	notes: z.string().optional(),
	custom: z.record(z.string(), z.unknown()).optional()
});

const updateContactSchema = z.object({
	id: z.string(),
	name: z.string().optional(),
	name_kana: z.string().optional(),
	email: z.string().optional(),
	phone: z.string().optional(),
	role: z.string().optional(),
	department: z.string().optional(),
	notes: z.string().optional(),
	custom: z.record(z.string(), z.unknown()).optional()
});

export async function handleGetContacts(db: Db, input: unknown) {
	const { customer_id, limit } = getContactsSchema.parse(input);
	const result = await db
		.select()
		.from(contacts)
		.where(customer_id ? eq(contacts.customerId, customer_id) : undefined)
		.orderBy(desc(contacts.createdAt))
		.limit(limit);
	return result.map((r) => ({ ...r, custom: parseJson(r.custom) }));
}

export async function handleCreateContact(db: Db, input: unknown) {
	const data = createContactSchema.parse(input);
	const id = crypto.randomUUID();
	await db.insert(contacts).values({
		id,
		customerId: data.customer_id,
		name: data.name,
		nameKana: data.name_kana,
		email: data.email,
		phone: data.phone,
		role: data.role,
		department: data.department,
		notes: data.notes,
		custom: JSON.stringify(data.custom ?? {})
	});
	const [row] = await db.select().from(contacts).where(eq(contacts.id, id));
	return { ...row, custom: parseJson(row.custom) };
}

export async function handleUpdateContact(db: Db, input: unknown) {
	const data = updateContactSchema.parse(input);
	const [existing] = await db.select().from(contacts).where(eq(contacts.id, data.id));
	if (!existing) throw new Error(`Contact not found: ${data.id}`);

	await db
		.update(contacts)
		.set({
			...(data.name !== undefined && { name: data.name }),
			...(data.name_kana !== undefined && { nameKana: data.name_kana }),
			...(data.email !== undefined && { email: data.email }),
			...(data.phone !== undefined && { phone: data.phone }),
			...(data.role !== undefined && { role: data.role }),
			...(data.department !== undefined && { department: data.department }),
			...(data.notes !== undefined && { notes: data.notes }),
			...(data.custom !== undefined && { custom: mergeCustom(existing.custom, data.custom) }),
			updatedAt: now()
		})
		.where(eq(contacts.id, data.id));

	const [row] = await db.select().from(contacts).where(eq(contacts.id, data.id));
	return { ...row, custom: parseJson(row.custom) };
}
