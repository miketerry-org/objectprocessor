// lib/buildObjectProcessor.js

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

function cloneDefault(val) {
  if (val && typeof val === "object") {
    return Array.isArray(val) ? [...val] : { ...val };
  }
  return val;
}

export function buildObjectProcessor(schema) {
  const strictMode = schema.strict === true;
  const fieldValidators = [];

  for (const key of Object.keys(schema)) {
    if (key === "strict") continue;

    const rules = schema[key];
    const type = rules.type;

    const nestedValidator =
      type === "object" && rules.schema
        ? buildObjectProcessor(rules.schema)
        : null;

    const arrayItemValidator =
      type === "array" && rules.items ? buildValueValidator(rules.items) : null;

    const enumSet =
      type === "enum" && Array.isArray(rules.values)
        ? new Set(rules.values)
        : null;

    fieldValidators.push(async (obj, path, errors) => {
      const fullPath = path ? `${path}.${key}` : key;
      let value = obj[key];

      const isRequired =
        typeof rules.requiredIf === "function"
          ? rules.requiredIf(obj) === true
          : rules.required === true;

      // Default
      if (
        Object.prototype.hasOwnProperty.call(rules, "default") &&
        (value === undefined || value === null)
      ) {
        value = cloneDefault(rules.default);
        obj[key] = value;
      }

      // Required
      if (isRequired && (value === undefined || value === null)) {
        errors.push({ path: fullPath, type, message: "Field is required" });
        return;
      }
      if (value === undefined) return;

      // String normalization
      if (typeof value === "string") {
        if (rules.trim) value = value.trim();
        if (rules.lowercase) value = value.toLowerCase();
        if (rules.uppercase) value = value.toUpperCase();
        obj[key] = value;
      }

      // Transform
      if (typeof rules.transform === "function") {
        value = await rules.transform(value, obj, key, fullPath);
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
            });
          if (rules.allowEmpty === false && value === "")
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
            });

          if (type === "integer" && !Number.isInteger(value))
            return errors.push({
              path: fullPath,
              type,
              message: "Expected integer",
            });

          if (rules.minValue !== undefined && value < rules.minValue)
            errors.push({
              path: fullPath,
              type,
              message: `Must be >= ${rules.minValue}`,
            });

          if (rules.maxValue !== undefined && value > rules.maxValue)
            errors.push({
              path: fullPath,
              type,
              message: `Must be <= ${rules.maxValue}`,
            });

          obj[key] = value;
          break;

        case "boolean":
          if (typeof value === "string" && rules.coerce)
            value = value === "true" || value === "1";
          if (typeof value !== "boolean")
            return errors.push({
              path: fullPath,
              type,
              message: "Expected boolean",
            });
          obj[key] = value;
          break;

        case "object":
          if (!value || typeof value !== "object" || Array.isArray(value))
            return errors.push({
              path: fullPath,
              type,
              message: "Expected object",
            });
          break;

        case "array":
          if (!Array.isArray(value))
            return errors.push({
              path: fullPath,
              type,
              message: "Expected array",
            });

          if (rules.minItems !== undefined && value.length < rules.minItems)
            errors.push({
              path: fullPath,
              type,
              message: `Min items ${rules.minItems}`,
            });

          if (rules.maxItems !== undefined && value.length > rules.maxItems)
            errors.push({
              path: fullPath,
              type,
              message: `Max items ${rules.maxItems}`,
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
          await validatePassword(value, rules, obj, fullPath, errors, key);
          break;

        default:
          break;
      }

      // Nested object
      if (nestedValidator) {
        try {
          await nestedValidator(value, fullPath);
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
      if (typeof rules.validate === "function") {
        const result = await rules.validate(value, obj);
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

function buildValueValidator(rules) {
  const validator = buildObjectProcessor({ value: rules });
  return async (value, path) => {
    const wrapper = { value };
    const result = await validator(wrapper, path);
    return result.value;
  };
}

async function validatePassword(pw, rules, obj, path, errors, key) {
  if (typeof pw !== "string")
    return errors.push({ path, type: "password", message: "Expected string" });

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
    errors.push({ path, type: "password", message: "Password too common" });

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
    const saltRounds = Math.max(
      typeof rules.saltRounds === "number" ? rules.saltRounds : 12,
      12
    );
    obj[key] = await bcrypt.hash(pw, saltRounds);
  }
}
