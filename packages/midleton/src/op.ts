export interface Op<Output> {
    readonly handler: () => Output | Promise<Output>;
}

export function op<Output>(definition: Op<Output>): Op<Output> {
    return definition;
}
