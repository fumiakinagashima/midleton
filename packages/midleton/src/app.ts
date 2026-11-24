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

export interface App<Env = DefaultEnv, C = Ctx<Env>> {
    /** Like the top-level `op()`, but `ctx` is typed as this app's context. */
    readonly op: DefineOp<C>;
    /** Serves an operation as a REST endpoint. Returns the app for chaining. */
    expose<Input, Output>(operation: Op<Input, Output, C>, options: ExposeOptions): App<Env, C>;
    /**
     * Adds request-scoped services to `ctx`. The factory runs once per request.
     * Define operations after `extend()` to see the added properties in their types.
     */
    extend<Added extends object>(factory: (env: Env) => Added): App<Env, C & Added>;
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
    const factories: Array<(env: unknown) => object> = [];

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

        extend<Added extends object>(factory: (env: Env) => Added) {
            factories.push(factory as (env: unknown) => object);
            // Same app, wider ctx type: the router and tool map stay shared.
            return app as unknown as App<Env, Ctx<Env> & Added>;
        },

        async fetch(request, env) {
            // Workers always passes `env`; the fallback is for callers that pass only a request, such as tests.
            const base = env ?? {};
            // `env` comes last so a factory cannot replace it.
            const ctx: Ctx<unknown> = Object.assign(
                {},
                ...factories.map((factory) => factory(base)),
                { env: base },
            );
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
