import { describe, expect, test } from 'bun:test';
import { s } from '../src/index.js';

describe('number and boolean', () => {
    test('s.number accepts finite numbers only', () => {
        expect(s.number().validate(1.5)).toEqual({ ok: true, value: 1.5 });
        expect(s.number().validate('1').ok).toBe(false);
        expect(s.number().validate(Number.NaN).ok).toBe(false);
        expect(s.number().validate(Number.POSITIVE_INFINITY).ok).toBe(false);
    });

    test('s.boolean accepts booleans only', () => {
        expect(s.boolean().validate(false)).toEqual({ ok: true, value: false });
        expect(s.boolean().validate('true').ok).toBe(false);
    });

    test('they describe themselves as JSON Schema', () => {
        expect(s.number().toJSONSchema()).toEqual({ type: 'number' });
        expect(s.boolean().toJSONSchema()).toEqual({ type: 'boolean' });
    });
});

describe('optional', () => {
    const schema = s.object({ name: s.string(), age: s.optional(s.number()) });

    test('a left-out field is accepted and stays out of the value', () => {
        // `unknown`: the inferred type has a required `age: number | undefined` key, but at runtime the key is absent.
        expect<unknown>(schema.validate({ name: 'Ann' })).toEqual({
            ok: true,
            value: { name: 'Ann' },
        });
    });

    test('a present field is still validated', () => {
        expect(schema.validate({ name: 'Ann', age: 30 })).toEqual({
            ok: true,
            value: { name: 'Ann', age: 30 },
        });
        expect(schema.validate({ name: 'Ann', age: 'old' }).ok).toBe(false);
    });

    test('only non-optional fields are listed as required', () => {
        expect(schema.toJSONSchema()).toEqual({
            type: 'object',
            properties: {
                name: { type: 'string' },
                age: { type: 'number' },
            },
            required: ['name'],
        });
    });
});
