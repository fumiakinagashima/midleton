import type { Op } from './op.js';

export interface ExposeOptions {
    /** Method and path, e.g. `'POST /greet'`. */
    readonly rest: string;
}

export interface App {
    /** Serves an operation as a REST endpoint. Returns the app for chaining. */
    expose<Output>(operation: Op<Output>, options: ExposeOptions): App;
    /** Handles a standard `Request`. Pass this to the Workers `fetch` export. */
    fetch(request: Request): Promise<Response>;
}

/** Creates an app with no operations exposed. */
export function createApp(): App {
    const routes = new Map<string, Op<unknown>>();

    const app: App = {
        expose(operation, options) {
            routes.set(options.rest, operation);
            return app;
        },

        async fetch(request) {
            const { pathname } = new URL(request.url);
            const operation = routes.get(`${request.method} ${pathname}`);
            if (operation === undefined) {
                return Response.json({ error: 'Not Found' }, { status: 404 });
            }

            let input: unknown;
            if (operation.input !== undefined) {
                let body: unknown;
                try {
                    body = await request.json();
                } catch {
                    return Response.json({ error: 'Invalid JSON' }, { status: 400 });
                }
                const result = operation.input.validate(body);
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
