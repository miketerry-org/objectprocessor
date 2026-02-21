// index.js

/**
 * Turbo-Schema entry point.
 *
 * This module exports the global schema registry singleton as the default export,
 * and the low-level `compile` function as a named export.
 *
 * Usage examples:
 *
 * ```js
 * import schemas, { compile } from "turbo-schema";
 *
 * // Add a schema to the global registry
 * schemas.add("user", {
 *   name: { type: "string", required: true },
 *   age: { type: "integer", minValue: 0 }
 * });
 *
 * // Validate an object using the compiled schema
 * const user = await schemas.user({ name: "Alice", age: 30 });
 *
 * // Compile a schema manually without adding to the registry
 * const validator = compile({
 *   email: { type: "string", required: true }
 * });
 * const result = await validator({ email: "test@example.com" });
 * ```
 */

import { compile } from "./lib/compile.js";
import schemas from "./lib/schemas.js";

/**
 * Named export: raw schema compiler.
 *
 * Compile a raw schema object into a reusable validator function.
 *
 * @type {function(Object): Promise<function(Object, string=): Promise<Object>>}
 */
export { compile };

/**
 * Default export: global schema registry singleton.
 *
 * Provides methods to register, access, and call precompiled schemas.
 *
 * @type {import('./lib/schemas.js').default}
 */
export default schemas;
