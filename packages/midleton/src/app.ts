import type { Op } from './op.js';

export interface ExposeOptions {
    readonly rest: string;
}

export interface App {
    expose<Output>(operation: Op<Output>, options: ExposeOptions): App;
    fetch(request: Request): Promise<Response>;
}

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
            const output = await operation.handler();
            return Response.json(output);
        },
    };

    return app;
}
