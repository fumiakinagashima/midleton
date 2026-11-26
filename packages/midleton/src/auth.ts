import type { Middleware } from './app.js';
import type { Ctx } from './op.js';
import { problem } from './problem.js';

/** Decides whether a bearer token is valid. May be async, e.g. to look the token up in a KV. */
export type VerifyToken<C> = (token: string, ctx: C) => boolean | Promise<boolean>;

/** Matches `Authorization: Bearer <token>`. The scheme is case-insensitive (RFC 7235). */
const BEARER = /^Bearer +(\S+)$/i;

/**
 * Builds middleware that requires a valid `Authorization: Bearer <token>` header.
 * A missing, malformed or rejected token gets a 401 problem response, and the handler never runs.
 */
export function bearer<C = Ctx>(verify: VerifyToken<C>): Middleware<C> {
    return async (request, ctx, next) => {
        const token = BEARER.exec(request.headers.get('Authorization') ?? '')?.[1];

        let valid = false;
        if (token !== undefined) {
            try {
                valid = await verify(token, ctx);
            } catch {
                // A failing verifier must not let the request through, and details stay server-side.
                valid = false;
            }
        }
        if (!valid) {
            const response = problem(401, 'Missing or invalid bearer token');
            response.headers.set('WWW-Authenticate', 'Bearer');
            return response;
        }
        return next();
    };
}
