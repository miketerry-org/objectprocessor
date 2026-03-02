// ./lib/sanitize.js

import { compile } from "./compile.js";

/**
 * @typedef {Object<string, any>} Schema
 * Raw schema definition compatible with `compile()`.
 */

/**
 * @typedef {(obj: Object, path?: string) => Promise<Object>} CompiledValidator
 * Async validator returned from `compile()`.
 */

/**
 * Sanitizes and validates input data using a schema.
 *
 * This is a lightweight convenience wrapper around `compile(schema)`.
 * It compiles the schema and immediately executes validation.
 *
 * Useful when:
 * - You only need one-off validation
 * - You don't need caching
 * - You want a minimal API surface
 *
 * Example:
 * ```js
 * const clean = await sanitize(req.body, userSchema);
 * ```
 *
 * @param {Object} rawData - Raw input object to validate and sanitize.
 * @param {Schema} schema - Validation schema definition.
 *
 * @returns {Promise<Object>} Sanitized and validated object.
 *
 * @throws {Error} If validation fails.
 * The thrown error includes an `errors` array with detailed validation issues.
 */
export default function sanitize(rawData, schema) {
  /** @type {CompiledValidator} */
  const compiled = compile(schema);

  return compiled(rawData);
}
