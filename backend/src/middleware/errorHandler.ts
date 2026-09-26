import { Prisma } from "@prisma/client";
import type { NextFunction, Request, RequestHandler, Response } from "express";
import { ZodError } from "zod";

import AppError from "../utils/AppError";
import { ERROR_MESSAGES } from "../constants/messages";
import { HTTP_STATUS } from "../constants/httpStatus";

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
    res.status(HTTP_STATUS.BAD_REQUEST).json({
      error: {
        message: ERROR_MESSAGES.VALIDATION_FAILED,
        details: error.flatten()
      }
    });
    return;
  }

  if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2003") {
    res.status(HTTP_STATUS.CONFLICT).json({
      error: {
        message: ERROR_MESSAGES.RELATED_RECORDS_EXIST
      }
    });
    return;
  }

  res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
    error: {
      message: ERROR_MESSAGES.INTERNAL_ERROR
    }
  });
}
