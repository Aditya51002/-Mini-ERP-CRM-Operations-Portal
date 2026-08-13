import type { Prisma, Role } from "@prisma/client";
import express from "express";
import { z } from "zod";

import prisma from "../../config/db";
import { requireAuth, requireRole } from "../../middleware/auth";
import { asyncHandler } from "../../middleware/errorHandler";
import AppError from "../../utils/AppError";

const router = express.Router();
const writeRoles: Role[] = ["ADMIN", "WAREHOUSE"];

const optionalTrimmedString = z
  .preprocess((value) => {
    if (value === "" || value === null || value === undefined) {
      return undefined;
    }
    return value;
  }, z.string().trim().min(1).optional());

const createSupplierSchema = z.object({
  name: z.string().trim().min(1, "Supplier name is required"),
  code: z.string().trim().min(1, "Supplier code is required"),
  contactPerson: optionalTrimmedString,
  email: z.preprocess((val) => (val === "" ? undefined : val), z.string().email().optional()),
  phone: optionalTrimmedString,
  address: optionalTrimmedString,
  gstNumber: optionalTrimmedString
});

const updateSupplierSchema = createSupplierSchema.partial();

// GET /suppliers - List suppliers with pagination and search
router.get(
  "/",
  requireAuth,
  asyncHandler(async (req, res) => {
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const pageSize = Math.min(100, Math.max(1, parseInt(req.query.pageSize as string) || 10));
    const search = ((req.query.search as string) || "").trim();

    const where: Prisma.SupplierWhereInput = search
      ? {
          OR: [
            { name: { contains: search } },
            { code: { contains: search } },
            { contactPerson: { contains: search } },
            { email: { contains: search } }
          ]
        }
      : {};

    const [total, suppliers] = await Promise.all([
      prisma.supplier.count({ where }),
      prisma.supplier.findMany({
        where,
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy: { createdAt: "desc" },
        include: {
          _count: {
            select: { purchaseOrders: true }
          }
        }
      })
    ]);

    res.json({
      data: suppliers,
      pagination: {
        page,
        pageSize,
        total,
        totalPages: Math.ceil(total / pageSize)
      }
    });
  })
);

// GET /suppliers/:id - Get supplier details with PO history
router.get(
  "/:id",
  requireAuth,
  asyncHandler(async (req, res) => {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      throw new AppError("Invalid supplier ID", 400);
    }

    const supplier = await prisma.supplier.findUnique({
      where: { id },
      include: {
        purchaseOrders: {
          orderBy: { createdAt: "desc" },
          take: 20,
          select: {
            id: true,
            poNumber: true,
            totalAmount: true,
            status: true,
            createdAt: true
          }
        }
      }
    });

    if (!supplier) {
      throw new AppError("Supplier not found", 404);
    }

    res.json({ data: supplier });
  })
);

// POST /suppliers - Create supplier
router.post(
  "/",
  requireAuth,
  requireRole(...writeRoles),
  asyncHandler(async (req, res) => {
    const parseResult = createSupplierSchema.safeParse(req.body);
    if (!parseResult.success) {
      throw new AppError(
        `Validation failed: ${parseResult.error.errors.map((e) => `${e.path.join(".")}: ${e.message}`).join(", ")}`,
        400
      );
    }

    const existing = await prisma.supplier.findUnique({
      where: { code: parseResult.data.code }
    });

    if (existing) {
      throw new AppError(`Supplier code '${parseResult.data.code}' already exists`, 409);
    }

    const supplier = await prisma.supplier.create({
      data: parseResult.data
    });

    res.status(201).json({ data: supplier });
  })
);

// PUT /suppliers/:id - Update supplier
router.put(
  "/:id",
  requireAuth,
  requireRole(...writeRoles),
  asyncHandler(async (req, res) => {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      throw new AppError("Invalid supplier ID", 400);
    }

    const parseResult = updateSupplierSchema.safeParse(req.body);
    if (!parseResult.success) {
      throw new AppError(
        `Validation failed: ${parseResult.error.errors.map((e) => `${e.path.join(".")}: ${e.message}`).join(", ")}`,
        400
      );
    }

    const supplier = await prisma.supplier.findUnique({ where: { id } });
    if (!supplier) {
      throw new AppError("Supplier not found", 404);
    }

    if (parseResult.data.code && parseResult.data.code !== supplier.code) {
      const codeExists = await prisma.supplier.findUnique({
        where: { code: parseResult.data.code }
      });
      if (codeExists) {
        throw new AppError(`Supplier code '${parseResult.data.code}' already exists`, 409);
      }
    }

    const updatedSupplier = await prisma.supplier.update({
      where: { id },
      data: parseResult.data
    });

    res.json({ data: updatedSupplier });
  })
);

export default router;
