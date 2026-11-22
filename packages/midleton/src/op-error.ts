/**
 * An error a handler throws on purpose to answer with a specific HTTP status.
 * The message is sent to the client, so do not put internal details in it.
 * Any other thrown error is reported as a generic 500.
 */
export class OpError extends Error {
    /** HTTP status code, e.g. `404`. Used by REST; MCP reports only the message. */
    readonly status: number;

    constructor(status: number, message: string) {
        super(message);
        this.name = 'OpError';
        this.status = status;
    }
}
