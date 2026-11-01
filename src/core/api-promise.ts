/** The result of {@link APIPromise.withResponse}. */
export interface WithResponse<T> {
    /** The same value the promise resolves to. */
    data: T;
    /** The HTTP response. Its body has already been read, except for raw responses and streams. */
    response: Response;
    /** Value of the `x-request-id` response header. */
    requestId: string | null;
    /** Informational notices from the `X-DEVUP-Warnings` response header. */
    warnings: string[];
}

/**
 * The promise returned by every API method.
 *
 * Awaiting it gives the response data. `.withResponse()` gives the data
 * together with the HTTP response, its request id and its warnings. The
 * request is sent once, whichever of the two is used, and both may be used.
 */
export class APIPromise<T> extends Promise<T> {
    static override get [Symbol.species](): PromiseConstructor {
        return Promise;
    }

    readonly #source: Promise<WithResponse<T>>;
    #connect: (() => void) | null;

    /**
     * @param source Resolves with the data and the response of the request.
     */
    constructor(source: Promise<WithResponse<T>>) {
        let resolveData: ((value: T) => void) | undefined;
        let rejectData: ((reason: unknown) => void) | undefined;
        super((resolve, reject) => {
            resolveData = resolve;
            rejectData = reject;
        });
        this.#source = source;
        // The promise takes the outcome of `source` only once a handler is attached
        // through `then` (which `await`, `catch` and `finally` all use).
        // A caller that only uses `withResponse()` therefore never leaves an
        // unhandled rejection on this promise.
        this.#connect = () => {
            source.then(
                (result) => resolveData?.(result.data),
                (error: unknown) => rejectData?.(error)
            );
        };
    }

    override then<TResult1 = T, TResult2 = never>(
        onfulfilled?: ((value: T) => TResult1 | PromiseLike<TResult1>) | null,
        onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null
    ): Promise<TResult1 | TResult2> {
        if (this.#connect) {
            const connect = this.#connect;
            this.#connect = null;
            connect();
        }
        return super.then(onfulfilled, onrejected);
    }

    /** Resolves with the data together with the HTTP response, its request id and its warnings. */
    withResponse(): Promise<WithResponse<T>> {
        return this.#source;
    }
}
