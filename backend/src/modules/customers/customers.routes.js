const express = require("express");
const { z } = require("zod");

const prisma = require("../../config/db");
const { requireAuth, requireRole } = require("../../middleware/auth");
const { asyncHandler } = require("../../middleware/errorHandler");
const AppError = require("../../utils/AppError");

const router = express.Router();

const writeRoles = ["ADMIN", "SALES"];
const customerTypes = ["RETAIL", "WHOLESALE", "DISTRIBUTOR"];
const customerStatuses = ["LEAD", "ACTIVE", "INACTIVE"];

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
  return new Date(value);
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

function parseCustomerId(value) {
  const id = Number(value);

  if (!Number.isInteger(id) || id <= 0) {
    throw new AppError("Customer not found", 404);
  }

  return id;
}

function parsePagination(query) {
  const page = Math.max(Number.parseInt(query.page, 10) || 1, 1);
  const requestedPageSize = Number.parseInt(query.pageSize, 10) || 20;
  const pageSize = Math.min(Math.max(requestedPageSize, 1), 100);

  return {
    page,
    pageSize,
    skip: (page - 1) * pageSize
  };
}

function buildCustomerWhere(query) {
  const where = {};
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
    if (!customerStatuses.includes(status)) {
      throw new AppError("Invalid customer status", 400);
    }

    where.status = status;
  }

  return where;
}

function customerListDto(customer) {
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

function customerDetailDto(customer) {
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

async function findCustomerDetailOrThrow(id) {
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
        createdById: req.user.id
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

module.exports = router;
