const jwt = require("jsonwebtoken");

const prisma = require("../prisma");
const { httpError } = require("../utils/httpError");
const { asyncHandler } = require("../utils/asyncHandler");

function signToken(user) {
  return jwt.sign(
    {
      sub: user.id,
      role: user.role,
      email: user.email
    },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || "8h" }
  );
}

const requireAuth = asyncHandler(async (req, res, next) => {
  const header = req.headers.authorization || "";
  const [scheme, token] = header.split(" ");

  if (scheme !== "Bearer" || !token) {
    throw httpError(401, "Missing bearer token");
  }

  let payload;
  try {
    payload = jwt.verify(token, process.env.JWT_SECRET);
  } catch (error) {
    throw httpError(401, "Invalid or expired token");
  }

  const user = await prisma.user.findUnique({
    where: { id: Number(payload.sub) },
    select: { id: true, name: true, email: true, role: true }
  });

  if (!user) {
    throw httpError(401, "User no longer exists");
  }

  req.user = user;
  next();
});

module.exports = {
  requireAuth,
  signToken
};
