import type { Prisma, Product, Role, StockMovement } from "@prisma/client";
import type { Request } from "express";
import express from "express";
import { z } from "zod";

import prisma from "../../config/db";
import { requireAuth, requireRole } from "../../middleware/auth";
import { asyncHandler } from "../../middleware/errorHandler";
import AppError from "../../utils/AppError";

const router = express.Router();

const writeRoles: Role[] = ["ADMIN", "WAREHOUSE"];

type MovementWithCreatedBy = StockMovement & {
  createdBy?: {
    id: number;
    name: string;
    email: string;
    role: Role;
  };
};

type ProductDetail = Product & {
  stockMovements: MovementWithCreatedBy[];
};

interface LockedProductStock {
  id: number;
  currentStock: number;
}

const optionalTrimmedString = z.preprocess((value) => {
  if (value === "" || value === null || value === undefined) {
    return undefined;
  }
  return value;
}, z.string().trim().min(1).optional());

const moneyValue = z.coerce.number().finite().min(0);
const stockValue = z.coerce.number().int().min(0);

const createProductSchema = z.object({
  name: z.string().trim().min(1),
  sku: z.string().trim().min(1),
  category: optionalTrimmedString,
  unitPrice: moneyValue,
  currentStock: stockValue.optional(),
  minStockAlert: stockValue.optional(),
  location: optionalTrimmedString
});

const updateProductSchema = createProductSchema.partial().refine(
  (value) => Object.keys(value).length > 0,
  {
    message: "At least one field is required"
  }
);

const stockAdjustmentSchema = z.object({
  quantity: z.coerce.number().int().positive(),
  movementType: z.enum(["IN", "OUT"]),
  reason: z.string().trim().min(1)
});

router.use(requireAuth);

function parseProductId(value: string): number {
  const id = Number(value);

  if (!Number.isInteger(id) || id <= 0) {
    throw new AppError("Product not found", 404);
  }

  return id;
}

function parsePagination(query: Request["query"]): {
  page: number;
  pageSize: number;
  skip: number;
} {
  const page = Math.max(Number.parseInt(String(query.page), 10) || 1, 1);
  const requestedPageSize = Number.parseInt(String(query.pageSize), 10) || 20;
  const pageSize = Math.min(Math.max(requestedPageSize, 1), 100);

  return {
    page,
    pageSize,
    skip: (page - 1) * pageSize
  };
}

function buildProductWhere(query: Request["query"]): Prisma.ProductWhereInput {
  const where: Prisma.ProductWhereInput = {};
  const search = typeof query.search === "string" ? query.search.trim() : "";

  if (search) {
    where.OR = [
      { name: { contains: search } },
      { sku: { contains: search } },
      { category: { contains: search } }
    ];
  }

  return where;
}

function toNumber(value: Prisma.Decimal | number | null | undefined): number | null | undefined {
  if (value === null || value === undefined) {
    return value;
  }

  return Number(value);
}

function productDto(product: Product) {
  return {
    id: product.id,
    name: product.name,
    sku: product.sku,
    category: product.category,
    unitPrice: toNumber(product.unitPrice),
    currentStock: product.currentStock,
    minStockAlert: product.minStockAlert,
    lowStock: product.currentStock <= product.minStockAlert,
    location: product.location,
    createdAt: product.createdAt,
    updatedAt: product.updatedAt
  };
}

function movementDto(movement: MovementWithCreatedBy) {
  return {
    id: movement.id,
    productId: movement.productId,
    quantity: movement.quantity,
    movementType: movement.movementType,
    reason: movement.reason,
    createdById: movement.createdById,
    createdAt: movement.createdAt,
    createdBy: movement.createdBy
      ? {
          id: movement.createdBy.id,
          name: movement.createdBy.name,
          email: movement.createdBy.email,
          role: movement.createdBy.role
        }
      : undefined
  };
}

function productDetailDto(product: ProductDetail) {
  return {
    ...productDto(product),
    recentStockMovements: product.stockMovements.map(movementDto)
  };
}

async function findProductOrThrow(id: number): Promise<ProductDetail> {
  const product = await prisma.product.findUnique({
    where: { id },
    include: {
      stockMovements: {
        orderBy: { createdAt: "desc" },
        take: 10,
        include: {
          createdBy: {
            select: {
              id: true,
              name: true,
              email: true,
              role: true
            }
          }
        }
      }
    }
  });

  if (!product) {
    throw new AppError("Product not found", 404);
  }

  return product;
}

