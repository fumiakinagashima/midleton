const TITLES: Readonly<Record<number, string>> = {
    400: 'Bad Request',
    404: 'Not Found',
    500: 'Internal Server Error',
};

/**
 * Builds an RFC 9457 problem details response.
 * `extra` adds extension members, e.g. `{ issues }`.
 */
export function problem(
    status: number,
    detail: string,
    extra: Readonly<Record<string, unknown>> = {},
): Response {
    return new Response(
        JSON.stringify({ type: 'about:blank', title: TITLES[status], status, detail, ...extra }),
        { status, headers: { 'Content-Type': 'application/problem+json' } },
    );
}
