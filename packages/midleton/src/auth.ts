import type { Ctx } from './op.js';

/** What an authenticator returns to say the request is not authenticated. */
export type Rejected = undefined | null | false;

/**
 * Identifies who sent a request. Used with `app.authenticate()`.
 * It gets the whole request, so each scheme can read the place it uses:
 * `bearer()` reads `Authorization`, and other schemes can read other headers or cookies.
 */
export interface Authenticator<C, Caller> {
    /** Value for the `WWW-Authenticate` header of the 401 response, e.g. `'Bearer'`. */
    readonly challenge?: string;
    /** Returns the caller, or `undefined`, `null` or `false` to reject the request. */
    authenticate(request: Request, ctx: C): Caller | Rejected | Promise<Caller | Rejected>;
}

/** Looks up who a bearer token belongs to. May be async, e.g. to read it from a KV. */
export type VerifyToken<C, Caller> = (
    token: string,
    ctx: C,
) => Caller | Rejected | Promise<Caller | Rejected>;

/** Matches `Authorization: Bearer <token>`. The scheme is case-insensitive (RFC 7235). */
const BEARER = /^Bearer +(\S+)$/i;

/**
 * Authenticates with `Authorization: Bearer <token>`.
 * `verify` returns the caller for a valid token, or `undefined`, `null` or `false` to reject it.
 */
export function bearer<C = Ctx, Caller = unknown>(
    verify: VerifyToken<C, Caller>,
): Authenticator<C, Caller> {
    return {
        challenge: 'Bearer',
        authenticate(request, ctx) {
            const token = BEARER.exec(request.headers.get('Authorization') ?? '')?.[1];
            return token === undefined ? undefined : verify(token, ctx);
        },
    };
}
