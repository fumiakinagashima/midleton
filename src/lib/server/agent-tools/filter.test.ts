import { describe, it, expect } from 'vitest';
import { buildFilterConditions, type FilterableColumn } from './filter';
import { customers } from '../db/schema';

const FIELDS: Record<string, FilterableColumn> = {
	address: { column: customers.address, type: 'text' },
	status: { column: customers.status, type: 'enum' },
	health_score: { column: customers.healthScore, type: 'number' },
	created_at: { column: customers.createdAt, type: 'date' }
};

describe('buildFilterConditions', () => {
	it('returns an empty array when no filters are given', () => {
		expect(buildFilterConditions(undefined, FIELDS)).toEqual([]);
		expect(buildFilterConditions([], FIELDS)).toEqual([]);
	});

	it('builds one condition per valid filter', () => {
		const conditions = buildFilterConditions(
			[
				{ field: 'address', op: 'contains', value: '東京' },
				{ field: 'status', op: 'eq', value: 'active' }
			],
			FIELDS
		);
		expect(conditions).toHaveLength(2);
	});

	it('rejects fields not in the allowlist (no raw column/SQL injection)', () => {
		expect(() =>
			buildFilterConditions([{ field: 'id', op: 'eq', value: 'x' }], FIELDS)
		).toThrow(/未対応の絞り込み対象/);
	});

	it('rejects operators not allowed for the field type', () => {
		// status is an enum column: gt has no ordering semantics for it
		expect(() =>
			buildFilterConditions([{ field: 'status', op: 'gt', value: 'active' }], FIELDS)
		).toThrow(/には gt は使用できません/);
	});

	it('allows comparison operators for number and date fields', () => {
		const conditions = buildFilterConditions(
			[
				{ field: 'health_score', op: 'gte', value: '50' },
				{ field: 'created_at', op: 'lt', value: '2026-01-01' }
			],
			FIELDS
		);
		expect(conditions).toHaveLength(2);
	});

	it('rejects a non-numeric value for a number field', () => {
		expect(() =>
			buildFilterConditions([{ field: 'health_score', op: 'gt', value: 'abc' }], FIELDS)
		).toThrow(/数値として解釈できない値です/);
	});

	it('rejects an invalid date for a date field', () => {
		expect(() =>
			buildFilterConditions([{ field: 'created_at', op: 'gt', value: 'not-a-date' }], FIELDS)
		).toThrow(/無効な日付/);
	});
});
