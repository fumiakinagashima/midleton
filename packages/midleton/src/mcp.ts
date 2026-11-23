import type { AnyOp, Ctx } from './op.js';
import { OpError } from './op-error.js';

type Id = string | number | null;

function result(id: Id, value: unknown): Response {
    return Response.json({ jsonrpc: '2.0', id, result: value });
}

function failure(id: Id, code: number, message: string, status = 200): Response {
    return Response.json({ jsonrpc: '2.0', id, error: { code, message } }, { status });
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** Handles one MCP JSON-RPC request (Streamable HTTP, JSON responses only). */
export async function handleMcp(
    tools: ReadonlyMap<string, AnyOp>,
    request: Request,
    ctx: Ctx<unknown>,
): Promise<Response> {
    let body: unknown;
    try {
        body = await request.json();
    } catch {
        return failure(null, -32700, 'Parse error', 400);
    }
    if (!isRecord(body) || typeof body.method !== 'string') {
        return failure(null, -32600, 'Invalid Request', 400);
    }
    const id = (body.id ?? null) as Id;

    if (body.method === 'tools/list') {
        return result(id, {
            tools: [...tools].map(([name, operation]) => ({
                name,
                // Left out of the JSON when undefined.
                description: operation.description,
                // MCP requires `inputSchema` to be an object schema, even without input.
                inputSchema: operation.input?.toJSONSchema() ?? { type: 'object' },
            })),
        });
    }

    if (body.method === 'tools/call') {
        const params = isRecord(body.params) ? body.params : {};
        const operation = typeof params.name === 'string' ? tools.get(params.name) : undefined;
        if (operation === undefined) {
            return failure(id, -32602, 'Unknown tool');
        }
        let input: unknown;
        if (operation.input !== undefined) {
            const validated = operation.input.validate(params.arguments ?? {});
            if (!validated.ok) {
                // Reported as a tool error (not a protocol error) so the model can fix its call.
                return result(id, {
                    content: [{ type: 'text', text: JSON.stringify(validated.issues) }],
                    isError: true,
                });
            }
            input = validated.value;
        }
        try {
            const output = await operation.handler(input, ctx);
            return result(id, { content: [{ type: 'text', text: JSON.stringify(output) }] });
        } catch (error) {
            // Reported as a tool error so the model can see what went wrong.
            // Only OpError messages are shown; other errors stay server-side.
            const message = error instanceof OpError ? error.message : 'Internal error';
            return result(id, { content: [{ type: 'text', text: message }], isError: true });
        }
    }

    return failure(id, -32601, 'Method not found');
}