router.get(
  "/",
  asyncHandler(async (req, res) => {
    const { page, pageSize, skip } = parsePagination(req.query);
    const where = buildProductWhere(req.query);

    const [items, total] = await prisma.$transaction([
      prisma.product.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip,
        take: pageSize
      }),
      prisma.product.count({ where })
    ]);

    res.json({
      items: items.map(productDto),
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize)
    });
  })
);

router.get(
  "/:id",
  asyncHandler(async (req, res) => {
    const id = parseProductId(req.params.id);
    const product = await findProductOrThrow(id);

    res.json(productDetailDto(product));
  })
);

router.post(
  "/",
  requireRole(...writeRoles),
  asyncHandler(async (req, res) => {
    const data = createProductSchema.parse(req.body);
    const product = await prisma.product.create({ data });

    res.status(201).json(productDto(product));
  })
);

router.put(
  "/:id",
  requireRole(...writeRoles),
  asyncHandler(async (req, res) => {
    const id = parseProductId(req.params.id);
    const data = updateProductSchema.parse(req.body);

    const existing = await prisma.product.findUnique({
      where: { id },
      select: { id: true }
    });

    if (!existing) {
      throw new AppError("Product not found", 404);
    }

    const product = await prisma.product.update({
      where: { id },
      data
    });

    res.json(productDto(product));
  })
);

router.delete(
  "/:id",
  requireRole(...writeRoles),
  asyncHandler(async (req, res) => {
    const id = parseProductId(req.params.id);

    const existing = await prisma.product.findUnique({
      where: { id },
      select: { id: true }
    });

    if (!existing) {
      throw new AppError("Product not found", 404);
    }

    await prisma.product.delete({ where: { id } });

    res.status(204).send();
  })
);

router.post(
  "/:id/stock",
  requireRole(...writeRoles),
  asyncHandler(async (req, res) => {
    const id = parseProductId(req.params.id);
    const data = stockAdjustmentSchema.parse(req.body);

    const result = await prisma.$transaction(async (tx) => {
      const lockedProducts = await tx.$queryRaw<LockedProductStock[]>`
        SELECT id, currentStock
        FROM Product
        WHERE id = ${id}
        FOR UPDATE
      `;

      const lockedProduct = lockedProducts[0];

      if (!lockedProduct) {
        throw new AppError("Product not found", 404);
      }

      const currentStock = Number(lockedProduct.currentStock);

      if (data.movementType === "OUT" && currentStock < data.quantity) {
        throw new AppError("Insufficient stock for OUT movement", 422, {
          productId: id,
          currentStock,
          requestedQuantity: data.quantity
        });
      }

      await tx.product.update({
        where: { id },
        data: {
          currentStock:
            data.movementType === "IN"
              ? { increment: data.quantity }
              : { decrement: data.quantity }
        }
      });

      const movement = await tx.stockMovement.create({
        data: {
          productId: id,
          quantity: data.quantity,
          movementType: data.movementType,
          reason: data.reason,
          createdById: req.user!.id
        },
        include: {
          createdBy: {
            select: {
              id: true,
              name: true,
              email: true,
              role: true
            }
          }
        }
      });

      const product = await tx.product.findUnique({
        where: { id }
      });

      if (!product) {
        throw new AppError("Product not found", 404);
      }

      return {
        product,
        movement
      };
    });

    res.json({
      product: productDto(result.product),
      movement: movementDto(result.movement)
    });
  })
);

router.get(
  "/:id/movements",
  asyncHandler(async (req, res) => {
    const id = parseProductId(req.params.id);
    const { page, pageSize, skip } = parsePagination(req.query);

    const existing = await prisma.product.findUnique({
      where: { id },
      select: { id: true }
    });

    if (!existing) {
      throw new AppError("Product not found", 404);
    }

    const [items, total] = await prisma.$transaction([
      prisma.stockMovement.findMany({
        where: { productId: id },
        orderBy: { createdAt: "desc" },
        skip,
        take: pageSize,
        include: {
          createdBy: {
            select: {
              id: true,
              name: true,
              email: true,
              role: true
            }
          }
        }
      }),
      prisma.stockMovement.count({
        where: { productId: id }
      })
    ]);

    res.json({
      items: items.map(movementDto),
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize)
    });
  })
);

export default router;
