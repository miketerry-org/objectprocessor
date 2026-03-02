// lib/cache.js

import { compile } from "./compile.js";

/**
 * @typedef {Object<string, any>} Schema
 * Raw schema definition object accepted by `compile()`.
 */

/**
 * @typedef {(obj: Object, path?: string) => Promise<Object>} CompiledValidator
 * Async validator function returned by `compile()`.
 * Throws an Error with `error.errors` if validation fails.
 */

/**
 * Schemas cache for Turbo-Schema.
 *
 * Manages a global cache of compiled schema validators.
 * Each schema is compiled via `compile(schema)` and attached as a
 * callable method on the instance for direct usage.
 *
 * Example:
 * ```js
 * import { cache } from "./cache.js";
 *
 * cache.add("user", {
 *   name: { type: "string", required: true },
 *   age: { type: "integer", minValue: 0 }
 * });
 *
 * const validatedUser = await cache.user({ name: "Alice", age: 30 });
 * ```
 */
class Cache {
  /**
   * Internal schema registry.
   *
   * @type {Map<string, CompiledValidator>}
   * @private
   */
  #cache = new Map();

  /**
   * Registers and compiles a schema.
   *
   * The compiled validator is:
   * 1. Stored internally in a Map
   * 2. Attached directly to this instance as a callable property
   *
   * Example:
   * ```js
   * cache.add("user", userSchema);
   * await cache.user(data);
   * ```
   *
   * @param {string} key - Unique schema key (must be a valid JS identifier).
   * @param {Schema} schema - Raw schema definition.
   *
   * @returns {Cache} Returns this instance for chaining.
   *
   * @throws {Error} If:
   * - key is invalid
   * - key already exists
   * - key conflicts with existing property
   * - schema is not a valid object
   */
  add(key, schema) {
    if (typeof key !== "string" || !key.trim()) {
      throw new Error("schema key must be a non-empty string");
    }

    if (!/^[a-zA-Z_$][a-zA-Z0-9_$]*$/.test(key)) {
      throw new Error(
        `Invalid schema key "${key}". Must be a valid JS identifier.`
      );
    }

    if (this.#cache.has(key)) {
      throw new Error(`Schema "${key}" already exists`);
    }

    if (this[key] !== undefined) {
      throw new Error(`Schema key "${key}" conflicts with existing property`);
    }

    if (!schema || typeof schema !== "object") {
      throw new Error("Schema must be an object");
    }

    /** @type {CompiledValidator} */
    const compiled = compile(schema);

    this.#cache.set(key, compiled);

    // Attach compiled validator as callable property
    Object.defineProperty(this, key, {
      value: compiled,
      writable: false,
      enumerable: true,
      configurable: false,
    });

    return this;
  }

  /**
   * Retrieves a compiled schema validator.
   *
   * @param {string} key - Schema key.
   * @returns {CompiledValidator | undefined}
   */
  get(key) {
    return this.#cache.get(key);
  }

  /**
   * Checks if a schema exists.
   *
   * @param {string} key - Schema key.
   * @returns {boolean}
   */
  has(key) {
    return this.#cache.has(key);
  }

  /**
   * Lists all registered schema keys.
   *
   * @returns {string[]} Array of schema names.
   */
  keys() {
    return [...this.#cache.keys()];
  }
}

/**
 * Global singleton schema cache instance.
 *
 * All Turbo-Schema schemas should be registered through this object.
 *
 * The instance is frozen to prevent accidental reassignment of
 * top-level properties.
 *
 * @type {Cache}
 */
const cache = new Cache();

Object.freeze(cache);

export { cache };
