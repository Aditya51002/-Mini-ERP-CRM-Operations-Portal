function notFoundHandler(req, res, next) {
  next({
    status: 404,
    message: `Route not found: ${req.method} ${req.originalUrl}`
  });
}

function errorHandler(error, req, res, next) {
  if (res.headersSent) {
    return next(error);
  }

  if (error.code === "P2002") {
    return res.status(409).json({
      error: "A record with that unique value already exists",
      target: error.meta && error.meta.target
    });
  }

  if (error.code === "P2025") {
    return res.status(404).json({ error: "Record not found" });
  }

  if (error.code === "P2003") {
    return res.status(409).json({ error: "This record is referenced by another record" });
  }

  const status = error.status || 500;
  const payload = {
    error: error.message || "Internal server error"
  };

  if (error.details) {
    Object.assign(payload, error.details);
  }

  if (process.env.NODE_ENV !== "production" && status >= 500) {
    payload.stack = error.stack;
  }

  res.status(status).json(payload);
}

module.exports = {
  errorHandler,
  notFoundHandler
};
