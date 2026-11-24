import { describe, expect, test } from 'bun:test';
import { createApp, OpError, op, s } from '../src/index';

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

    test('returns 404 as problem details', async () => {
        const response = await app.fetch(new Request('http://localhost/nope'));
        expect(response.status).toBe(404);
        expect(response.headers.get('content-type')).toBe('application/problem+json');
        expect(await response.json()).toEqual({
            type: 'about:blank',
            title: 'Not Found',
            status: 404,
            detail: 'No route matches this request',
        });
    });

    test('returns 500 when the handler throws', async () => {
        const broken = op({
            handler: () => {
                throw new Error('secret internal detail');
            },
        });
        const brokenApp = createApp().expose(broken, { rest: 'GET /broken' });

        const response = await brokenApp.fetch(new Request('http://localhost/broken'));
        expect(response.status).toBe(500);
        expect(response.headers.get('content-type')).toBe('application/problem+json');
        const body = await response.json();
        expect(body).toEqual({
            type: 'about:blank',
            title: 'Internal Server Error',
            status: 500,
            detail: 'Internal error',
        });
        // The error message must not leak to the client.
        expect(JSON.stringify(body)).not.toContain('secret internal detail');
    });

    test('returns the status and message of an OpError', async () => {
        const missing = op({
            handler: () => {
                throw new OpError(404, 'User not found');
            },
        });
        const missingApp = createApp().expose(missing, { rest: 'GET /missing' });

        const response = await missingApp.fetch(new Request('http://localhost/missing'));
        expect(response.status).toBe(404);
        expect(response.headers.get('content-type')).toBe('application/problem+json');
        expect(await response.json()).toEqual({
            type: 'about:blank',
            title: 'Not Found',
            status: 404,
            detail: 'User not found',
        });
    });
});

describe('input validation', () => {
    const greet = op({
        input: s.object({ name: s.string() }),
        handler: (input) => ({ message: `Hello, ${input.name}!` }),
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
            type: 'about:blank',
            title: 'Bad Request',
            status: 400,
            detail: 'Invalid input',
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

describe('path parameters', () => {
    const getUser = op({
        input: s.object({ id: s.string() }),
        handler: (input) => ({ id: input.id }),
    });
    const usersApp = createApp()
        .expose(getUser, { rest: 'GET /users/:id' })
        .expose(getUser, { rest: 'POST /users/:id' });

    test('passes the path parameter as input', async () => {
        const response = await usersApp.fetch(new Request('http://localhost/users/42'));
        expect(response.status).toBe(200);
        expect(await response.json()).toEqual({ id: '42' });
    });

    test('returns 404 when the parameter segment is missing', async () => {
        const response = await usersApp.fetch(new Request('http://localhost/users/'));
        expect(response.status).toBe(404);
    });

    test('path parameters win over the request body', async () => {
        const response = await usersApp.fetch(
            new Request('http://localhost/users/42', {
                method: 'POST',
                body: JSON.stringify({ id: '999' }),
            }),
        );
        expect(await response.json()).toEqual({ id: '42' });
    });

    test('passes env to the handler as ctx.env', async () => {
        const whoami = op({
            handler: (_input, ctx) => ({ greeting: ctx.env.GREETING }),
        });
        const app = createApp().expose(whoami, { rest: 'GET /whoami' });
        const response = await app.fetch(new Request('http://localhost/whoami'), {
            GREETING: 'hello',
        });
        expect(await response.json()).toEqual({ greeting: 'hello' });
    });
});

describe('query parameters', () => {
    const search = op({
        input: s.object({ q: s.string(), tag: s.optional(s.string()) }),
        handler: (input) => input,
    });
    const searchApp = createApp()
        .expose(search, { rest: 'GET /search' })
        .expose(search, { rest: 'POST /search' });

    test('passes query parameters as input', async () => {
        const response = await searchApp.fetch(
            new Request('http://localhost/search?q=abc&tag=news'),
        );
        expect(response.status).toBe(200);
        expect(await response.json()).toEqual({ q: 'abc', tag: 'news' });
    });

    test('returns 400 when a required query parameter is missing', async () => {
        const response = await searchApp.fetch(new Request('http://localhost/search'));
        expect(response.status).toBe(400);
    });

    test('the body wins over the query', async () => {
        const response = await searchApp.fetch(
            new Request('http://localhost/search?q=from-query', {
                method: 'POST',
                body: JSON.stringify({ q: 'from-body' }),
            }),
        );
        expect(await response.json()).toEqual({ q: 'from-body' });
    });

    test('the query fills fields the body leaves out', async () => {
        const response = await searchApp.fetch(
            new Request('http://localhost/search?tag=news', {
                method: 'POST',
                body: JSON.stringify({ q: 'abc' }),
            }),
        );
        expect(await response.json()).toEqual({ q: 'abc', tag: 'news' });
    });

    test('path parameters win over the query', async () => {
        const getUser = op({
            input: s.object({ id: s.string() }),
            handler: (input) => ({ id: input.id }),
        });
        const app = createApp().expose(getUser, { rest: 'GET /users/:id' });
        const response = await app.fetch(new Request('http://localhost/users/42?id=999'));
        expect(await response.json()).toEqual({ id: '42' });
    });
});

describe('typed env', () => {
    test('app.op types ctx.env from the app Env', async () => {
        interface Env {
            GREETING: string;
        }
        const app = createApp<Env>();
        const whoami = app.op({
            handler: (_input, ctx) => {
                // @ts-expect-error UNKNOWN is not part of Env
                ctx.env.UNKNOWN;
                return { greeting: ctx.env.GREETING.toUpperCase() };
            },
        });
        app.expose(whoami, { rest: 'GET /whoami' });

        const response = await app.fetch(new Request('http://localhost/whoami'), {
            GREETING: 'hello',
        });
        expect(await response.json()).toEqual({ greeting: 'HELLO' });
    });
});

describe('extend', () => {
    interface Env {
        GREETING: string;
    }

    test('extend() adds typed services to ctx for REST and MCP', async () => {
        const app = createApp<Env>().extend((env) => ({
            greeter: { greet: (name: string) => `${env.GREETING}, ${name}` },
        }));

        const hello = app.op({
            input: s.object({ name: s.string() }),
            handler: (input, ctx) => ctx.greeter.greet(input.name),
        });
        app.expose(hello, { rest: 'POST /hello', mcp: 'hello' });

        const rest = await app.fetch(
            new Request('http://localhost/hello', {
                method: 'POST',
                body: JSON.stringify({ name: 'Ann' }),
            }),
            { GREETING: 'Hi' },
        );
        expect(await rest.json()).toBe('Hi, Ann');
    });

    test('extend() factory runs once per request', async () => {
        let calls = 0;
        const app = createApp().extend(() => {
            calls++;
            return {};
        });
        app.expose(app.op({ handler: () => 'ok' }), { rest: 'GET /ping' });
        await app.fetch(new Request('http://localhost/ping'));
        await app.fetch(new Request('http://localhost/ping'));
        expect(calls).toBe(2);
    });

    test('ctx.greeter is not visible before extend()', () => {
        const app = createApp<Env>();
        app.op({
            // @ts-expect-error `greeter` is only on the ctx of an app that called extend()
            handler: (_input, ctx) => ctx.greeter,
        });
    });
});
