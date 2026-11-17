import { describe, expect, test } from 'bun:test';
import { createApp, op } from '../src/index';

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
