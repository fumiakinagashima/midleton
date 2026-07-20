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

// フィールドの型ごとに許可する演算子（ステータス等のenumに gt/lt のような意味不明な条件を許さないため）
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
		if (isNaN(n)) throw new Error(`数値として解釈できない値です: ${raw}`);
		return n;
	}
	if (type === 'date') return toDate(raw);
	return raw;
}

// field は fields（呼び出し側の許可リスト）に存在するキーのみ受け付ける（生SQL・任意カラム名の注入を防ぐため）
export function buildFilterConditions(
	filters: FilterCondition[] | undefined,
	fields: Record<string, FilterableColumn>
): SQL[] {
	if (!filters?.length) return [];

	return filters.map((f) => {
		const def = fields[f.field];
		if (!def) {
			throw new Error(
				`未対応の絞り込み対象です: ${f.field}（利用可能: ${Object.keys(fields).join(', ')}）`
			);
		}
		const allowedOps = OPS_BY_TYPE[def.type];
		if (!allowedOps.includes(f.op)) {
			throw new Error(
				`${f.field} には ${f.op} は使用できません（利用可能な演算子: ${allowedOps.join(', ')}）`
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
