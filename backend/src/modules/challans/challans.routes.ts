import { Prisma, type ChallanItem, type Product, type Role, type SalesChallanStatus } from "@prisma/client";
import type { Request } from "express";
import express from "express";
import { z } from "zod";

import prisma from "../../config/db";
import { requireAuth, requireRole } from "../../middleware/auth";
import { asyncHandler } from "../../middleware/errorHandler";
import AppError from "../../utils/AppError";
import { generateInvoicePdf } from "./invoice";

const router = express.Router();

const writeRoles: Role[] = ["ADMIN", "SALES"];
const challanStatuses = ["DRAFT", "CONFIRMED", "CANCELLED"] as const;

const challanCustomerSelect = {
  id: true,
  name: true,
  mobile: true,
  businessName: true,
  address: true
} satisfies Prisma.CustomerSelect;

const challanCreatedBySelect = {
  id: true,
  name: true,
  email: true,
  role: true
} satisfies Prisma.UserSelect;

const challanListInclude = {
  customer: {
    select: challanCustomerSelect
  },
  createdBy: {
    select: challanCreatedBySelect
  }
} satisfies Prisma.SalesChallanInclude;

const challanDetailInclude = {
  ...challanListInclude,
  items: {
    orderBy: { id: "asc" }
  }
} satisfies Prisma.SalesChallanInclude;

type ChallanList = Prisma.SalesChallanGetPayload<{
  include: typeof challanListInclude;
}>;

type ChallanDetail = Prisma.SalesChallanGetPayload<{
  include: typeof challanDetailInclude;
}>;

interface RequestedDemand {
  productId: number;
  productNameSnapshot: string;
  skuSnapshot: string;
  requestedQuantity: number;
}

interface LockedProduct {
  id: number;
  name: string;
  sku: string;
  unitPrice: Prisma.Decimal;
  currentStock: number;
}

interface InsufficientProduct {
  productId: number;
  productName: string;
  sku: string;
  availableQuantity: number;
  requestedQuantity: number;
}

const itemSchema = z.object({
  productId: z.coerce.number().int().positive(),
  quantity: z.coerce.number().int().positive()
});

const createChallanSchema = z.object({
  customerId: z.coerce.number().int().positive(),
  items: z.array(itemSchema).min(1)
});

const updateChallanSchema = z.object({
  items: z.array(itemSchema).min(1)
});

type ChallanInputItem = z.infer<typeof itemSchema>;
type CreateChallanInput = z.infer<typeof createChallanSchema>;

router.use(requireAuth);

