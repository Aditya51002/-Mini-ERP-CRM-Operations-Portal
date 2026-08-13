import type { Prisma, PurchaseOrderStatus, Role } from "@prisma/client";
import express from "express";
import { z } from "zod";

import prisma from "../../config/db";
import { requireAuth, requireRole } from "../../middleware/auth";
import { asyncHandler } from "../../middleware/errorHandler";
import AppError from "../../utils/AppError";

const router = express.Router();
const writeRoles: Role[] = ["ADMIN", "WAREHOUSE"];

const createPoItemSchema = z.object({
  productId: z.number().int().positive("Invalid product ID"),
  quantity: z.number().int().positive("Quantity must be greater than zero"),
  unitCost: z.number().positive("Unit cost must be positive")
});

const createPoSchema = z.object({
  supplierId: z.number().int().positive("Supplier is required"),
  notes: z.string().optional(),
  items: z.array(createPoItemSchema).min(1, "At least one item is required")
});

// Helper to generate PO numbers PO-YYYYMMDD-XXXX
async function generatePoNumber(): Promise<string> {
  const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  const count = await prisma.purchaseOrder.count();
  return `PO-${dateStr}-${(count + 1).toString().padStart(4, "0")}`;
}

// GET /purchase-orders - List POs
router.get(
  "/",
  requireAuth,
  asyncHandler(async (req, res) => {
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const pageSize = Math.min(100, Math.max(1, parseInt(req.query.pageSize as string) || 10));
    const search = ((req.query.search as string) || "").trim();
    const status = req.query.status as PurchaseOrderStatus | undefined;

    const where: Prisma.PurchaseOrderWhereInput = {
      ...(status && { status }),
      ...(search && {
        OR: [
          { poNumber: { contains: search } },
          { supplier: { name: { contains: search } } },
          { supplier: { code: { contains: search } } }
        ]
      })
    };

    const [total, orders] = await Promise.all([
      prisma.purchaseOrder.count({ where }),
      prisma.purchaseOrder.findMany({
        where,
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy: { createdAt: "desc" },
        include: {
          supplier: {
            select: { id: true, name: true, code: true }
          },
          createdBy: {
            select: { id: true, name: true, email: true }
          },
          _count: {
            select: { items: true }
          }
        }
      })
    ]);

    res.json({
      data: orders,
      pagination: {
        page,
        pageSize,
        total,
        totalPages: Math.ceil(total / pageSize)
      }
    });
  })
);

// GET /purchase-orders/:id - Get PO details
router.get(
  "/:id",
  requireAuth,
  asyncHandler(async (req, res) => {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      throw new AppError("Invalid Purchase Order ID", 400);
    }

    const order = await prisma.purchaseOrder.findUnique({
      where: { id },
      include: {
        supplier: true,
        createdBy: {
          select: { id: true, name: true, email: true }
        },
        items: {
          include: {
            product: {
              select: { id: true, name: true, sku: true, currentStock: true }
            }
          }
        }
      }
    });

    if (!order) {
      throw new AppError("Purchase Order not found", 404);
    }

    res.json({ data: order });
  })
);

// POST /purchase-orders - Create draft PO
router.post(
  "/",
  requireAuth,
  requireRole(...writeRoles),
  asyncHandler(async (req, res) => {
    const parseResult = createPoSchema.safeParse(req.body);
    if (!parseResult.success) {
      throw new AppError(
        `Validation failed: ${parseResult.error.errors.map((e) => `${e.path.join(".")}: ${e.message}`).join(", ")}`,
        400
      );
    }

    const { supplierId, notes, items } = parseResult.data;

    const supplier = await prisma.supplier.findUnique({ where: { id: supplierId } });
    if (!supplier) {
      throw new AppError("Supplier not found", 404);
    }

    // Verify products exist
    const productIds = items.map((i) => i.productId);
    const products = await prisma.product.findMany({
      where: { id: { in: productIds } }
    });
    if (products.length !== productIds.length) {
      throw new AppError("One or more selected products do not exist", 400);
    }

    const poNumber = await generatePoNumber();
    const totalAmount = items.reduce((sum, item) => sum + item.quantity * item.unitCost, 0);

    const order = await prisma.purchaseOrder.create({
      data: {
        poNumber,
        supplierId,
        notes,
        totalAmount,
        status: "DRAFT",
        createdById: req.user!.id,
        items: {
          create: items.map((item) => ({
            productId: item.productId,
            quantity: item.quantity,
            unitCostSnapshot: item.unitCost
          }))
        }
      },
      include: {
        supplier: true,
        items: { include: { product: true } }
      }
    });

    res.status(201).json({ data: order });
  })
);

