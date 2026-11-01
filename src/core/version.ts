declare const __DEVUPAI_VERSION__: string | undefined;

/**
 * Version of this SDK, taken from `package.json` when the package is built.
 * Sent in the `User-Agent` header as `devupai-node/<version>`.
 */
export const VERSION: string = typeof __DEVUPAI_VERSION__ === "string" ? __DEVUPAI_VERSION__ : "unknown";
