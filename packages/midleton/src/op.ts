import type { Schema } from './schema.js';

/** The `env` type of an app that does not declare its own. */
export type DefaultEnv = Readonly<Record<string, unknown>>;

/** Per-request context passed to handlers. */
export interface Ctx<Env = DefaultEnv> {
    /** Workers bindings and secrets. */
    readonly env: Env;
}

/** An operation: a unit of work that Midleton can expose over REST and MCP. */
export interface Op<Input, Output, C = Ctx> {
    /** What the operation does. Shown to MCP clients so a model can decide when to call it. */
    readonly description?: string;
    /** Schema for the request body. When set, invalid input is rejected with 400 before the handler runs. */
    readonly input?: Schema<Input>;
    /** Does the work. Receives the validated input, or `undefined` when no `input` schema is set. */
    readonly handler: (input: Input, ctx: C) => Output | Promise<Output>;
}

/** An operation with its types erased, for code that stores operations of any type. */
export type AnyOp = Op<unknown, unknown, Ctx<unknown>>;

/** The type of `op()`: defines an operation whose handler receives a context of type `C`. */
export interface DefineOp<C> {
    /** Defines an operation that validates its input with a schema. */
    <Input, Output>(definition: {
        readonly description?: string;
        readonly input: Schema<Input>;
        readonly handler: (input: Input, ctx: C) => Output | Promise<Output>;
    }): Op<Input, Output, C>;

    <Output>(definition: {
        readonly description?: string;
        readonly handler: (input: undefined, ctx: C) => Output | Promise<Output>;
    }): Op<unknown, Output, C>;
}

/** Creates an `op()` function whose handlers receive a context of type `C`. */
export function defineOp<C>(): DefineOp<C> {
    // Returns the definition as is; `DefineOp` exists for type inference.
    return ((definition: unknown) => definition) as DefineOp<C>;
}

/** Defines an operation. Use `app.op()` instead to get a typed `ctx.env`. */
export const op: DefineOp<Ctx> = defineOp<Ctx>();
