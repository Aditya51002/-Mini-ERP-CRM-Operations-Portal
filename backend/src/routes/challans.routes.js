const express = require("express");

const prisma = require("../prisma");
const { requireAuth } = require("../middleware/auth");
const { ROLES, requireRoles } = require("../middleware/rbac");
const {
  addItem,
  cancelChallan,
  challanInclude,
  confirmChallan,
  createChallan,
  removeItem,
  updateDraftChallan,
  updateItemQuantity
} = require("../services/challanService");
const { asyncHandler } = require("../utils/asyncHandler");
const { challanDto } = require("../utils/serialize");
const { optionalString, positiveInt } = require("../utils/validation");

const router = express.Router();
const readRoles = [ROLES.ADMIN, ROLES.SALES, ROLES.WAREHOUSE, ROLES.ACCOUNTS];
const actionRoles = [ROLES.ADMIN, ROLES.SALES];

router.use(requireAuth);

router.get(
  "/",
  requireRoles(...readRoles),
  asyncHandler(async (req, res) => {
    const where = {};
    if (req.query.status) {
      where.status = String(req.query.status).toUpperCase();
    }
    if (req.query.customerId) {
      where.customerId = positiveInt(req.query.customerId, "customerId");
    }

    const challans = await prisma.challan.findMany({
      where,
      include: challanInclude,
      orderBy: { createdAt: "desc" },
      take: 200
    });

    res.json({ challans: challans.map(challanDto) });
  })
);

router.get(
  "/:id",
  requireRoles(...readRoles),
  asyncHandler(async (req, res) => {
    const id = positiveInt(req.params.id, "id");
    const challan = await prisma.challan.findUniqueOrThrow({
      where: { id },
      include: challanInclude
    });

    res.json({ challan: challanDto(challan) });
  })
);

router.post(
  "/",
  requireRoles(...actionRoles),
  asyncHandler(async (req, res) => {
    const customerId = positiveInt(req.body.customerId, "customerId");
    const notes = optionalString(req.body.notes);

    const challan = await createChallan({
      customerId,
      notes,
      userId: req.user.id
    });

    res.status(201).json({ challan: challanDto(challan) });
  })
);

router.patch(
  "/:id",
  requireRoles(...actionRoles),
  asyncHandler(async (req, res) => {
    const challan = await updateDraftChallan({
      challanId: positiveInt(req.params.id, "id"),
      notes: optionalString(req.body.notes)
    });

    res.json({ challan: challanDto(challan) });
  })
);

router.post(
  "/:id/items",
  requireRoles(...actionRoles),
  asyncHandler(async (req, res) => {
    const challan = await addItem({
      challanId: positiveInt(req.params.id, "id"),
      productId: positiveInt(req.body.productId, "productId"),
      quantity: positiveInt(req.body.quantity, "quantity")
    });

    res.status(201).json({ challan: challanDto(challan) });
  })
);

router.patch(
  "/:id/items/:itemId",
  requireRoles(...actionRoles),
  asyncHandler(async (req, res) => {
    const challan = await updateItemQuantity({
      challanId: positiveInt(req.params.id, "id"),
      itemId: positiveInt(req.params.itemId, "itemId"),
      quantity: positiveInt(req.body.quantity, "quantity")
    });

    res.json({ challan: challanDto(challan) });
  })
);

router.delete(
  "/:id/items/:itemId",
  requireRoles(...actionRoles),
  asyncHandler(async (req, res) => {
    const challan = await removeItem({
      challanId: positiveInt(req.params.id, "id"),
      itemId: positiveInt(req.params.itemId, "itemId")
    });

    res.json({ challan: challanDto(challan) });
  })
);

router.post(
  "/:id/confirm",
  requireRoles(...actionRoles),
  asyncHandler(async (req, res) => {
    const challan = await confirmChallan({
      challanId: positiveInt(req.params.id, "id"),
      userId: req.user.id
    });

    res.json({ challan: challanDto(challan) });
  })
);

router.post(
  "/:id/cancel",
  requireRoles(...actionRoles),
  asyncHandler(async (req, res) => {
    const challan = await cancelChallan({
      challanId: positiveInt(req.params.id, "id"),
      userId: req.user.id
    });

    res.json({ challan: challanDto(challan) });
  })
);

module.exports = router;
