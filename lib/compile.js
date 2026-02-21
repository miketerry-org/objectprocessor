// lib/compile.js

import bcrypt from "bcryptjs";
import zxcvbn from "zxcvbn";

const DEFAULT_PASSWORD_BLACKLIST = new Set([
  "123456",
  "password",
  "123456789",
  "12345678",
  "12345",
  "qwerty",
  "abc123",
  "football",
  "monkey",
  "letmein",
  "shadow",
  "master",
  "696969",
  "123123",
  "password1",
]);

function deepClone(val) {
  if (val && typeof val === "object") {
    return Array.isArray(val)
      ? val.map(v => deepClone(v))
      : Object.fromEntries(
          Object.entries(val).map(([k, v]) => [k, deepClone(v)])
        );
  }
  return val;
}

export function compile(schema, { nestedStrict = false } = {}) {
  const strictMode = schema.strict === true;
  const fieldValidators = [];

  for (const key of Object.keys(schema)) {
    if (key === "strict") continue;

    const fieldSchema = schema[key];
    const type = fieldSchema.type;

    // Recursive compilation for nested objects
    const nestedValidator =
      type === "object" && fieldSchema.schema
        ? compile(fieldSchema.schema, { nestedStrict })
        : null;

    // Array item validator
    const arrayItemValidator =
      type === "array" && fieldSchema.items
        ? buildValueValidator(fieldSchema.items)
        : null;

    const enumSet =
      type === "enum" && Array.isArray(fieldSchema.values)
        ? new Set(fieldSchema.values)
        : null;

    fieldValidators.push(async (obj, path, errors) => {
      const fullPath = path ? `${path}.${key}` : key;
      let value = obj[key];

      const isRequired =
        typeof fieldSchema.requiredIf === "function"
          ? fieldSchema.requiredIf(obj) === true
          : fieldSchema.required === true;

      // Apply default
      if (
        Object.prototype.hasOwnProperty.call(fieldSchema, "default") &&
        (value === undefined || value === null)
      ) {
        value = deepClone(fieldSchema.default);
        obj[key] = value;
      }

      // Required check
      if (isRequired && (value === undefined || value === null)) {
        errors.push({
          path: fullPath,
          type,
          message: "Field is required",
        });
        return;
      }
      if (value === undefined) return;

      // String normalization
      if (typeof value === "string") {
        if (fieldSchema.trim) value = value.trim();
        if (fieldSchema.lowercase) value = value.toLowerCase();
        if (fieldSchema.uppercase) value = value.toUpperCase();
        obj[key] = value;
      }

      // Transform
      if (typeof fieldSchema.transform === "function") {
        value = await fieldSchema.transform(value, obj, key, fullPath);
        obj[key] = value;
      }

      // --- TYPE VALIDATION ---
      switch (type) {
        case "string":
          if (typeof value !== "string")
            return errors.push({
              path: fullPath,
              type,
              message: "Expected string",
              expected: "string",
              actual: typeof value,
            });
          if (fieldSchema.allowEmpty === false && value === "")
            errors.push({
              path: fullPath,
              type,
              message: "Empty string not allowed",
            });
          break;

        case "number":
        case "integer":
          if (typeof value === "string") value = Number(value);
          if (typeof value !== "number" || Number.isNaN(value))
            return errors.push({
              path: fullPath,
              type,
              message: "Expected number",
              expected: "number",
              actual: value,
            });
          if (type === "integer" && !Number.isInteger(value))
            return errors.push({
              path: fullPath,
              type,
              message: "Expected integer",
            });
          if (
            fieldSchema.minValue !== undefined &&
            value < fieldSchema.minValue
          )
            errors.push({
              path: fullPath,
              type,
              message: `Must be >= ${fieldSchema.minValue}`,
            });
          if (
            fieldSchema.maxValue !== undefined &&
            value > fieldSchema.maxValue
          )
            errors.push({
              path: fullPath,
              type,
              message: `Must be <= ${fieldSchema.maxValue}`,
            });
          obj[key] = value;
          break;

        case "boolean":
          if (typeof value === "string" && fieldSchema.coerce)
            value = value === "true" || value === "1";
          if (typeof value !== "boolean")
            return errors.push({
              path: fullPath,
              type,
              message: "Expected boolean",
              expected: "boolean",
              actual: typeof value,
            });
          obj[key] = value;
          break;

        case "object":
          if (!value || typeof value !== "object" || Array.isArray(value))
            return errors.push({
              path: fullPath,
              type,
              message: "Expected object",
              expected: "object",
              actual: typeof value,
            });
          break;

        case "array":
          if (!Array.isArray(value))
            return errors.push({
              path: fullPath,
              type,
              message: "Expected array",
              expected: "array",
              actual: typeof value,
            });
          if (
            fieldSchema.minItems !== undefined &&
            value.length < fieldSchema.minItems
          )
            errors.push({
              path: fullPath,
              type,
              message: `Min items ${fieldSchema.minItems}`,
            });
          if (
            fieldSchema.maxItems !== undefined &&
            value.length > fieldSchema.maxItems
          )
            errors.push({
              path: fullPath,
              type,
              message: `Max items ${fieldSchema.maxItems}`,
            });
          break;

        case "enum":
          if (!enumSet)
            return errors.push({
              path: fullPath,
              type,
              message: "Enum values required",
            });
          if (!enumSet.has(value))
            return errors.push({
              path: fullPath,
              type,
              message: `Value must be one of: ${[...enumSet].join(", ")}`,
            });
          break;

        case "date":
        case "timestamp": {
          const d = value instanceof Date ? value : new Date(value);
          if (Number.isNaN(d.getTime()))
            return errors.push({
              path: fullPath,
              type,
              message: "Invalid date",
            });
          obj[key] = d;
          break;
        }

        case "time":
          if (
            typeof value !== "string" ||
            !/^\d{2}:\d{2}(:\d{2})?$/.test(value)
          )
            return errors.push({
              path: fullPath,
              type,
              message: "Invalid time format HH:mm[:ss]",
            });
          break;

        case "password":
          await validatePassword(
            value,
            fieldSchema,
            obj,
            fullPath,
            errors,
            key
          );
          break;

        default:
          break;
      }

      // Nested object validation
      if (nestedValidator) {
        try {
          await nestedValidator(value, fullPath);
          // Apply nested strict mode if enabled
          if (nestedStrict) {
            for (const nestedKey of Object.keys(value)) {
              if (!fieldSchema.schema.hasOwnProperty(nestedKey)) {
                errors.push({
                  path: `${fullPath}.${nestedKey}`,
                  type: "unknown",
                  message: "Unknown key",
                });
              }
            }
          }
        } catch (err) {
          if (err.errors) errors.push(...err.errors);
        }
      }

      // Array items
      if (arrayItemValidator && Array.isArray(value)) {
        for (let i = 0; i < value.length; i++) {
          try {
            value[i] = await arrayItemValidator(value[i], `${fullPath}[${i}]`);
          } catch (err) {
            if (err.errors) errors.push(...err.errors);
          }
        }
      }

      // Custom validator
      if (typeof fieldSchema.validate === "function") {
        const result = await fieldSchema.validate(value, obj);
        if (result !== true)
          errors.push({
            path: fullPath,
            type,
            message:
              typeof result === "string" ? result : "Custom validation failed",
          });
      }
    });
  }

  return async function validate(obj, path = "") {
    const errors = [];

    if (strictMode) {
      for (const key of Object.keys(obj)) {
        if (!schema.hasOwnProperty(key))
          errors.push({
            path: path ? `${path}.${key}` : key,
            type: "unknown",
            message: "Unknown key",
          });
      }
    }

    for (const validator of fieldValidators) await validator(obj, path, errors);

    if (errors.length) {
      const err = new Error("Validation failed");
      err.errors = errors;
      throw err;
    }

    return obj;
  };
}

