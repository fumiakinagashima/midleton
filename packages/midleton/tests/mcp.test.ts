import { describe, expect, test } from 'bun:test';
import { createApp, op, s } from '../src/index.js';

const greet = op({
    input: s.object({ name: s.string() }),
    handler: (input) => ({ message: `Hello, ${input.name}!` }),
});

const app = createApp().expose(greet, { rest: 'POST /greet', mcp: 'greet' });

interface Rpc {
    // biome-ignore lint/suspicious/noExplicitAny: test helper, shapes are asserted below
    result: any;
    error: { code: number };
}

const rpc = async (body: unknown): Promise<Rpc> => {
    const response = await app.fetch(
        new Request('http://localhost/mcp', { method: 'POST', body: JSON.stringify(body) }),
    );
    return (await response.json()) as Rpc;
};

describe('MCP', () => {
    test('tools/list returns the tool with its JSON Schema', async () => {
        const res = await rpc({ jsonrpc: '2.0', id: 1, method: 'tools/list' });
        expect(res.result).toEqual({
            tools: [
                {
                    name: 'greet',
                    inputSchema: {
                        type: 'object',
                        properties: { name: { type: 'string' } },
                        required: ['name'],
                    },
                },
            ],
        });
    });

    test('tools/call runs the handler', async () => {
        const res = await rpc({
            jsonrpc: '2.0',
            id: 2,
            method: 'tools/call',
            params: { name: 'greet', arguments: { name: 'Taro' } },
        });
        expect(res.result.content[0].text).toBe('{"message":"Hello, Taro!"}');
    });

    test('tools/call reports invalid arguments as a tool error', async () => {
        const res = await rpc({
            jsonrpc: '2.0',
            id: 3,
            method: 'tools/call',
            params: { name: 'greet', arguments: {} },
        });
        expect(res.result.isError).toBe(true);
    });

    test('unknown tool and unknown method are JSON-RPC errors', async () => {
        const tool = await rpc({
            jsonrpc: '2.0',
            id: 4,
            method: 'tools/call',
            params: { name: 'x' },
        });
        expect(tool.error.code).toBe(-32602);
        const method = await rpc({ jsonrpc: '2.0', id: 5, method: 'nope' });
        expect(method.error.code).toBe(-32601);
    });

    test('REST still works for the same op', async () => {
        const response = await app.fetch(
            new Request('http://localhost/greet', { method: 'POST', body: '{"name":"A"}' }),
        );
        expect(await response.json()).toEqual({ message: 'Hello, A!' });
    });
});
