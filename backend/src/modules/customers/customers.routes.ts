import type { Customer, CustomerStatus, Prisma, Role } from "@prisma/client";
import type { Request } from "express";
import express from "express";
import { z } from "zod";

import prisma from "../../config/db";
import { requireAuth, requireRole } from "../../middleware/auth";
import { asyncHandler } from "../../middleware/errorHandler";
import AppError from "../../utils/AppError";

const router = express.Router();

const writeRoles: Role[] = ["ADMIN", "SALES"];
const customerTypes = ["RETAIL", "WHOLESALE", "DISTRIBUTOR"] as const;
const customerStatuses = ["LEAD", "ACTIVE", "INACTIVE"] as const;

type CustomerDetail = Prisma.CustomerGetPayload<{
  include: {
    notes: {
      include: {
        createdBy: {
          select: {
            id: true;
            name: true;
            email: true;
            role: true;
          };
        };
      };
    };
    salesChallans: {
      select: {
        id: true;
        challanNumber: true;
        totalQuantity: true;
        status: true;
        createdById: true;
        createdAt: true;
        updatedAt: true;
      };
    };
  };
}>;

const optionalTrimmedString = z
  .preprocess((value) => {
    if (value === "" || value === null || value === undefined) {
      return undefined;
    }
    return value;
  }, z.string().trim().min(1).optional());

const optionalEmail = z.preprocess((value) => {
  if (value === "" || value === null || value === undefined) {
    return undefined;
  }
  return value;
}, z.string().trim().email().optional());

const optionalDate = z.preprocess((value) => {
  if (value === "" || value === null || value === undefined) {
    return undefined;
  }
  return new Date(String(value));
}, z.date().optional());

const createCustomerSchema = z.object({
  name: z.string().trim().min(1),
  mobile: optionalTrimmedString,
  email: optionalEmail,
  businessName: optionalTrimmedString,
  gstNumber: optionalTrimmedString,
  customerType: z.enum(customerTypes).optional(),
  address: optionalTrimmedString,
  status: z.enum(customerStatuses).optional(),
  followUpDate: optionalDate
});

const updateCustomerSchema = createCustomerSchema.partial().refine(
  (value) => Object.keys(value).length > 0,
  {
    message: "At least one field is required"
  }
);

const noteSchema = z.object({
  note: z.string().trim().min(1)
});

router.use(requireAuth);

function parseCustomerId(value: string): number {
  const id = Number(value);

  if (!Number.isInteger(id) || id <= 0) {
    throw new AppError("Customer not found", 404);
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

function buildCustomerWhere(query: Request["query"]): Prisma.CustomerWhereInput {
  const where: Prisma.CustomerWhereInput = {};
  const search = typeof query.search === "string" ? query.search.trim() : "";
  const status = typeof query.status === "string" ? query.status.trim().toUpperCase() : "";

  if (search) {
    where.OR = [
      { name: { contains: search } },
      { mobile: { contains: search } },
      { businessName: { contains: search } }
    ];
  }

  if (status) {
    if (!customerStatuses.includes(status as CustomerStatus)) {
      throw new AppError("Invalid customer status", 400);
    }

    where.status = status as CustomerStatus;
  }

  return where;
}

function customerListDto(customer: Customer) {
  return {
    id: customer.id,
    name: customer.name,
    mobile: customer.mobile,
    email: customer.email,
    businessName: customer.businessName,
    gstNumber: customer.gstNumber,
    customerType: customer.customerType,
    address: customer.address,
    status: customer.status,
    followUpDate: customer.followUpDate,
    createdAt: customer.createdAt,
    updatedAt: customer.updatedAt
  };
}

function customerDetailDto(customer: CustomerDetail) {
  return {
    ...customerListDto(customer),
    notes: customer.notes.map((note) => ({
      id: note.id,
      customerId: note.customerId,
      note: note.note,
      createdById: note.createdById,
      createdAt: note.createdAt,
      author: {
        id: note.createdBy.id,
        name: note.createdBy.name,
        email: note.createdBy.email,
        role: note.createdBy.role
      }
    })),
    challanHistory: customer.salesChallans.map((challan) => ({
      id: challan.id,
      challanNumber: challan.challanNumber,
      totalQuantity: challan.totalQuantity,
      status: challan.status,
      createdById: challan.createdById,
      createdAt: challan.createdAt,
      updatedAt: challan.updatedAt
    }))
  };
}

async function findCustomerDetailOrThrow(id: number): Promise<CustomerDetail> {
  const customer = await prisma.customer.findUnique({
    where: { id },
    include: {
      notes: {
        orderBy: { createdAt: "desc" },
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
      },
      salesChallans: {
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          challanNumber: true,
          totalQuantity: true,
          status: true,
          createdById: true,
          createdAt: true,
          updatedAt: true
        }
      }
    }
  });

  if (!customer) {
    throw new AppError("Customer not found", 404);
  }

  return customer;
}

router.get(
  "/",
  asyncHandler(async (req, res) => {
    const { page, pageSize, skip } = parsePagination(req.query);
    const where = buildCustomerWhere(req.query);

    const [items, total] = await prisma.$transaction([
      prisma.customer.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip,
        take: pageSize
      }),
      prisma.customer.count({ where })
    ]);

    res.json({
      items: items.map(customerListDto),
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
    const id = parseCustomerId(req.params.id);
    const customer = await findCustomerDetailOrThrow(id);

    res.json(customerDetailDto(customer));
  })
);

router.post(
  "/",
  requireRole(...writeRoles),
  asyncHandler(async (req, res) => {
    const data = createCustomerSchema.parse(req.body);
    const customer = await prisma.customer.create({ data });

    res.status(201).json(customerListDto(customer));
  })
);

router.put(
  "/:id",
  requireRole(...writeRoles),
  asyncHandler(async (req, res) => {
    const id = parseCustomerId(req.params.id);
    const data = updateCustomerSchema.parse(req.body);

    const existing = await prisma.customer.findUnique({
      where: { id },
      select: { id: true }
    });

    if (!existing) {
      throw new AppError("Customer not found", 404);
    }

    const customer = await prisma.customer.update({
      where: { id },
      data
    });

    res.json(customerListDto(customer));
  })
);

router.delete(
  "/:id",
  requireRole(...writeRoles),
  asyncHandler(async (req, res) => {
    const id = parseCustomerId(req.params.id);

    const existing = await prisma.customer.findUnique({
      where: { id },
      select: { id: true }
    });

    if (!existing) {
      throw new AppError("Customer not found", 404);
    }

    await prisma.customer.delete({ where: { id } });

    res.status(204).send();
  })
);

router.post(
  "/:id/notes",
  requireRole(...writeRoles),
  asyncHandler(async (req, res) => {
    const id = parseCustomerId(req.params.id);
    const data = noteSchema.parse(req.body);

    const existing = await prisma.customer.findUnique({
      where: { id },
      select: { id: true }
    });

    if (!existing) {
      throw new AppError("Customer not found", 404);
    }

    const note = await prisma.customerNote.create({
      data: {
        customerId: id,
        note: data.note,
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

    res.status(201).json({
      id: note.id,
      customerId: note.customerId,
      note: note.note,
      createdById: note.createdById,
      createdAt: note.createdAt,
      author: {
        id: note.createdBy.id,
        name: note.createdBy.name,
        email: note.createdBy.email,
        role: note.createdBy.role
      }
    });
  })
);

export default router;