// Wraps a value validator for arrays
function buildValueValidator(fieldSchema) {
  const validator = compile({ value: fieldSchema });
  return async (value, path) => {
    const wrapper = { value };
    const result = await validator(wrapper, path);
    return result.value;
  };
}

// Password validation helper
async function validatePassword(pw, rules, obj, path, errors, key) {
  if (typeof pw !== "string")
    return errors.push({
      path,
      type: "password",
      message: "Expected string",
    });

  const before = errors.length;
  const count = r => (pw.match(r) || []).length;

  if (rules.minLength && pw.length < rules.minLength)
    errors.push({
      path,
      type: "password",
      message: `Min length ${rules.minLength}`,
    });

  if (rules.maxLength && pw.length > rules.maxLength)
    errors.push({
      path,
      type: "password",
      message: `Max length ${rules.maxLength}`,
    });

  if (rules.minUpper && count(/[A-Z]/g) < rules.minUpper)
    errors.push({
      path,
      type: "password",
      message: `Min uppercase ${rules.minUpper}`,
    });

  if (rules.minLower && count(/[a-z]/g) < rules.minLower)
    errors.push({
      path,
      type: "password",
      message: `Min lowercase ${rules.minLower}`,
    });

  if (rules.minDigits && count(/[0-9]/g) < rules.minDigits)
    errors.push({
      path,
      type: "password",
      message: `Min digits ${rules.minDigits}`,
    });

  if (rules.minSymbols && count(/[^A-Za-z0-9]/g) < rules.minSymbols)
    errors.push({
      path,
      type: "password",
      message: `Min symbols ${rules.minSymbols}`,
    });

  if (rules.minStrength !== undefined) {
    const { score } = zxcvbn(pw);
    if (score < rules.minStrength)
      errors.push({
        path,
        type: "password",
        message: `Password too weak (${score})`,
      });
  }

  if (DEFAULT_PASSWORD_BLACKLIST.has(pw))
    errors.push({
      path,
      type: "password",
      message: "Password too common",
    });

  if (rules.blacklist) {
    if (Array.isArray(rules.blacklist) && rules.blacklist.includes(pw))
      errors.push({ path, type: "password", message: "Password blacklisted" });

    if (
      typeof rules.blacklist === "function" &&
      (await rules.blacklist(pw, obj))
    )
      errors.push({ path, type: "password", message: "Password blacklisted" });
  }

  // Hash only if no password errors
  if (errors.length === before && rules.hash === true) {
    const saltRounds =
      typeof rules.saltRounds === "number"
        ? Math.max(rules.saltRounds, 12)
        : 12;
    obj[key] = await bcrypt.hash(pw, saltRounds);
  }
}
