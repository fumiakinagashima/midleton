import { handleMcp } from './mcp.js';
import type { Op } from './op.js';
import { createRouter } from './router.js';

export interface ExposeOptions {
    /** Method and path, e.g. `'POST /greet'`. */
    readonly rest?: string;
    /** Tool name, e.g. `'greet'`. The tool is served at `POST /mcp`. */
    readonly mcp?: string;
}

export interface App {
    /** Serves an operation as a REST endpoint. Returns the app for chaining. */
    expose<Input, Output>(operation: Op<Input, Output>, options: ExposeOptions): App;
    /** Handles a standard `Request`. Pass this to the Workers `fetch` export. */
    fetch(request: Request): Promise<Response>;
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** Creates an app with no operations exposed. */
export function createApp(): App {
    const router = createRouter<Op<unknown, unknown>>();
    const tools = new Map<string, Op<unknown, unknown>>();

    const app: App = {
        expose(operation, options) {
            const erased = operation as Op<unknown, unknown>;
            if (options.rest !== undefined) {
                router.add(options.rest, erased);
            }
            if (options.mcp !== undefined) {
                tools.set(options.mcp, erased);
            }
            return app;
        },

        async fetch(request) {
            const { pathname } = new URL(request.url);
            if (request.method === 'POST' && pathname === '/mcp') {
                return handleMcp(tools, request);
            }

            const match = router.match(request.method, pathname);
            if (match === undefined) {
                return Response.json({ error: 'Not Found' }, { status: 404 });
            }
            const operation = match.value;

            let input: unknown;
            if (operation.input !== undefined) {
                let raw: unknown = match.params;
                if (request.method !== 'GET' && request.method !== 'HEAD') {
                    let body: unknown;
                    try {
                        body = await request.json();
                    } catch {
                        return Response.json({ error: 'Invalid JSON' }, { status: 400 });
                    }
                    // Path parameters come last so a body cannot override the resource in the URL.
                    raw = isRecord(body) ? { ...body, ...match.params } : body;
                }
                const result = operation.input.validate(raw);
                if (!result.ok) {
                    return Response.json(
                        { error: 'Invalid input', issues: result.issues },
                        { status: 400 },
                    );
                }
                input = result.value;
            }
            const output = await operation.handler(input);
            return Response.json(output);
        },
    };

    return app;
}
