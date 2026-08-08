const { randomUUID } = require("crypto");
const { Prisma } = require("@prisma/client");

const prisma = require("../prisma");
const { httpError } = require("../utils/httpError");

const challanInclude = {
  customer: true,
  createdBy: { select: { id: true, name: true, email: true, role: true } },
  items: { orderBy: { id: "asc" } }
};

function challanNumber(id) {
  return `CH-${String(id).padStart(6, "0")}`;
}

function assertDraft(challan) {
  if (challan.status === "CONFIRMED") {
    throw httpError(409, "Confirmed challans are immutable");
  }

  if (challan.status === "CANCELLED") {
    throw httpError(409, "Cancelled challans cannot be edited");
  }
}

async function createChallan({ customerId, notes, userId }) {
  return prisma.$transaction(async (tx) => {
    const customer = await tx.customer.findUnique({ where: { id: customerId } });
    if (!customer) {
      throw httpError(404, "Customer not found");
    }

    const created = await tx.challan.create({
      data: {
        number: `PENDING-${randomUUID()}`,
        customerId: customer.id,
        customerName: customer.name,
        notes,
        createdById: userId
      }
    });

    return tx.challan.update({
      where: { id: created.id },
      data: { number: challanNumber(created.id) },
      include: challanInclude
    });
  });
}

async function updateDraftChallan({ challanId, notes }) {
  return prisma.$transaction(async (tx) => {
    const challan = await tx.challan.findUnique({ where: { id: challanId } });
    if (!challan) {
      throw httpError(404, "Challan not found");
    }
    assertDraft(challan);

    return tx.challan.update({
      where: { id: challanId },
      data: { notes },
      include: challanInclude
    });
  });
}

async function addItem({ challanId, productId, quantity }) {
  return prisma.$transaction(async (tx) => {
    const challan = await tx.challan.findUnique({ where: { id: challanId } });
    if (!challan) {
      throw httpError(404, "Challan not found");
    }
    assertDraft(challan);

    const product = await tx.product.findUnique({ where: { id: productId } });
    if (!product) {
      throw httpError(404, "Product not found");
    }

    await tx.challanItem.create({
      data: {
        challanId,
        productId,
        productName: product.name,
        sku: product.sku,
        unitPrice: product.unitPrice,
        quantity,
        lineTotal: product.unitPrice.mul(quantity)
      }
    });

    return tx.challan.findUnique({
      where: { id: challanId },
      include: challanInclude
    });
  });
}

async function updateItemQuantity({ challanId, itemId, quantity }) {
  return prisma.$transaction(async (tx) => {
    const item = await tx.challanItem.findFirst({
      where: { id: itemId, challanId },
      include: { challan: true }
    });

    if (!item) {
      throw httpError(404, "Challan item not found");
    }

    assertDraft(item.challan);

    await tx.challanItem.update({
      where: { id: itemId },
      data: {
        quantity,
        lineTotal: item.unitPrice.mul(quantity)
      }
    });

    return tx.challan.findUnique({
      where: { id: challanId },
      include: challanInclude
    });
  });
}

async function removeItem({ challanId, itemId }) {
  return prisma.$transaction(async (tx) => {
    const item = await tx.challanItem.findFirst({
      where: { id: itemId, challanId },
      include: { challan: true }
    });

    if (!item) {
      throw httpError(404, "Challan item not found");
    }

    assertDraft(item.challan);

    await tx.challanItem.delete({ where: { id: itemId } });

    return tx.challan.findUnique({
      where: { id: challanId },
      include: challanInclude
    });
  });
}

function aggregateItemDemand(items) {
  const demand = new Map();

  for (const item of items) {
    const existing = demand.get(item.productId) || {
      productId: item.productId,
      productName: item.productName,
      sku: item.sku,
      requestedQuantity: 0
    };
    existing.requestedQuantity += item.quantity;
    demand.set(item.productId, existing);
  }

  return demand;
}

async function lockProducts(tx, productIds) {
  if (productIds.length === 0) {
    return [];
  }

  return tx.$queryRaw`
    SELECT id, currentStock
    FROM Product
    WHERE id IN (${Prisma.join(productIds)})
    FOR UPDATE
  `;
}

