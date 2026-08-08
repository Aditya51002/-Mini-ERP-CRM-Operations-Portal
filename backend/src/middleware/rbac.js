const { httpError } = require("../utils/httpError");

const ROLES = {
  ADMIN: "ADMIN",
  SALES: "SALES",
  WAREHOUSE: "WAREHOUSE",
  ACCOUNTS: "ACCOUNTS"
};

function requireRoles(...roles) {
  return (req, res, next) => {
    if (!req.user) {
      return next(httpError(401, "Authentication required"));
    }

    if (!roles.includes(req.user.role)) {
      return next(httpError(403, "You do not have permission to perform this action"));
    }

    next();
  };
}

module.exports = {
  ROLES,
  requireRoles
};
