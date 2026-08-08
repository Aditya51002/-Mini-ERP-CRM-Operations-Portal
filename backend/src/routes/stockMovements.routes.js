const { Prisma } = require("@prisma/client");
const express = require("express");

const prisma = require("../prisma");
const { requireAuth } = require("../middleware/auth");
const { ROLES, requireRoles } = require("../middleware/rbac");
const { asyncHandler } = require("../utils/asyncHandler");
const { httpError } = require("../utils/httpError");
const { stockMovementDto } = require("../utils/serialize");
const { optionalString, positiveInt, requiredString } = require("../utils/validation");

const router = express.Router();
const readRoles = [ROLES.ADMIN, ROLES.SALES, ROLES.WAREHOUSE, ROLES.ACCOUNTS];
const writeRoles = [ROLES.ADMIN, ROLES.WAREHOUSE];

router.use(requireAuth);

router.get(
  "/",
  requireRoles(...readRoles),
  asyncHandler(async (req, res) => {
    const where = {};
    if (req.query.productId) {
      where.productId = positiveInt(req.query.productId, "productId");
    }

    const movements = await prisma.stockMovement.findMany({
      where,
      orderBy: { createdAt: "desc" },
      include: {
        product: true,
        createdBy: { select: { id: true, name: true, email: true, role: true } }
      },
      take: 200
    });

    res.json({ stockMovements: movements.map(stockMovementDto) });
  })
);

router.post(
  "/",
  requireRoles(...writeRoles),
  asyncHandler(async (req, res) => {
    const productId = positiveInt(req.body.productId, "productId");
    const quantity = positiveInt(req.body.quantity, "quantity");
    const movementType = requiredString(req.body.movementType, "movementType").toUpperCase();
    const reason = optionalString(req.body.reason) || "Manual stock adjustment";

    if (!["IN", "OUT"].includes(movementType)) {
      throw httpError(400, "movementType must be IN or OUT");
    }

    const movement = await prisma.$transaction(async (tx) => {
      const lockedProducts = await tx.$queryRaw`
        SELECT id, currentStock
        FROM Product
        WHERE id = ${productId}
        FOR UPDATE
      `;

      const lockedProduct = lockedProducts[0];
      if (!lockedProduct) {
        throw httpError(404, "Product not found");
      }

      if (movementType === "OUT" && Number(lockedProduct.currentStock) < quantity) {
        throw httpError(422, "Insufficient stock for manual adjustment", {
          code: "INSUFFICIENT_STOCK",
          insufficientProducts: [
            {
              productId,
              currentStock: Number(lockedProduct.currentStock),
              requestedQuantity: quantity
            }
          ]
        });
      }

      await tx.product.update({
        where: { id: productId },
        data: {
          currentStock:
            movementType === "IN"
              ? { increment: quantity }
              : { decrement: quantity }
        }
      });

      return tx.stockMovement.create({
        data: {
          productId,
          movementType,
          quantity,
          reason,
          createdById: req.user.id
        },
        include: {
          product: true,
          createdBy: { select: { id: true, name: true, email: true, role: true } }
        }
      });
    });

    res.status(201).json({ stockMovement: stockMovementDto(movement) });
  })
);

module.exports = router;
