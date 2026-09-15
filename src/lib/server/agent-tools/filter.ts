import { eq, gt, gte, like, lt, lte, ne, type SQL } from 'drizzle-orm';
import type { SQLiteColumn } from 'drizzle-orm/sqlite-core';
import { z } from 'zod';
import { toDate } from './shared';

export type FilterOp = 'eq' | 'not' | 'contains' | 'gt' | 'gte' | 'lt' | 'lte';
export type FilterFieldType = 'text' | 'enum' | 'number' | 'date';

export type FilterableColumn = {
	column: SQLiteColumn;
	type: FilterFieldType;
};

// Operators allowed per field type (prevents nonsensical conditions like gt/lt on an enum such as status)
const OPS_BY_TYPE: Record<FilterFieldType, FilterOp[]> = {
	text: ['eq', 'not', 'contains'],
	enum: ['eq', 'not', 'contains'],
	number: ['eq', 'not', 'gt', 'gte', 'lt', 'lte'],
	date: ['eq', 'not', 'gt', 'gte', 'lt', 'lte']
};

export const filterConditionSchema = z.object({
	field: z.string(),
	op: z.enum(['eq', 'not', 'contains', 'gt', 'gte', 'lt', 'lte']),
	value: z.string()
});

export type FilterCondition = z.infer<typeof filterConditionSchema>;

function coerceValue(type: FilterFieldType, raw: string): string | number | Date {
	if (type === 'number') {
		const n = Number(raw);
		if (isNaN(n)) throw new Error(`Value cannot be interpreted as a number: ${raw}`);
		return n;
	}
	if (type === 'date') return toDate(raw);
	return raw;
}

// Only accept a field that exists in fields (the caller's allowlist), to prevent raw SQL / arbitrary column name injection
export function buildFilterConditions(
	filters: FilterCondition[] | undefined,
	fields: Record<string, FilterableColumn>
): SQL[] {
	if (!filters?.length) return [];

	return filters.map((f) => {
		if (!Object.hasOwn(fields, f.field)) {
			throw new Error(
				`Unsupported filter field: ${f.field} (available: ${Object.keys(fields).join(', ')})`
			);
		}
		const def = fields[f.field];
		const allowedOps = OPS_BY_TYPE[def.type];
		if (!allowedOps.includes(f.op)) {
			throw new Error(
				`${f.field} does not support ${f.op} (available operators: ${allowedOps.join(', ')})`
			);
		}

		const value = coerceValue(def.type, f.value) as never;
		const column = def.column;

		switch (f.op) {
			case 'eq':
				return eq(column, value);
			case 'not':
				return ne(column, value);
			case 'contains':
				return like(column, `%${value}%`);
			case 'gt':
				return gt(column, value);
			case 'gte':
				return gte(column, value);
			case 'lt':
				return lt(column, value);
			case 'lte':
				return lte(column, value);
		}
	});
}

export function filterFieldsDescription(fields: Record<string, FilterableColumn>): string {
	return Object.entries(fields)
		.map(([key, def]) => `${key}(${OPS_BY_TYPE[def.type].join('/')})`)
		.join(', ');
}
