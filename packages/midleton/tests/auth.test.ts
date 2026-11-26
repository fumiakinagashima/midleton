import { describe, expect, test } from 'bun:test';
import { bearer, createApp, op } from '../src/index.js';

describe('bearer', () => {
    const hello = op({
        handler: () => ({ hello: 'world' }),
    });

    function appWith(verify: (token: string) => unknown) {
        return createApp().authenticate(bearer(verify)).expose(hello, { rest: 'GET /hello' });
    }

    function get(headers?: Record<string, string>) {
        return new Request('http://localhost/hello', { headers });
    }

    test('lets a valid token through', async () => {
        const app = appWith((token) => (token === 'secret' ? { userId: 'u_42' } : undefined));
        const response = await app.fetch(get({ Authorization: 'Bearer secret' }));
        expect(response.status).toBe(200);
        expect(await response.json()).toEqual({ hello: 'world' });
    });

    test('rejects a request without the header with a 401 problem', async () => {
        const app = appWith(() => ({ userId: 'u_42' }));
        const response = await app.fetch(get());
        expect(response.status).toBe(401);
        expect(response.headers.get('Content-Type')).toBe('application/problem+json');
        expect(response.headers.get('WWW-Authenticate')).toBe('Bearer');
        expect(await response.json()).toMatchObject({ status: 401, title: 'Unauthorized' });
    });

    test('rejects a token the verifier refuses: undefined, null and false', async () => {
        for (const rejected of [undefined, null, false]) {
            const app = appWith(() => rejected);
            const response = await app.fetch(get({ Authorization: 'Bearer wrong' }));
            expect(response.status).toBe(401);
        }
    });

    test('rejects other schemes and a missing token', async () => {
        const app = appWith(() => ({ userId: 'u_42' }));
        expect((await app.fetch(get({ Authorization: 'Basic c2VjcmV0' }))).status).toBe(401);
        expect((await app.fetch(get({ Authorization: 'Bearer' }))).status).toBe(401);
        expect((await app.fetch(get({ Authorization: 'Bearer ' }))).status).toBe(401);
    });

    test('the scheme is case-insensitive', async () => {
        const app = appWith(() => ({ userId: 'u_42' }));
        const response = await app.fetch(get({ Authorization: 'bearer secret' }));
        expect(response.status).toBe(200);
    });

    test('supports an async verifier', async () => {
        const app = appWith(async () => ({ userId: 'u_42' }));
        const response = await app.fetch(get({ Authorization: 'Bearer secret' }));
        expect(response.status).toBe(200);
    });

    test('a verifier that throws gives 401, not 500', async () => {
        const app = appWith(() => {
            throw new Error('kv is down');
        });
        const response = await app.fetch(get({ Authorization: 'Bearer secret' }));
        expect(response.status).toBe(401);
        expect(await response.text()).not.toContain('kv is down');
    });

    test('the handler does not run when the token is rejected', async () => {
        let called = false;
        const guarded = op({
            handler: () => {
                called = true;
                return {};
            },
        });
        const app = createApp()
            .authenticate(bearer(() => undefined))
            .expose(guarded, { rest: 'GET /secret' });
        await app.fetch(new Request('http://localhost/secret'));
        expect(called).toBe(false);
    });

    test('protects MCP requests too', async () => {
        const app = createApp()
            .authenticate(bearer(() => undefined))
            .expose(hello, { mcp: 'hello' });
        const response = await app.fetch(
            new Request('http://localhost/mcp', {
                method: 'POST',
                body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/list' }),
            }),
        );
        expect(response.status).toBe(401);
    });

    test('verify gets ctx.env, typed from the app Env', async () => {
        const app = createApp<{ API_TOKEN: string }>()
            .authenticate(
                bearer((token, ctx) => (token === ctx.env.API_TOKEN ? { ok: true } : undefined)),
            )
            .route('GET /hello', () => new Response('ok'));
        const ok = await app.fetch(get({ Authorization: 'Bearer abc' }), { API_TOKEN: 'abc' });
        const ng = await app.fetch(get({ Authorization: 'Bearer abc' }), { API_TOKEN: 'xyz' });
        expect(ok.status).toBe(200);
        expect(ng.status).toBe(401);
    });
});

describe('ctx.caller', () => {
    const app = createApp().authenticate(
        bearer((token) => (token === 'secret' ? { userId: 'u_42' } : undefined)),
    );

    test('handlers receive the caller, typed', async () => {
        const whoami = app.op({
            handler: (_input, ctx) => ({ userId: ctx.caller.userId }),
        });
        const withApp = app.expose(whoami, { rest: 'GET /whoami' });
        const response = await withApp.fetch(
            new Request('http://localhost/whoami', { headers: { Authorization: 'Bearer secret' } }),
        );
        expect(await response.json()).toEqual({ userId: 'u_42' });
    });

    test('raw routes receive the caller too', async () => {
        const withRoute = app.route('GET /me', (_request, ctx) => new Response(ctx.caller.userId));
        const response = await withRoute.fetch(
            new Request('http://localhost/me', { headers: { Authorization: 'Bearer secret' } }),
        );
        expect(await response.text()).toBe('u_42');
    });

    test('MCP tool handlers receive the caller', async () => {
        const whoami = app.op({
            handler: (_input, ctx) => ({ userId: ctx.caller.userId }),
        });
        const withTool = app.expose(whoami, { mcp: 'whoami' });
        const response = await withTool.fetch(
            new Request('http://localhost/mcp', {
                method: 'POST',
                headers: { Authorization: 'Bearer secret' },
                body: JSON.stringify({
                    jsonrpc: '2.0',
                    id: 1,
                    method: 'tools/call',
                    params: { name: 'whoami', arguments: {} },
                }),
            }),
        );
        expect(JSON.stringify(await response.json())).toContain('u_42');
    });

    test('a custom authenticator works too, reading any header', async () => {
        const custom = createApp()
            .authenticate({
                authenticate: (request) => {
                    const email = request.headers.get('X-User-Email');
                    return email === null ? undefined : { email };
                },
            })
            .route('GET /me', (_request, ctx) => new Response(ctx.caller.email));
        const ok = await custom.fetch(
            new Request('http://localhost/me', { headers: { 'X-User-Email': 'a@example.com' } }),
        );
        expect(await ok.text()).toBe('a@example.com');
        const ng = await custom.fetch(new Request('http://localhost/me'));
        expect(ng.status).toBe(401);
        expect(ng.headers.get('WWW-Authenticate')).toBeNull();
    });
});
