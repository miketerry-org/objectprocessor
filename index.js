// index.js

/**
 * Turbo-Schema entry point.
 *
 * Exports:
 * - The global schema cache singleton (named export: `cache`)
 * - The low-level `compile` function (named export)
 * - The `sanitize` convenience helper (named export)
 *
 * Example:
 * ```js
 * import { cache, compile, sanitize } from "turbo-schema";
 *
 * // Add a schema to the global cache
 * cache.add("user", {
 *   name: { type: "string", required: true },
 *   age: { type: "integer", minValue: 0 }
 * });
 *
 * // Validate using cached schema
 * const user = await cache.user({ name: "Alice", age: 30 });
 *
 * // Compile manually (no cache)
 * const validator = compile({
 *   email: { type: "string", required: true }
 * });
 *
 * const result = await validator({ email: "test@example.com" });
 *
 * // One-off sanitize helper
 * const clean = await sanitize(req.body, userSchema);
 * ```
 */

import { compile } from "./lib/compile.js";
import { cache } from "./lib/cache.js";
import sanitize from "./lib/sanitize.js";

/**
 * @typedef {Object<string, any>} Schema
 * Raw schema definition compatible with `compile()`.
 */

/**
 * @typedef {(obj: Object, path?: string) => Promise<Object>} CompiledValidator
 * Async validator returned from `compile()`.
 */

/**
 * Raw schema compiler.
 *
 * Compiles a schema definition into a reusable async validator.
 *
 * @type {(schema: Schema, options?: Object) => CompiledValidator}
 */
export { compile };

/**
 * Global schema cache singleton.
 *
 * Provides:
 * - `add(key, schema)`
 * - `get(key)`
 * - `has(key)`
 * - `keys()`
 * - Direct callable schema methods (e.g. `cache.user(data)`)
 *
 * @type {import("./lib/cache.js").cache}
 */
export { cache };

/**
 * Convenience one-off validation helper.
 *
 * Compiles and immediately executes validation without caching.
 *
 * @type {(rawData: Object, schema: Schema) => Promise<Object>}
 */
export { sanitize };
