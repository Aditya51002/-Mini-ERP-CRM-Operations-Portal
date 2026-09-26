import type { Role } from "@prisma/client";
import type { NextFunction, Request, RequestHandler, Response } from "express";
import jwt, { type JwtPayload } from "jsonwebtoken";

import AppError from "../utils/AppError";
import { ERROR_MESSAGES } from "../constants/messages";
import { HTTP_STATUS } from "../constants/httpStatus";
import { Role as Roles } from "../constants/enums";

interface AuthTokenPayload extends JwtPayload {
  id: number;
  role: Role;
  email: string;
}

const validRoles: Role[] = Object.values(Roles);

function getJwtSecret(): string {
  if (!process.env.JWT_SECRET) {
    throw new AppError(ERROR_MESSAGES.JWT_SECRET_MISSING, HTTP_STATUS.INTERNAL_SERVER_ERROR);
  }

  return process.env.JWT_SECRET;
}

function isAuthTokenPayload(payload: string | JwtPayload): payload is AuthTokenPayload {
  return (
    typeof payload !== "string" &&
    typeof payload.id === "number" &&
    typeof payload.email === "string" &&
    typeof payload.role === "string" &&
    validRoles.includes(payload.role as Role)
  );
}

export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  try {
    const authHeader = req.headers.authorization || "";
    const [scheme, token] = authHeader.split(" ");

    if (scheme !== "Bearer" || !token) {
      throw new AppError(ERROR_MESSAGES.AUTH_REQUIRED, HTTP_STATUS.UNAUTHORIZED);
    }

    const payload = jwt.verify(token, getJwtSecret());

    if (!isAuthTokenPayload(payload)) {
      throw new AppError(ERROR_MESSAGES.AUTH_INVALID, HTTP_STATUS.UNAUTHORIZED);
    }

    req.user = {
      id: payload.id,
      role: payload.role,
      email: payload.email
    };

    next();
  } catch (error) {
    if (error instanceof AppError) {
      next(error);
      return;
    }

    next(new AppError(ERROR_MESSAGES.AUTH_INVALID, HTTP_STATUS.UNAUTHORIZED));
  }
}

export function requireRole(...roles: Role[]): RequestHandler {
  return (req, res, next) => {
    if (!req.user) {
      return next(new AppError(ERROR_MESSAGES.AUTH_REQUIRED, HTTP_STATUS.UNAUTHORIZED));
    }

    if (!roles.includes(req.user.role)) {
      return next(new AppError(ERROR_MESSAGES.AUTH_FORBIDDEN, HTTP_STATUS.FORBIDDEN));
    }

    next();
  };
}
