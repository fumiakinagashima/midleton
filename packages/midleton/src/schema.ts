/** A single validation problem, with the location of the offending value. */
export interface Issue {
    /** Keys leading to the offending value, e.g. `['user', 'name']`; empty for the root value. */
    readonly path: readonly string[];
    /** Human-readable description of the problem. */
    readonly message: string;
}

/** Outcome of validating a value: the validated value, or every issue found. */
export type Result<T> =
    | { readonly ok: true; readonly value: T }
    | { readonly ok: false; readonly issues: readonly Issue[] };

/** A JSON Schema document, kept loose on purpose: only builders in this file create them. */
export type JsonSchema = Readonly<Record<string, unknown>>;

/** Validates an unknown value and reports the outcome as a {@link Result}. */
export interface Schema<T> {
    /** Never throws: invalid input is reported through the returned {@link Result}. */
    validate(input: unknown): Result<T>;
    /** Describes the accepted values as JSON Schema, for consumers such as MCP clients. */
    toJSONSchema(): JsonSchema;
    /** Set by {@link optional}: an object field with this schema may be left out. */
    readonly optional?: true;
}

/** The type a schema produces when validation succeeds. */
export type Infer<S> = S extends Schema<infer T> ? T : never;

/** Schema for a string value. */
function string(): Schema<string> {
    return {
        validate(input) {
            if (typeof input !== 'string') {
                return { ok: false, issues: [{ path: [], message: 'Expected string' }] };
            }
            return { ok: true, value: input };
        },
        toJSONSchema() {
            return { type: 'string' };
        },
    };
}

/** Schema for a finite number. NaN and Infinity cannot be written in JSON, so they are rejected. */
function number(): Schema<number> {
    return {
        validate(input) {
            if (typeof input !== 'number' || !Number.isFinite(input)) {
                return { ok: false, issues: [{ path: [], message: 'Expected number' }] };
            }
            return { ok: true, value: input };
        },
        toJSONSchema() {
            return { type: 'number' };
        },
    };
}

/** Schema for a boolean value. */
function boolean(): Schema<boolean> {
    return {
        validate(input) {
            if (typeof input !== 'boolean') {
                return { ok: false, issues: [{ path: [], message: 'Expected boolean' }] };
            }
            return { ok: true, value: input };
        },
        toJSONSchema() {
            return { type: 'boolean' };
        },
    };
}

/** Makes an object field optional: `undefined` is accepted and the field may be left out. */
function optional<T>(schema: Schema<T>): Schema<T | undefined> {
    return {
        optional: true,
        validate(input) {
            return input === undefined ? { ok: true, value: undefined } : schema.validate(input);
        },
        toJSONSchema() {
            return schema.toJSONSchema();
        },
    };
}

/**
 * Schema for a plain object with the given fields.
 * Keys not listed in `shape` are dropped from the validated value.
 */
export function object<Shape extends Record<string, Schema<unknown>>>(
    shape: Shape,
): Schema<{ [K in keyof Shape]: Infer<Shape[K]> }> {
    return {
        validate(input) {
            // Arrays are objects in JS, but they are not a valid input here.
            if (typeof input !== 'object' || input === null || Array.isArray(input)) {
                return { ok: false, issues: [{ path: [], message: 'Expected object' }] };
            }
            const record = input as Record<string, unknown>;
            const value: Record<string, unknown> = {};
            const issues: Issue[] = [];

            // Collect every issue instead of stopping at the first,
            // so clients can fix all fields in one round trip.
            for (const [key, schema] of Object.entries(shape)) {
                const result = schema.validate(record[key]);
                if (result.ok) {
                    // A left-out optional field stays out of the value instead of becoming `undefined`.
                    if (result.value !== undefined) {
                        value[key] = result.value;
                    }
                } else {
                    for (const issue of result.issues) {
                        issues.push({ path: [key, ...issue.path], message: issue.message });
                    }
                }
            }
            return issues.length > 0
                ? { ok: false, issues }
                : { ok: true, value: value as { [K in keyof Shape]: Infer<Shape[K]> } };
        },
        toJSONSchema() {
            return {
                type: 'object',
                properties: Object.fromEntries(
                    Object.entries(shape).map(([key, schema]) => [key, schema.toJSONSchema()]),
                ),
                required: Object.entries(shape)
                    .filter(([, schema]) => !schema.optional)
                    .map(([key]) => key),
            };
        },
    };
}

/** Schema builders. Example: `s.object({ name: s.string() })`. */
export const s = { object, string, number, boolean, optional };
