import type { Role } from "@prisma/client";
import type { NextFunction, Request, RequestHandler, Response } from "express";
import jwt, { type JwtPayload } from "jsonwebtoken";

import AppError from "../utils/AppError";

interface AuthTokenPayload extends JwtPayload {
  id: number;
  role: Role;
  email: string;
}

const validRoles: Role[] = ["ADMIN", "SALES", "WAREHOUSE", "ACCOUNTS"];

function getJwtSecret(): string {
  if (!process.env.JWT_SECRET) {
    throw new AppError("JWT_SECRET is not configured", 500);
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
      throw new AppError("Authentication required", 401);
    }

    const payload = jwt.verify(token, getJwtSecret());

    if (!isAuthTokenPayload(payload)) {
      throw new AppError("Invalid or expired token", 401);
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

    next(new AppError("Invalid or expired token", 401));
  }
}

export function requireRole(...roles: Role[]): RequestHandler {
  return (req, res, next) => {
    if (!req.user) {
      return next(new AppError("Authentication required", 401));
    }

    if (!roles.includes(req.user.role)) {
      return next(new AppError("Forbidden", 403));
    }

    next();
  };
}
