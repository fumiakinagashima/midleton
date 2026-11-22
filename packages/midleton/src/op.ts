import type { Schema } from './schema.js';

/** An operation: a unit of work that Midleton can expose over REST. */
export interface Op<Input, Output> {
    /** Schema for the request body. When set, invalid input is rejected with 400 before the handler runs. */
    readonly input?: Schema<Input>;
    /** Does the work. Receives the validated input, or `undefined` when no `input` schema is set. */
    readonly handler: (input: Input) => Output | Promise<Output>;
}

/** Defines an operation that validates its input with a schema. */
export function op<Input, Output>(definition: {
    readonly input: Schema<Input>;
    readonly handler: (input: Input) => Output | Promise<Output>;
}): Op<Input, Output>;

/** Defines an operation that takes no input. */
export function op<Output>(definition: {
    readonly handler: () => Output | Promise<Output>;
}): Op<unknown, Output>;

/** Returns the definition as is; the overloads above exist for type inference. */
export function op(definition: Op<unknown, unknown>): Op<unknown, unknown> {
    return definition;
}
