import type { Schema } from './schema.js';

/** Per-request context passed to handlers. */
export interface Ctx {
    /** Workers bindings and secrets. Cast to your own type where you use them. */
    readonly env: Readonly<Record<string, unknown>>;
}

/** An operation: a unit of work that Midleton can expose over REST. */
export interface Op<Input, Output> {
    /** What the operation does. Shown to MCP cluents so a model can decide when to call it. */
    readonly description?: string;
    /** Schema for the request body. When set, invalid input is rejected with 400 before the handler runs. */
    readonly input?: Schema<Input>;
    /** Does the work. Receives the validated input, or `undefined` when no `input` schema is set. */
    readonly handler: (input: Input, ctx: Ctx) => Output | Promise<Output>;
}

/** Defines an operation that validates its input with a schema. */
export function op<Input, Output>(definition: {
    readonly description?: string;
    readonly input: Schema<Input>;
    readonly handler: (input: Input, ctx: Ctx) => Output | Promise<Output>;
}): Op<Input, Output>;

/** Defines an operation that takes no input. */
export function op<Output>(definition: {
    readonly description?: string;
    readonly handler: (input: undefined, ctx: Ctx) => Output | Promise<Output>;
}): Op<unknown, Output>;

/** Returns the definition as is; the overloads above exist for type inference. */
export function op(definition: unknown): unknown {
    return definition;
}
