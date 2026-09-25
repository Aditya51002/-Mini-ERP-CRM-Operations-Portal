import {
  Prisma,
  type ChallanItem,
  type Product,
  type SalesChallanStatus as ChallanStatus
} from "@prisma/client";
import type { Request } from "express";
import express from "express";
import { z } from "zod";

import prisma from "../../config/db";
import { appConfig } from "../../config/appConfig";
import { HTTP_STATUS } from "../../constants/httpStatus";
import { Role, SalesChallanStatus } from "../../constants/enums";
import { ERROR_MESSAGES } from "../../constants/messages";
import { requireAuth, requireRole } from "../../middleware/auth";
import { asyncHandler } from "../../middleware/errorHandler";
import AppError from "../../utils/AppError";
import { generateInvoicePdf } from "./invoice";
import { cancelChallan, confirmChallan } from "./challans.service";

const router = express.Router();

const writeRoles: Role[] = [Role.ADMIN, Role.SALES];
const challanStatuses = Object.values(SalesChallanStatus);

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
    throw new AppError(ERROR_MESSAGES.CHALLAN_NOT_FOUND, HTTP_STATUS.NOT_FOUND);
  }

  return id;
}

function parsePagination(query: Request["query"]): {
  page: number;
  pageSize: number;
  skip: number;
} {
  const page = Math.max(Number.parseInt(String(query.page), 10) || 1, 1);
  const requestedPageSize =
    Number.parseInt(String(query.pageSize), 10) || appConfig.defaultPageSize;
  const pageSize = Math.min(Math.max(requestedPageSize, 1), appConfig.maxPageSize);

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
    if (!challanStatuses.includes(status as ChallanStatus)) {
      throw new AppError(ERROR_MESSAGES.CHALLAN_STATUS_INVALID, HTTP_STATUS.BAD_REQUEST);
    }
    where.status = status as ChallanStatus;
  }

  if (query.customerId !== undefined) {
    const customerId = Number(query.customerId);
    if (!Number.isInteger(customerId) || customerId <= 0) {
      throw new AppError(ERROR_MESSAGES.CUSTOMER_ID_INVALID, HTTP_STATUS.BAD_REQUEST);
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
    throw new AppError(ERROR_MESSAGES.PRODUCTS_NOT_FOUND, HTTP_STATUS.NOT_FOUND, {
      productIds: missingProductIds
    });
  }

  return items.map((item) => {
    const product = productById.get(item.productId);

    if (!product) {
      throw new AppError(ERROR_MESSAGES.PRODUCTS_NOT_FOUND, HTTP_STATUS.NOT_FOUND, {
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
    throw new AppError(ERROR_MESSAGES.CHALLAN_NOT_FOUND, HTTP_STATUS.NOT_FOUND);
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
  if (!challan) throw new AppError(ERROR_MESSAGES.CHALLAN_NOT_FOUND, HTTP_STATUS.NOT_FOUND);
  return challan;
}

async function createDraftChallan(
  data: CreateChallanInput,
  userId: number
): Promise<ChallanDetail> {
  return prisma.$transaction(async (tx) => {
    const customer = await tx.customer.findUnique({
      where: { id: data.customerId },
      select: { id: true }
    });

    if (!customer) {
      throw new AppError(ERROR_MESSAGES.CUSTOMER_NOT_FOUND, HTTP_STATUS.NOT_FOUND);
    }

    const snapshotRows = await snapshotItems(tx, data.items);
    const totalQuantity = snapshotRows.reduce((sum, item) => sum + item.quantity, 0);
    const challanNumber = await nextChallanNumber(tx);

    return tx.salesChallan.create({
      data: {
        challanNumber,
        customerId: data.customerId,
        totalQuantity,
        status: SalesChallanStatus.DRAFT,
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

    if (challan.status !== SalesChallanStatus.CONFIRMED) {
      throw new AppError(ERROR_MESSAGES.INVOICE_CONFIRMED_ONLY, HTTP_STATUS.CONFLICT);
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
        throw new AppError(ERROR_MESSAGES.CHALLAN_NOT_FOUND, HTTP_STATUS.NOT_FOUND);
      }

      if (existing.status !== SalesChallanStatus.DRAFT) {
        throw new AppError(ERROR_MESSAGES.CHALLAN_EDIT_DRAFT_ONLY, HTTP_STATUS.CONFLICT);
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
    await confirmChallan(prisma, id, req.user!.id);
    const challan = await findChallanDetailOrThrow(id);
    res.json(challanDto(challan));
  })
);

router.post(
  "/:id/cancel",
  requireRole(...writeRoles),
  asyncHandler(async (req, res) => {
    const id = parseChallanId(req.params.id);
    await cancelChallan(prisma, id, req.user!.id);
    const challan = await findChallanDetailOrThrow(id);
    res.json(challanDto(challan));
  })
);

export default router;
