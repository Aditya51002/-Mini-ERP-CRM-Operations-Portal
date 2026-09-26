import type { User } from "@prisma/client";
import bcrypt from "bcryptjs";
import express from "express";
import jwt, { type SignOptions } from "jsonwebtoken";
import { z } from "zod";

import prisma from "../../config/db";
import { appConfig } from "../../config/appConfig";
import { HTTP_STATUS } from "../../constants/httpStatus";
import { ERROR_MESSAGES } from "../../constants/messages";
import { asyncHandler } from "../../middleware/errorHandler";
import AppError from "../../utils/AppError";

const router = express.Router();

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1)
});

type AuthUser = Pick<User, "id" | "role" | "email">;

function signAuthToken(user: AuthUser): string {
  if (!process.env.JWT_SECRET) {
    throw new AppError(ERROR_MESSAGES.JWT_SECRET_MISSING, HTTP_STATUS.INTERNAL_SERVER_ERROR);
  }

  const options: SignOptions = {
    expiresIn: appConfig.jwtExpiresIn as SignOptions["expiresIn"]
  };

  return jwt.sign(
    {
      id: user.id,
      role: user.role,
      email: user.email
    },
    process.env.JWT_SECRET,
    options
  );
}

router.post(
  "/login",
  asyncHandler(async (req, res) => {
    const body = loginSchema.parse(req.body);
    const email = body.email.toLowerCase();

    const user = await prisma.user.findUnique({
      where: { email }
    });

    if (!user) {
      throw new AppError(ERROR_MESSAGES.LOGIN_INVALID, HTTP_STATUS.UNAUTHORIZED);
    }

    const passwordMatches = await bcrypt.compare(body.password, user.passwordHash);

    if (!passwordMatches) {
      throw new AppError(ERROR_MESSAGES.LOGIN_INVALID, HTTP_STATUS.UNAUTHORIZED);
    }

    const token = signAuthToken(user);

    res.json({
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role
      }
    });
  })
);

export default router;
