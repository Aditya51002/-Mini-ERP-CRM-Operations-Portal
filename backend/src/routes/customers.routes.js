const express = require("express");

const prisma = require("../prisma");
const { requireAuth } = require("../middleware/auth");
const { ROLES, requireRoles } = require("../middleware/rbac");
const { asyncHandler } = require("../utils/asyncHandler");
const { customerDto } = require("../utils/serialize");
const { optionalString, positiveInt, requiredString } = require("../utils/validation");

const router = express.Router();
const readRoles = [ROLES.ADMIN, ROLES.SALES, ROLES.WAREHOUSE, ROLES.ACCOUNTS];
const writeRoles = [ROLES.ADMIN, ROLES.SALES];

router.use(requireAuth);

router.get(
  "/",
  requireRoles(...readRoles),
  asyncHandler(async (req, res) => {
    const customers = await prisma.customer.findMany({
      orderBy: { createdAt: "desc" }
    });
    res.json({ customers: customers.map(customerDto) });
  })
);

router.get(
  "/:id",
  requireRoles(...readRoles),
  asyncHandler(async (req, res) => {
    const id = positiveInt(req.params.id, "id");
    const customer = await prisma.customer.findUniqueOrThrow({ where: { id } });
    res.json({ customer: customerDto(customer) });
  })
);

router.post(
  "/",
  requireRoles(...writeRoles),
  asyncHandler(async (req, res) => {
    const customer = await prisma.customer.create({
      data: {
        name: requiredString(req.body.name, "name"),
        email: optionalString(req.body.email),
        phone: optionalString(req.body.phone),
        address: optionalString(req.body.address),
        gstNumber: optionalString(req.body.gstNumber)
      }
    });
    res.status(201).json({ customer: customerDto(customer) });
  })
);

router.patch(
  "/:id",
  requireRoles(...writeRoles),
  asyncHandler(async (req, res) => {
    const id = positiveInt(req.params.id, "id");
    const data = {};

    if (req.body.name !== undefined) data.name = requiredString(req.body.name, "name");
    if (req.body.email !== undefined) data.email = optionalString(req.body.email);
    if (req.body.phone !== undefined) data.phone = optionalString(req.body.phone);
    if (req.body.address !== undefined) data.address = optionalString(req.body.address);
    if (req.body.gstNumber !== undefined) data.gstNumber = optionalString(req.body.gstNumber);

    const customer = await prisma.customer.update({ where: { id }, data });
    res.json({ customer: customerDto(customer) });
  })
);

router.delete(
  "/:id",
  requireRoles(...writeRoles),
  asyncHandler(async (req, res) => {
    const id = positiveInt(req.params.id, "id");
    await prisma.customer.delete({ where: { id } });
    res.status(204).send();
  })
);

module.exports = router;