// POST /purchase-orders/:id/order - Mark as ORDERED
router.post(
  "/:id/order",
  requireAuth,
  requireRole(...writeRoles),
  asyncHandler(async (req, res) => {
    const id = parseInt(req.params.id);
    if (isNaN(id)) throw new AppError("Invalid PO ID", 400);

    const po = await prisma.purchaseOrder.findUnique({ where: { id } });
    if (!po) throw new AppError("Purchase Order not found", 404);
    if (po.status !== "DRAFT") {
      throw new AppError(`Cannot mark PO as ORDERED from status '${po.status}'`, 400);
    }

    const updatedPo = await prisma.purchaseOrder.update({
      where: { id },
      data: { status: "ORDERED" },
      include: { supplier: true, items: true }
    });

    res.json({ data: updatedPo });
  })
);

// POST /purchase-orders/:id/receive - Goods Receipt Note (GRN) Flow (Atomic stock increment & stock movement log)
router.post(
  "/:id/receive",
  requireAuth,
  requireRole(...writeRoles),
  asyncHandler(async (req, res) => {
    const id = parseInt(req.params.id);
    if (isNaN(id)) throw new AppError("Invalid PO ID", 400);

    const po = await prisma.purchaseOrder.findUnique({
      where: { id },
      include: { items: true }
    });

    if (!po) throw new AppError("Purchase Order not found", 404);
    if (po.status === "RECEIVED") {
      throw new AppError("Purchase Order has already been received", 400);
    }
    if (po.status === "CANCELLED") {
      throw new AppError("Cannot receive a cancelled Purchase Order", 400);
    }

    // Execute atomic transaction for GRN
    const result = await prisma.$transaction(async (tx) => {
      // Update PO status to RECEIVED
      const updatedPo = await tx.purchaseOrder.update({
        where: { id },
        data: { status: "RECEIVED" },
        include: { supplier: true, items: true }
      });

      // Increment stock & create IN stock movements for each line item
      for (const item of po.items) {
        await tx.product.update({
          where: { id: item.productId },
          data: {
            currentStock: { increment: item.quantity }
          }
        });

        await tx.stockMovement.create({
          data: {
            productId: item.productId,
            quantity: item.quantity,
            movementType: "IN",
            reason: `PO Receipt ${po.poNumber}`,
            createdById: req.user!.id
          }
        });
      }

      return updatedPo;
    });

    res.json({ data: result, message: "Goods received successfully and stock updated." });
  })
);

// POST /purchase-orders/:id/cancel - Cancel PO
router.post(
  "/:id/cancel",
  requireAuth,
  requireRole(...writeRoles),
  asyncHandler(async (req, res) => {
    const id = parseInt(req.params.id);
    if (isNaN(id)) throw new AppError("Invalid PO ID", 400);

    const po = await prisma.purchaseOrder.findUnique({ where: { id } });
    if (!po) throw new AppError("Purchase Order not found", 404);
    if (po.status === "RECEIVED") {
      throw new AppError("Cannot cancel a PO that has already been received", 400);
    }

    const updatedPo = await prisma.purchaseOrder.update({
      where: { id },
      data: { status: "CANCELLED" }
    });

    res.json({ data: updatedPo });
  })
);

export default router;
