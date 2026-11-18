import { describe, expect, test } from 'bun:test';
import { createApp, op, s } from '../src/index';

const hello = op({
    handler: () => ({ message: 'Hello, Midleton!' }),
});

const app = createApp().expose(hello, { rest: 'GET /hello' });

describe('REST', () => {
    test('returns the handler output as JSON', async () => {
        const response = await app.fetch(new Request('http://localhost/hello'));
        expect(response.status).toBe(200);
        expect(response.headers.get('content-type')).toContain('application/json');
        expect(await response.json()).toEqual({ message: 'Hello, Midleton!' });
    });

    test('supports async handlers', async () => {
        const numbers = op({ handler: async () => [1, 2, 3] });
        const asyncApp = createApp().expose(numbers, { rest: 'GET /numbers' });
        const response = await asyncApp.fetch(new Request('http://localhost/numbers'));
        expect(await response.json()).toEqual([1, 2, 3]);
    });

    test('returns 404 for an unknown path', async () => {
        const response = await app.fetch(new Request('http://localhost/nope'));
        expect(response.status).toBe(404);
    });

    test('returns 404 for a different method', async () => {
        const response = await app.fetch(new Request('http://localhost/hello', { method: 'POST' }));
        expect(response.status).toBe(404);
    });
});

describe('input validation', () => {
    const greet = op({
        input: s.object({ name: s.string() }),
        handler: (input) => ({ message: `Hello, ${(input as { name: string }).name}!` }),
    });
    const greetApp = createApp().expose(greet, { rest: 'POST /greet' });

    const post = (body: string) =>
        greetApp.fetch(new Request('http://localhost/greet', { method: 'POST', body }));

    test('passes valid input to the handler', async () => {
        const response = await post(JSON.stringify({ name: 'Ada' }));
        expect(response.status).toBe(200);
        expect(await response.json()).toEqual({ message: 'Hello, Ada!' });
    });

    test('returns 400 with issues for invalid input', async () => {
        const response = await post(JSON.stringify({ name: 42 }));
        expect(response.status).toBe(400);
        expect(await response.json()).toEqual({
            error: 'Invalid input',
            issues: [{ path: ['name'], message: 'Expected string' }],
        });
    });

    test('returns 400 for a missing field', async () => {
        const response = await post('{}');
        expect(response.status).toBe(400);
    });

    test('returns 400 for a non-JSON body', async () => {
        const response = await post('not json');
        expect(response.status).toBe(400);
    });
});
