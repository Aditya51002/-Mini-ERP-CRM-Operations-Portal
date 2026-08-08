import { Prisma } from "@prisma/client";
import type { NextFunction, Request, RequestHandler, Response } from "express";
import { ZodError } from "zod";

import AppError from "../utils/AppError";

type AsyncRouteHandler = (
  req: Request,
  res: Response,
  next: NextFunction
) => Promise<unknown> | unknown;

export function asyncHandler(fn: AsyncRouteHandler): RequestHandler {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

export default function errorHandler(
  error: Error,
  req: Request,
  res: Response,
  next: NextFunction
): void {
  if (res.headersSent) {
    next(error);
    return;
  }

  if (error instanceof AppError) {
    res.status(error.statusCode).json({
      error: {
        message: error.message,
        details: error.details
      }
    });
    return;
  }

  if (error instanceof ZodError) {
    res.status(400).json({
      error: {
        message: "Validation failed",
        details: error.flatten()
      }
    });
    return;
  }

  if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2003") {
    res.status(409).json({
      error: {
        message: "Cannot delete this record because other records reference it."
      }
    });
    return;
  }

  res.status(500).json({
    error: {
      message: "Internal server error"
    }
  });
}
