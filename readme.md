# compileObjectSchema

`compileObjectSchema` is a utility for defining and validating structured JavaScript objects. It allows you to define schemas with detailed validation rules for each field, including types, required fields, defaults, transformations, nested objects, arrays, and even complex rules like password strength validation.

It is especially useful for validating configuration objects, API inputs, user data, or any structured JSON where strict validation is required.

---

## Features

- Type validation: `string`, `number`, `integer`, `boolean`, `object`, `array`, `password`, `enum`, `date`, `timestamp`, `time`.
- Nested object schemas and array item validation.
- Conditional required fields (`requiredIf`).
- Automatic transformations (`trim`, `lowercase`, `uppercase`, custom `transform`).
- Default values support.
- Strict mode to reject unknown keys.
- Password validation with rules, blacklist, zxcvbn strength check, and optional bcrypt hashing.
- Custom validator functions for complex rules.

---

## Supported Schema Data Types

| Type                 | Description                            | Options                                                                                                                                   |
| -------------------- | -------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| `string`             | Standard string                        | `required`, `allowEmpty`, `trim`, `lowercase`, `uppercase`, `default`, `validate`                                                         |
| `number`             | Number (floats allowed)                | `required`, `minValue`, `maxValue`, `default`, `validate`                                                                                 |
| `integer`            | Whole number only                      | `required`, `minValue`, `maxValue`, `default`, `validate`                                                                                 |
| `boolean`            | Boolean                                | `required`, `coerce`, `default`, `validate`                                                                                               |
| `object`             | Nested object                          | `schema`, `required`, `default`, `validate`                                                                                               |
| `array`              | Array of items                         | `items` (schema for each item), `required`, `default`, `validate`                                                                         |
| `password`           | Password string                        | `required`, `minLength`, `maxLength`, `minUpper`, `minLower`, `minDigits`, `minSymbols`, `minStrength`, `blacklist`, `hash`, `saltRounds` |
| `enum`               | Must match one of the specified values | `values` array, `required`                                                                                                                |
| `date` / `timestamp` | Date object                            | `required`, `default`, `validate`                                                                                                         |
| `time`               | Time string (`HH:mm[:ss]`)             | `required`, `default`, `validate`                                                                                                         |

---

## Example Usage

Below is an example schema using your PostgreSQL configuration object with `db_port` as an integer:

```javascript
import { compileObjectSchema } from "./lib/compileObjectSchema.js";

const postgresConfigSchema = {
  strict: true, // disallow unknown keys
  db_driver: { type: "string", required: true },
  db_host: { type: "string", required: true },
  db_port: { type: "integer", required: true, minValue: 1, maxValue: 65535 }, // integer type
  db_name: { type: "string", required: true },
  db_username: { type: "string", required: true },
  db_password: { type: "password", required: true, minLength: 8, hash: false },
};

const validatePostgresConfig = compileObjectSchema(postgresConfigSchema);

const configObject = {
  db_driver: "postgres",
  db_host: "localhost",
  db_port: 5432,
  db_name: "test",
  db_username: "postgres",
  db_password: "mike1234terry!",
};

(async () => {
  try {
    const validatedConfig = await validatePostgresConfig(configObject);
    console.log("Validated config:", validatedConfig);
  } catch (err) {
    console.error("Validation errors:", err.errors);
  }
})();
```