function parseChallanId(value: string): number {
  const id = Number(value);

  if (!Number.isInteger(id) || id <= 0) {
    throw new AppError("Challan not found", 404);
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

function buildChallanWhere(query: Request["query"]): Prisma.SalesChallanWhereInput {
  const where: Prisma.SalesChallanWhereInput = {};
  const status = typeof query.status === "string" ? query.status.trim().toUpperCase() : "";

  if (status) {
    if (!challanStatuses.includes(status as SalesChallanStatus)) {
      throw new AppError("Invalid challan status", 400);
    }
    where.status = status as SalesChallanStatus;
  }

  if (query.customerId !== undefined) {
    const customerId = Number(query.customerId);
    if (!Number.isInteger(customerId) || customerId <= 0) {
      throw new AppError("Invalid customerId", 400);
    }
    where.customerId = customerId;
  }

  return where;
}

function toNumber(value: Prisma.Decimal | number | null | undefined): number | null | undefined {
  if (value === null || value === undefined) {
    return value;
  }

  return Number(value);
}

function challanItemDto(item: ChallanItem) {
  return {
    id: item.id,
    challanId: item.challanId,
    productId: item.productId,
    productNameSnapshot: item.productNameSnapshot,
    skuSnapshot: item.skuSnapshot,
    unitPriceSnapshot: toNumber(item.unitPriceSnapshot),
    quantity: item.quantity
  };
}

function challanDto(challan: ChallanDetail | ChallanList) {
  return {
    id: challan.id,
    challanNumber: challan.challanNumber,
    customerId: challan.customerId,
    totalQuantity: challan.totalQuantity,
    status: challan.status,
    createdById: challan.createdById,
    createdAt: challan.createdAt,
    updatedAt: challan.updatedAt,
    customer: challan.customer
      ? {
          id: challan.customer.id,
          name: challan.customer.name,
          mobile: challan.customer.mobile,
          businessName: challan.customer.businessName
        }
      : undefined,
    createdBy: challan.createdBy
      ? {
          id: challan.createdBy.id,
          name: challan.createdBy.name,
          email: challan.createdBy.email,
          role: challan.createdBy.role
        }
      : undefined,
    items: "items" in challan ? challan.items.map(challanItemDto) : undefined
  };
}

function listChallanDto(challan: ChallanList) {
  const dto = challanDto(challan);
  delete dto.items;
  return dto;
}

function aggregateRequestedItems(items: ChallanItem[]): Map<number, RequestedDemand> {
  const demand = new Map<number, RequestedDemand>();

  for (const item of items) {
    const existing = demand.get(item.productId) || {
      productId: item.productId,
      productNameSnapshot: item.productNameSnapshot,
      skuSnapshot: item.skuSnapshot,
      requestedQuantity: 0
    };

    existing.requestedQuantity += item.quantity;
    demand.set(item.productId, existing);
  }

  return demand;
}

async function lockProductsForUpdate(
  tx: Prisma.TransactionClient,
  productIds: number[]
): Promise<LockedProduct[]> {
  if (productIds.length === 0) {
    return [];
  }

  // Prisma's model API has no SELECT ... FOR UPDATE. This raw MySQL row lock
  // prevents concurrent challan confirms from both reading the same stock and
  // driving inventory negative before either transaction commits.
  return tx.$queryRaw<LockedProduct[]>`
    SELECT id, name, sku, unitPrice, currentStock
    FROM Product
    WHERE id IN (${Prisma.join(productIds)})
    FOR UPDATE
  `;
}

async function nextChallanNumber(tx: Prisma.TransactionClient): Promise<string> {
  const year = new Date().getFullYear();
  const prefix = `CH-${year}-`;
  const latest = await tx.salesChallan.findFirst({
    where: {
      challanNumber: {
        startsWith: prefix
      }
    },
    orderBy: {
      challanNumber: "desc"
    },
    select: {
      challanNumber: true
    }
  });

  const lastNumber = latest ? Number(latest.challanNumber.slice(prefix.length)) : 0;
  return `${prefix}${String(lastNumber + 1).padStart(4, "0")}`;
}

async function snapshotItems(
  tx: Prisma.TransactionClient,
  items: ChallanInputItem[]
): Promise<Prisma.ChallanItemUncheckedCreateWithoutChallanInput[]> {
  const productIds = [...new Set(items.map((item) => item.productId))];
  const products = await tx.product.findMany({
    where: {
      id: {
        in: productIds
      }
    }
  });
  const productById = new Map<number, Product>(products.map((product) => [product.id, product]));
  const missingProductIds = productIds.filter((productId) => !productById.has(productId));

  if (missingProductIds.length > 0) {
    throw new AppError("One or more products were not found", 404, {
      productIds: missingProductIds
    });
  }

  return items.map((item) => {
    const product = productById.get(item.productId);

    if (!product) {
      throw new AppError("One or more products were not found", 404, {
        productIds: [item.productId]
      });
    }

    return {
      productId: product.id,
      productNameSnapshot: product.name,
      skuSnapshot: product.sku,
      unitPriceSnapshot: product.unitPrice,
      quantity: item.quantity
    };
  });
}

async function findChallanDetailOrThrow(id: number): Promise<ChallanDetail> {
  const challan = await prisma.salesChallan.findUnique({
    where: { id },
    include: challanDetailInclude
  });

  if (!challan) {
    throw new AppError("Challan not found", 404);
  }

  return challan;
}

async function findChallanDetailInTransactionOrThrow(
  tx: Prisma.TransactionClient,
  id: number
): Promise<ChallanDetail> {
  const challan = await tx.salesChallan.findUnique({
    where: { id },
    include: challanDetailInclude
  });

  if (!challan) {
    throw new AppError("Challan not found", 404);
  }

  return challan;
}

async function createDraftChallan(data: CreateChallanInput, userId: number): Promise<ChallanDetail> {
  return prisma.$transaction(async (tx) => {
    const customer = await tx.customer.findUnique({
      where: { id: data.customerId },
      select: { id: true }
    });

    if (!customer) {
      throw new AppError("Customer not found", 404);
    }

    const snapshotRows = await snapshotItems(tx, data.items);
    const totalQuantity = snapshotRows.reduce((sum, item) => sum + item.quantity, 0);
    const challanNumber = await nextChallanNumber(tx);

    return tx.salesChallan.create({
      data: {
        challanNumber,
        customerId: data.customerId,
        totalQuantity,
        status: "DRAFT",
        createdById: userId,
        items: {
          create: snapshotRows
        }
      },
      include: challanDetailInclude
    });
  });
}

router.get(
  "/",
  asyncHandler(async (req, res) => {
    const { page, pageSize, skip } = parsePagination(req.query);
    const where = buildChallanWhere(req.query);

    const [items, total] = await prisma.$transaction([
      prisma.salesChallan.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip,
        take: pageSize,
        include: challanListInclude
      }),
      prisma.salesChallan.count({ where })
    ]);

    res.json({
      items: items.map(listChallanDto),
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
    const id = parseChallanId(req.params.id);
    const challan = await findChallanDetailOrThrow(id);

    res.json(challanDto(challan));
  })
);

router.post(
  "/",
  requireRole(...writeRoles),
  asyncHandler(async (req, res) => {
    const data = createChallanSchema.parse(req.body);
    const challan = await createDraftChallan(data, req.user!.id);

    res.status(201).json(challanDto(challan));
  })
);

router.get(
  "/:id/invoice",
  asyncHandler(async (req, res) => {
    const id = parseChallanId(req.params.id);
    const challan = await findChallanDetailOrThrow(id);

    if (challan.status !== "CONFIRMED") {
      throw new AppError("Invoice is only available for confirmed challans", 409);
    }

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="invoice-${challan.challanNumber}.pdf"`
    );
    generateInvoicePdf(challan, res);
  })
);

router.put(
  "/:id",
  requireRole(...writeRoles),
  asyncHandler(async (req, res) => {
    const id = parseChallanId(req.params.id);
    const data = updateChallanSchema.parse(req.body);

    const challan = await prisma.$transaction(async (tx) => {
      const existing = await tx.salesChallan.findUnique({
        where: { id },
        select: {
          id: true,
          status: true
        }
      });

      if (!existing) {
        throw new AppError("Challan not found", 404);
      }

      if (existing.status !== "DRAFT") {
        throw new AppError("Only DRAFT challans can be edited", 409);
      }

      const snapshotRows = await snapshotItems(tx, data.items);
      const totalQuantity = snapshotRows.reduce((sum, item) => sum + item.quantity, 0);

      await tx.challanItem.deleteMany({
        where: { challanId: id }
      });

      await tx.salesChallan.update({
        where: { id },
        data: {
          totalQuantity,
          items: {
            create: snapshotRows
          }
        }
      });

      return findChallanDetailInTransactionOrThrow(tx, id);
    });

    res.json(challanDto(challan));
  })
);

router.post(
  "/:id/confirm",
  requireRole(...writeRoles),
  asyncHandler(async (req, res) => {
    const id = parseChallanId(req.params.id);

    const challan = await prisma.$transaction(async (tx) => {
      const existing = await tx.salesChallan.findUnique({
        where: { id },
        include: {
          items: {
            orderBy: { id: "asc" }
          }
        }
      });

      if (!existing) {
        throw new AppError("Challan not found", 404);
      }

      if (existing.status === "CONFIRMED") {
        throw new AppError("Challan is already confirmed", 409);
      }

      if (existing.status === "CANCELLED") {
        throw new AppError("Cancelled challans cannot be confirmed", 409);
      }

      if (existing.items.length === 0) {
        throw new AppError("Cannot confirm a challan without items", 422);
      }

      const demand = aggregateRequestedItems(existing.items);
      const productIds = [...demand.keys()];
      const lockedProducts = await lockProductsForUpdate(tx, productIds);
      const lockedProductById = new Map(
        lockedProducts.map((product) => [
          Number(product.id),
          {
            productId: Number(product.id),
            productName: product.name,
            sku: product.sku,
            currentStock: Number(product.currentStock)
          }
        ])
      );

      const insufficientProducts: InsufficientProduct[] = [];

      for (const demandItem of demand.values()) {
        const lockedProduct = lockedProductById.get(demandItem.productId);
        const availableQuantity = lockedProduct ? lockedProduct.currentStock : 0;

        if (!lockedProduct || availableQuantity < demandItem.requestedQuantity) {
          insufficientProducts.push({
            productId: demandItem.productId,
            productName: demandItem.productNameSnapshot,
            sku: demandItem.skuSnapshot,
            availableQuantity,
            requestedQuantity: demandItem.requestedQuantity
          });
        }
      }

      if (insufficientProducts.length > 0) {
        throw new AppError("Insufficient stock for one or more products", 422, {
          insufficientProducts
        });
      }

      for (const item of existing.items) {
        await tx.product.update({
          where: { id: item.productId },
          data: {
            currentStock: {
              decrement: item.quantity
            }
          }
        });

        await tx.stockMovement.create({
          data: {
            productId: item.productId,
            quantity: item.quantity,
            movementType: "OUT",
            reason: `Challan #${existing.challanNumber} confirmed`,
            createdById: req.user!.id
          }
        });
      }

      await tx.salesChallan.update({
        where: { id },
        data: {
          status: "CONFIRMED"
        }
      });

      return findChallanDetailInTransactionOrThrow(tx, id);
    });

    res.json(challanDto(challan));
  })
);

