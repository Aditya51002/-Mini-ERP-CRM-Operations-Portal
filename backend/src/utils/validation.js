const { httpError } = require("./httpError");

function requiredString(value, field) {
  if (typeof value !== "string" || !value.trim()) {
    throw httpError(400, `${field} is required`);
  }
  return value.trim();
}

function optionalString(value) {
  if (value === undefined || value === null || value === "") {
    return null;
  }
  if (typeof value !== "string") {
    throw httpError(400, "Expected a string value");
  }
  return value.trim();
}

function positiveInt(value, field) {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw httpError(400, `${field} must be a positive integer`);
  }
  return parsed;
}

function nonNegativeInt(value, field) {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 0) {
    throw httpError(400, `${field} must be a non-negative integer`);
  }
  return parsed;
}

function nonNegativeMoney(value, field) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) {
    throw httpError(400, `${field} must be a non-negative number`);
  }
  return parsed;
}

function roleValue(value) {
  const role = requiredString(value, "role").toUpperCase();
  const roles = ["ADMIN", "SALES", "WAREHOUSE", "ACCOUNTS"];
  if (!roles.includes(role)) {
    throw httpError(400, "role must be ADMIN, SALES, WAREHOUSE, or ACCOUNTS");
  }
  return role;
}

module.exports = {
  nonNegativeInt,
  nonNegativeMoney,
  optionalString,
  positiveInt,
  requiredString,
  roleValue
};
