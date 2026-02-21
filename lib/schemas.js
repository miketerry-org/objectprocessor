// lib/schemas.js
import { compile } from "./compile.js";

/**
 * Schemas registry for Turbo-Schema.
 *
 * This class manages a global registry of compiled schema processors.
 * Each schema is compiled via `compile(schema)` and attached as a
 * callable method for direct use in code (e.g., in MVC controllers or business logic).
 *
 * Example:
 * ```js
 * import schemas from "./schemas.js";
 *
 * schemas.add("user", {
 *   name: { type: "string", required: true },
 *   age: { type: "integer", minValue: 0 }
 * });
 *
 * const validatedUser = await schemas.user({ name: "Alice", age: 30 });
 * ```
 */
class Schemas {
  /** @type {Map<string, Function>} Private registry mapping schema keys to compiled validators */
  #registry = new Map();

  /**
   * Add a schema to the registry and compile it.
   * Also attaches the compiled schema as a callable property on this instance.
   *
   * @param {string} key - Unique key for this schema. Must be a valid JS identifier.
   * @param {object} schema - Raw schema object to compile.
   * @returns {Schemas} Returns this instance for chaining.
   * @throws {Error} If key is invalid, already exists, or conflicts with existing property.
   * @throws {Error} If schema is not a valid object.
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

    if (this.#registry.has(key)) {
      throw new Error(`Schema "${key}" already exists`);
    }

    if (this[key] !== undefined) {
      throw new Error(`Schema key "${key}" conflicts with existing property`);
    }

    if (!schema || typeof schema !== "object") {
      throw new Error("Schema must be an object");
    }

    const compiled = compile(schema);

    this.#registry.set(key, compiled);

    // Attach directly as callable method
    Object.defineProperty(this, key, {
      value: compiled,
      writable: false,
      enumerable: true, // Change to false if you prefer hidden methods
      configurable: false,
    });

    return this;
  }

  /**
   * Retrieve a compiled schema by key.
   *
   * @param {string} key - The schema key.
   * @returns {Function|undefined} Compiled validator function or undefined if not found.
   */
  get(key) {
    return this.#registry.get(key);
  }

  /**
   * Check if a schema exists in the registry.
   *
   * @param {string} key - The schema key.
   * @returns {boolean} True if the schema exists, false otherwise.
   */
  has(key) {
    return this.#registry.has(key);
  }

  /**
   * List all registered schema keys.
   *
   * @returns {string[]} Array of schema keys.
   */
  keys() {
    return [...this.#registry.keys()];
  }
}

/**
 * Global singleton instance of Schemas.
 * All schemas in Turbo-Schema should be registered through this instance.
 */
const schemas = new Schemas();

// Freeze the instance to prevent accidental reassignment of top-level properties
Object.freeze(schemas);

export default schemas;
