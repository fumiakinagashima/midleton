/** A matched route: the registered value and the path parameters extracted from the URL. */
export interface Match<T> {
    readonly value: T;
    readonly params: Readonly<Record<string, string>>;
}

export interface Router<T> {
    /** Registers a pattern such as `'GET /users/:id'`. */
    add(pattern: string, value: T): void;
    /** Finds the first route matching the method and path, or `undefined`. */
    match(method: string, pathname: string): Match<T> | undefined;
}

interface Route<T> {
    readonly method: string;
    readonly segments: readonly string[];
    readonly value: T;
}

function splitPath(path: string): string[] {
    // `/users/42` -> ['users', '42']; '/' -> ['']
    return path.split('/').slice(1);
}

function matchSegments(
    segments: readonly string[],
    parts: readonly string[],
): Record<string, string> | undefined {
    if (segments.length !== parts.length) {
        return undefined;
    }
    const params: Record<string, string> = {};
    for (const [i, segment] of segments.entries()) {
        const part = parts[i];
        if (part === undefined) {
            return undefined;
        }
        if (segment.startsWith(':')) {
            if (part === '') {
                return undefined;
            }
            try {
                params[segment.slice(1)] = decodeURIComponent(part);
            } catch {
                // Malformed percent-encoding: treat as no match instead of throwing.
                return undefined;
            }
        } else if (segment !== part) {
            return undefined;
        }
    }
    return params;
}

export function createRouter<T>(): Router<T> {
    const routes: Route<T>[] = [];

    return {
        add(pattern, value) {
            const space = pattern.indexOf(' ');
            const segments = splitPath(pattern.slice(space + 1));

            const names = segments.filter((segment) => segment.startsWith(':'));
            if (new Set(names).size !== names.length) {
                throw new Error(`Duplicate path parameter name in "${pattern}"`);
            }

            routes.push({
                method: pattern.slice(0, space),
                segments,
                value,
            });
        },

        match(method, pathname) {
            const parts = splitPath(pathname);
            for (const route of routes) {
                if (route.method !== method) {
                    continue;
                }
                const params = matchSegments(route.segments, parts);
                if (params !== undefined) {
                    return { value: route.value, params };
                }
            }
            return undefined;
        },
    };
}
