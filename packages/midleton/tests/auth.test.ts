import { describe, expect, test } from 'bun:test';
import { bearer, createApp, op } from '../src/index.js';

describe('bearer', () => {
    const hello = op({
        handler: () => ({ hello: 'world' }),
    });

    function appWith(verify: Parameters<typeof bearer>[0]) {
        return createApp().use(bearer(verify)).expose(hello, { rest: 'GET /hello' });
    }

    function get(headers?: Record<string, string>) {
        return new Request('http://localhost/hello', { headers });
    }

    test('lets a valid token through', async () => {
        const app = appWith((token) => token === 'secret');
        const response = await app.fetch(get({ Authorization: 'Bearer secret' }));
        expect(response.status).toBe(200);
        expect(await response.json()).toEqual({ hello: 'world' });
    });

    test('rejects a request without the header with a 401 problem', async () => {
        const app = appWith(() => true);
        const response = await app.fetch(get());
        expect(response.status).toBe(401);
        expect(response.headers.get('Content-Type')).toBe('application/problem+json');
        expect(response.headers.get('WWW-Authenticate')).toBe('Bearer');
        expect(await response.json()).toMatchObject({ status: 401, title: 'Unauthorized' });
    });

    test('rejects a token the verifier refuses', async () => {
        const app = appWith((token) => token === 'secret');
        const response = await app.fetch(get({ Authorization: 'Bearer wrong' }));
        expect(response.status).toBe(401);
    });

    test('rejects other schemes and a missing token', async () => {
        const app = appWith(() => true);
        expect((await app.fetch(get({ Authorization: 'Basic c2VjcmV0' }))).status).toBe(401);
        expect((await app.fetch(get({ Authorization: 'Bearer' }))).status).toBe(401);
        expect((await app.fetch(get({ Authorization: 'Bearer ' }))).status).toBe(401);
    });

    test('the scheme is case-insensitive', async () => {
        const app = appWith(() => true);
        const response = await app.fetch(get({ Authorization: 'bearer secret' }));
        expect(response.status).toBe(200);
    });

    test('supports an async verifier', async () => {
        const app = appWith(async (token) => token === 'secret');
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
            .use(bearer(() => false))
            .expose(guarded, { rest: 'GET /secret' });
        await app.fetch(new Request('http://localhost/secret'));
        expect(called).toBe(false);
    });

    test('protects MCP requests too', async () => {
        const app = createApp()
            .use(bearer(() => false))
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
            .use(bearer((token, ctx) => token === ctx.env.API_TOKEN))
            .route('GET /hello', () => new Response('ok'));
        const ok = await app.fetch(get({ Authorization: 'Bearer abc' }), { API_TOKEN: 'abc' });
        const ng = await app.fetch(get({ Authorization: 'Bearer abc' }), { API_TOKEN: 'xyz' });
        expect(ok.status).toBe(200);
        expect(ng.status).toBe(401);
    });
});