router.post(
  "/:id/cancel",
  requireRole(...writeRoles),
  asyncHandler(async (req, res) => {
    const id = parseChallanId(req.params.id);

    const challan = await prisma.$transaction(async (tx) => {
      const existing = await tx.salesChallan.findUnique({
        where: { id },
        include: {
          items: {
            orderBy: { id: "asc" }
          }
        }
      });

      if (!existing) {
        throw new AppError("Challan not found", 404);
      }

      if (existing.status === "CANCELLED") {
        throw new AppError("Challan is already cancelled", 409);
      }

      if (existing.status === "DRAFT") {
        await tx.salesChallan.update({
          where: { id },
          data: {
            status: "CANCELLED"
          }
        });

        return findChallanDetailInTransactionOrThrow(tx, id);
      }

      const productIds = [...new Set(existing.items.map((item) => item.productId))];
      await lockProductsForUpdate(tx, productIds);

      for (const item of existing.items) {
        await tx.product.update({
          where: { id: item.productId },
          data: {
            currentStock: {
              increment: item.quantity
            }
          }
        });

        await tx.stockMovement.create({
          data: {
            productId: item.productId,
            quantity: item.quantity,
            movementType: "IN",
            reason: `Challan #${existing.challanNumber} cancelled`,
            createdById: req.user!.id
          }
        });
      }

      await tx.salesChallan.update({
        where: { id },
        data: {
          status: "CANCELLED"
        }
      });

      return findChallanDetailInTransactionOrThrow(tx, id);
    });

    res.json(challanDto(challan));
  })
);

export default router;
