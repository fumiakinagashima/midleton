import type { Authenticator } from './auth.js';
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

/** Runs around every request. Call `next()` to continue, or return a `Response` to stop. */
export type Middleware<C> = (
    request: Request,
    ctx: C,
    next: () => Promise<Response>,
) => Response | Promise<Response>;

/** Handles a request directly, without an operation. Path parameters come as strings. */
export type RouteHandler<C> = (
    request: Request,
    ctx: C,
    params: Readonly<Record<string, string>>,
) => Response | Promise<Response>;

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
    /**
     * Adds middleware that wraps every request, REST and MCP alike.
     * Middleware runs in the order it was added, the first one outermost.
     */
    use(middleware: Middleware<C>): App<Env, C>;
    /**
     * Requires every request to be authenticated. The authenticator's result is available as
     * `ctx.caller`; a rejected request gets a 401 problem and nothing else runs.
     * Define operations after `authenticate()` to see `ctx.caller` in their types.
     */
    authenticate<Caller>(
        authenticator: Authenticator<C, Caller>,
    ): App<Env, C & { readonly caller: Caller }>;
    /**
     * Serves a raw route, e.g. `'POST /webhooks/stripe'`: the handler gets the request
     * and returns a `Response`. Use it for what an operation cannot express, such as webhooks.
     */
    route(pattern: string, handler: RouteHandler<C>): App<Env, C>;
    /** Handles a standard `Request`. `env` is passed through to handlers as `ctx.env`. */
    fetch(request: Request, env?: Env): Promise<Response>;
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** Creates an app with no operations exposed. */
export function createApp<Env = DefaultEnv>(): App<Env> {
    const router = createRouter<AnyOp>();
    const routes = createRouter<RouteHandler<Ctx<unknown>>>();
    const tools = new Map<string, AnyOp>();
    const factories: Array<(env: unknown) => object> = [];
    const middlewares: Array<Middleware<Ctx<unknown>>> = [];

    // The roiuting and handling that used to be the whole of `fetch`.
    async function dispatch(request: Request, ctx: Ctx<unknown>): Promise<Response> {
        const { pathname, searchParams } = new URL(request.url);
        if (request.method === 'POST' && pathname === '/mcp') {
            return handleMcp(tools, request, ctx);
        }

        const rawMatch = routes.match(request.method, pathname);
        if (rawMatch !== undefined) {
            try {
                return await rawMatch.value(request, ctx, rawMatch.params);
            } catch {
                // Same as operations: details stay server-side.
                return problem(500, 'Internal error');
            }
        }

        const match = router.match(request.method, pathname);
        if (match === undefined) {
            return problem(404, 'No route matches this request');
        }
        const operation = match.value;

        let input: unknown;
        if (operation.input !== undefined) {
            const query = Object.fromEntries(searchParams);
            let raw: unknown = { ...query, ...match.params };
            if (request.method !== 'GET' && request.method !== 'HEAD') {
                let body: unknown;
                try {
                    body = await request.json();
                } catch {
                    return problem(400, 'Invalid JSON');
                }
                // Path parameters come last so a body cannot override the resource in the URL,
                // and the body comes after the query so it wins over it.
                raw = isRecord(body) ? { ...query, ...body, ...match.params } : body;
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
    }

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

        use(middleware) {
            middlewares.push(middleware as Middleware<Ctx<unknown>>);
            return app;
        },

        authenticate<Caller>(authenticator: Authenticator<Ctx<Env>, Caller>) {
            middlewares.push(async (request, ctx, next) => {
                let caller: Awaited<ReturnType<Authenticator<Ctx<Env>, Caller>['authenticate']>>;
                try {
                    caller = await authenticator.authenticate(request, ctx as Ctx<Env>);
                } catch {
                    // A failing authenticator must not let the request through; details stay server-side.
                    caller = undefined;
                }
                if (caller === undefined || caller === null || caller === false) {
                    const response = problem(401, 'Missing or invalid credentials');
                    if (authenticator.challenge !== undefined) {
                        response.headers.set('WWW-Authenticate', authenticator.challenge);
                    }
                    return response;
                }
                Object.assign(ctx, { caller });
                return next();
            });
            // Same app, wider ctx type, like `extend()`.
            return app as unknown as App<Env, Ctx<Env> & { readonly caller: Caller }>;
        },

        route(pattern, handler) {
            routes.add(pattern, handler as RouteHandler<Ctx<unknown>>);
            return app;
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
            // Build the chain from the inside out: the last middleware wraps `dispatch`,
            // and each earlier one wraps the next, so the first one runs outermost.
            let handler = () => dispatch(request, ctx);
            for (const middleware of [...middlewares].reverse()) {
                const next = handler;
                handler = async () => middleware(request, ctx, next);
            }
            return handler();
        },
    };

    return app;
}
