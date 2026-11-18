import type { Schema } from './schema.js';

/** An operation: a unit of work that Midleton can expose over REST. */
export interface Op<Output> {
    /** Schema for the request body. When set, invalid input is rejected with 400 before the handler runs. */
    readonly input?: Schema<unknown>;
    /** Does the work. Receives the validated input, or `undefined` when no `input` schema is set. */
    readonly handler: (input: unknown) => Output | Promise<Output>;
}

/** Defines an operation. Returns the definition as is; it exists for type inference. */
export function op<Output>(definition: Op<Output>): Op<Output> {
    return definition;
}
