const bcrypt = require("bcryptjs");
const express = require("express");

const prisma = require("../prisma");
const { requireAuth, signToken } = require("../middleware/auth");
const { ROLES, requireRoles } = require("../middleware/rbac");
const { asyncHandler } = require("../utils/asyncHandler");
const { httpError } = require("../utils/httpError");
const { userDto } = require("../utils/serialize");
const { requiredString, roleValue } = require("../utils/validation");

const router = express.Router();

function requireJwtSecret() {
  if (!process.env.JWT_SECRET) {
    throw httpError(500, "JWT_SECRET is not configured");
  }
}

router.post(
  "/bootstrap",
  asyncHandler(async (req, res) => {
    requireJwtSecret();

    const existingUsers = await prisma.user.count();
    if (existingUsers > 0) {
      throw httpError(409, "Bootstrap is disabled after the first user is created");
    }

    const name = requiredString(req.body.name, "name");
    const email = requiredString(req.body.email, "email").toLowerCase();
    const password = requiredString(req.body.password, "password");

    if (password.length < 8) {
      throw httpError(400, "password must be at least 8 characters");
    }

    const passwordHash = await bcrypt.hash(password, 12);
    const user = await prisma.user.create({
      data: { name, email, passwordHash, role: ROLES.ADMIN }
    });

    res.status(201).json({ user: userDto(user), token: signToken(user) });
  })
);

router.post(
  "/login",
  asyncHandler(async (req, res) => {
    requireJwtSecret();

    const email = requiredString(req.body.email, "email").toLowerCase();
    const password = requiredString(req.body.password, "password");

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      throw httpError(401, "Invalid email or password");
    }

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) {
      throw httpError(401, "Invalid email or password");
    }

    res.json({ user: userDto(user), token: signToken(user) });
  })
);

router.get(
  "/me",
  requireAuth,
  asyncHandler(async (req, res) => {
    res.json({ user: req.user });
  })
);

router.get(
  "/users",
  requireAuth,
  requireRoles(ROLES.ADMIN),
  asyncHandler(async (req, res) => {
    const users = await prisma.user.findMany({
      orderBy: { createdAt: "desc" }
    });
    res.json({ users: users.map(userDto) });
  })
);

router.post(
  "/users",
  requireAuth,
  requireRoles(ROLES.ADMIN),
  asyncHandler(async (req, res) => {
    const name = requiredString(req.body.name, "name");
    const email = requiredString(req.body.email, "email").toLowerCase();
    const password = requiredString(req.body.password, "password");
    const role = roleValue(req.body.role);

    if (password.length < 8) {
      throw httpError(400, "password must be at least 8 characters");
    }

    const passwordHash = await bcrypt.hash(password, 12);
    const user = await prisma.user.create({
      data: { name, email, passwordHash, role }
    });

    res.status(201).json({ user: userDto(user) });
  })
);

module.exports = router;
