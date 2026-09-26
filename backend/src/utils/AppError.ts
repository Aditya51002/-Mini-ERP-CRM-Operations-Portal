export default class AppError extends Error {
  statusCode: number;

  details: unknown;

  constructor(message: string, statusCode = 500, details: unknown = null) {
    super(message);
    this.name = "AppError";
    this.statusCode = statusCode;
    this.details = details;
    Error.captureStackTrace(this, this.constructor);
  }
}
