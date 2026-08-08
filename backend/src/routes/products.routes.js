const express = require("express");

const prisma = require("../prisma");
const { requireAuth } = require("../middleware/auth");
const { ROLES, requireRoles } = require("../middleware/rbac");
const { asyncHandler } = require("../utils/asyncHandler");
const { productDto } = require("../utils/serialize");
const {
  nonNegativeInt,
  nonNegativeMoney,
  positiveInt,
  requiredString
} = require("../utils/validation");

const router = express.Router();
const readRoles = [ROLES.ADMIN, ROLES.SALES, ROLES.WAREHOUSE, ROLES.ACCOUNTS];
const writeRoles = [ROLES.ADMIN, ROLES.WAREHOUSE];

router.use(requireAuth);

router.get(
  "/",
  requireRoles(...readRoles),
  asyncHandler(async (req, res) => {
    const products = await prisma.product.findMany({
      orderBy: { createdAt: "desc" }
    });
    res.json({ products: products.map(productDto) });
  })
);

router.get(
  "/:id",
  requireRoles(...readRoles),
  asyncHandler(async (req, res) => {
    const id = positiveInt(req.params.id, "id");
    const product = await prisma.product.findUniqueOrThrow({ where: { id } });
    res.json({ product: productDto(product) });
  })
);

router.post(
  "/",
  requireRoles(...writeRoles),
  asyncHandler(async (req, res) => {
    const product = await prisma.product.create({
      data: {
        name: requiredString(req.body.name, "name"),
        sku: requiredString(req.body.sku, "sku"),
        unitPrice: nonNegativeMoney(req.body.unitPrice, "unitPrice"),
        currentStock:
          req.body.currentStock === undefined
            ? 0
            : nonNegativeInt(req.body.currentStock, "currentStock"),
        minStockAlert:
          req.body.minStockAlert === undefined
            ? 0
            : nonNegativeInt(req.body.minStockAlert, "minStockAlert")
      }
    });
    res.status(201).json({ product: productDto(product) });
  })
);

router.patch(
  "/:id",
  requireRoles(...writeRoles),
  asyncHandler(async (req, res) => {
    const id = positiveInt(req.params.id, "id");
    const data = {};

    if (req.body.name !== undefined) data.name = requiredString(req.body.name, "name");
    if (req.body.sku !== undefined) data.sku = requiredString(req.body.sku, "sku");
    if (req.body.unitPrice !== undefined) {
      data.unitPrice = nonNegativeMoney(req.body.unitPrice, "unitPrice");
    }
    if (req.body.currentStock !== undefined) {
      data.currentStock = nonNegativeInt(req.body.currentStock, "currentStock");
    }
    if (req.body.minStockAlert !== undefined) {
      data.minStockAlert = nonNegativeInt(req.body.minStockAlert, "minStockAlert");
    }

    const product = await prisma.product.update({ where: { id }, data });
    res.json({ product: productDto(product) });
  })
);

router.delete(
  "/:id",
  requireRoles(...writeRoles),
  asyncHandler(async (req, res) => {
    const id = positiveInt(req.params.id, "id");
    await prisma.product.delete({ where: { id } });
    res.status(204).send();
  })
);

module.exports = router;