async function confirmChallan({ challanId, userId }) {
  return prisma.$transaction(async (tx) => {
    const challan = await tx.challan.findUnique({
      where: { id: challanId },
      include: { items: { orderBy: { id: "asc" } } }
    });

    if (!challan) {
      throw httpError(404, "Challan not found");
    }

    if (challan.status === "CONFIRMED") {
      throw httpError(409, "Challan is already confirmed");
    }

    if (challan.status === "CANCELLED") {
      throw httpError(409, "Cancelled challans cannot be confirmed");
    }

    if (challan.items.length === 0) {
      throw httpError(422, "Cannot confirm a challan with no items", {
        code: "EMPTY_CHALLAN"
      });
    }

    const demand = aggregateItemDemand(challan.items);
    const productIds = Array.from(demand.keys());
    const lockedProducts = await lockProducts(tx, productIds);
    const stockByProduct = new Map(
      lockedProducts.map((product) => [Number(product.id), Number(product.currentStock)])
    );

    const insufficientProducts = [];
    for (const demandItem of demand.values()) {
      const currentStock = stockByProduct.get(demandItem.productId);
      if (currentStock === undefined || currentStock < demandItem.requestedQuantity) {
        insufficientProducts.push({
          productId: demandItem.productId,
          productName: demandItem.productName,
          sku: demandItem.sku,
          currentStock: currentStock === undefined ? 0 : currentStock,
          requestedQuantity: demandItem.requestedQuantity
        });
      }
    }

    if (insufficientProducts.length > 0) {
      throw httpError(422, "Insufficient stock for one or more products", {
        code: "INSUFFICIENT_STOCK",
        insufficientProducts
      });
    }

    for (const item of challan.items) {
      await tx.product.update({
        where: { id: item.productId },
        data: { currentStock: { decrement: item.quantity } }
      });

      await tx.stockMovement.create({
        data: {
          productId: item.productId,
          movementType: "OUT",
          quantity: item.quantity,
          reason: `Challan #${challan.number} confirmed`,
          challanId: challan.id,
          challanItemId: item.id,
          createdById: userId
        }
      });
    }

    await tx.challan.update({
      where: { id: challan.id },
      data: {
        status: "CONFIRMED",
        confirmedAt: new Date()
      }
    });

    return tx.challan.findUnique({
      where: { id: challan.id },
      include: challanInclude
    });
  });
}

async function cancelChallan({ challanId, userId }) {
  return prisma.$transaction(async (tx) => {
    const challan = await tx.challan.findUnique({
      where: { id: challanId },
      include: { items: { orderBy: { id: "asc" } } }
    });

    if (!challan) {
      throw httpError(404, "Challan not found");
    }

    if (challan.status === "CANCELLED") {
      throw httpError(409, "Challan is already cancelled");
    }

    if (challan.status === "DRAFT") {
      await tx.challan.update({
        where: { id: challan.id },
        data: {
          status: "CANCELLED",
          cancelledAt: new Date()
        }
      });

      return tx.challan.findUnique({
        where: { id: challan.id },
        include: challanInclude
      });
    }

    const productIds = Array.from(new Set(challan.items.map((item) => item.productId)));
    await lockProducts(tx, productIds);

    for (const item of challan.items) {
      await tx.product.update({
        where: { id: item.productId },
        data: { currentStock: { increment: item.quantity } }
      });

      await tx.stockMovement.create({
        data: {
          productId: item.productId,
          movementType: "IN",
          quantity: item.quantity,
          reason: `Challan #${challan.number} cancelled`,
          challanId: challan.id,
          challanItemId: item.id,
          createdById: userId
        }
      });
    }

    await tx.challan.update({
      where: { id: challan.id },
      data: {
        status: "CANCELLED",
        cancelledAt: new Date()
      }
    });

    return tx.challan.findUnique({
      where: { id: challan.id },
      include: challanInclude
    });
  });
}

module.exports = {
  addItem,
  cancelChallan,
  challanInclude,
  confirmChallan,
  createChallan,
  removeItem,
  updateDraftChallan,
  updateItemQuantity
};
