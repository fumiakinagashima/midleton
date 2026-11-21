import type { Schema } from './schema.js';

/** An operation: a unit of work that Midleton can expose over REST. */
export interface Op<Input, Output> {
    /** Schema for the request body. When set, invalid input is rejected with 400 before the handler runs. */
    readonly input?: Schema<Input>;
    /** Does the work. Receives the validated input, or `undefined` when no `input` schema is set. */
    readonly handler: (input: Input) => Output | Promise<Output>;
}

/** Defines an operation. Returns the definition as is; it exists for type inference. */
export function op<Input, Output>(definition: Op<Input, Output>): Op<Input, Output> {
    return definition;
}
