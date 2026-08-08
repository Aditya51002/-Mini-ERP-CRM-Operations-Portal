import type { Role } from "@prisma/client";
import "express-serve-static-core";

declare module "express-serve-static-core" {
  interface Request {
    user?: {
      id: number;
      role: Role;
      email: string;
    };
  }
}
