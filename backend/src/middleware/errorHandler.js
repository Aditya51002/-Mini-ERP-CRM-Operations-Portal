const { ZodError } = require("zod");

const AppError = require("../utils/AppError");

function asyncHandler(fn) {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

function errorHandler(error, req, res, next) {
  if (res.headersSent) {
    return next(error);
  }

  if (error instanceof AppError) {
    return res.status(error.statusCode).json({
      error: {
        message: error.message,
        details: error.details
      }
    });
  }

  if (error instanceof ZodError) {
    return res.status(400).json({
      error: {
        message: "Validation failed",
        details: error.flatten()
      }
    });
  }

  return res.status(500).json({
    error: {
      message: "Internal server error"
    }
  });
}

module.exports = errorHandler;
module.exports.asyncHandler = asyncHandler;
