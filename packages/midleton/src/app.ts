import { handleMcp } from './mcp.js';
import { type AnyOp, type Ctx, type DefaultEnv, type DefineOp, defineOp, type Op } from './op.js';
import { OpError } from './op-error.js';
import { problem } from './problem.js';
import { createRouter } from './router.js';

export interface ExposeOptions {
    /** Method and path, e.g. `'POST /greet'`. */
    readonly rest?: string;
    /** Tool name, e.g. `'greet'`. The tool is served at `POST /mcp`. */
    readonly mcp?: string;
}

export interface App<Env = DefaultEnv> {
    /** Like the top-level `op()`, but `ctx.env` is typed as this app's `Env`. */
    readonly op: DefineOp<Ctx<Env>>;
    /** Serves an operation as a REST endpoint. Returns the app for chaining. */
    expose<Input, Output>(operation: Op<Input, Output, Ctx<Env>>, options: ExposeOptions): App<Env>;
    /** Handles a standard `Request`. `env` is passed through to handlers as `ctx.env`. */
    fetch(request: Request, env?: Env): Promise<Response>;
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** Creates an app with no operations exposed. */
export function createApp<Env = DefaultEnv>(): App<Env> {
    const router = createRouter<AnyOp>();
    const tools = new Map<string, AnyOp>();

    const app: App<Env> = {
        op: defineOp<Ctx<Env>>(),

        expose(operation, options) {
            const erased = operation as AnyOp;
            if (options.rest !== undefined) {
                router.add(options.rest, erased);
            }
            if (options.mcp !== undefined) {
                tools.set(options.mcp, erased);
            }
            return app;
        },

        async fetch(request, env) {
            // Workers always passes `env`; the fallback is for callers that pass only a request, such as tests.
            const ctx: Ctx<unknown> = { env: env ?? {} };
            const { pathname } = new URL(request.url);
            if (request.method === 'POST' && pathname === '/mcp') {
                return handleMcp(tools, request, ctx);
            }

            const match = router.match(request.method, pathname);
            if (match === undefined) {
                return problem(404, 'No route matches this request');
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
                        return problem(400, 'Invalid JSON');
                    }
                    // Path parameters come last so a body cannot override the resource in the URL.
                    raw = isRecord(body) ? { ...body, ...match.params } : body;
                }
                const result = operation.input.validate(raw);
                if (!result.ok) {
                    return problem(400, 'Invalid input', { issues: result.issues });
                }
                input = result.value;
            }
            try {
                return Response.json(await operation.handler(input, ctx));
            } catch (error) {
                if (error instanceof OpError) {
                    return problem(error.status, error.message);
                }
                // Details of unexpected errors stay server-side; clients get a generic message.
                return problem(500, 'Internal error');
            }
        },
    };

    return app;
}
