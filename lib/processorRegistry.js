// lib/processorRegistry.js:

import { buildObjectProcessor } from "./buildObjectProcessor.js";

class ProcessorRegistry {
  constructor() {
    this._registry = new Map();
  }

  /**
   * Add a compiled processor to the registry
   * @param {string} key
   * @param {object} schema
   */
  add(key, schema) {
    if (typeof key !== "string" || !key.trim()) {
      throw new Error("Processor key must be a non-empty string");
    }

    if (!/^[a-zA-Z_$][a-zA-Z0-9_$]*$/.test(key)) {
      throw new Error(
        `Invalid processor key "${key}". Must be a valid JS identifier.`
      );
    }

    if (this._registry.has(key)) {
      throw new Error(`Processor "${key}" already exists`);
    }

    if (this[key] !== undefined) {
      throw new Error(
        `Processor key "${key}" conflicts with existing property`
      );
    }

    if (!schema || typeof schema !== "object") {
      throw new Error("Schema must be an object");
    }

    const compiled = buildObjectProcessor(schema);

    this._registry.set(key, compiled);

    // Attach directly as callable method
    Object.defineProperty(this, key, {
      value: compiled,
      writable: false,
      enumerable: true,
      configurable: false,
    });

    return this;
  }

  /**
   * Get processor by key
   */
  get(key) {
    return this._registry.get(key);
  }

  /**
   * Check if processor exists
   */
  has(key) {
    return this._registry.has(key);
  }

  /**
   * List all processor keys
   */
  keys() {
    return [...this._registry.keys()];
  }
}

/**
 * Global singleton instance
 */
const processorRegistry = new ProcessorRegistry();

// Freeze to prevent accidental mutation of core structure
Object.freeze(processorRegistry);

export default processorRegistry;
