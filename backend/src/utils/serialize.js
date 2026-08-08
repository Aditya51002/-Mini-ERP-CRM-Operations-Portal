function decimalToNumber(value) {
  if (value === null || value === undefined) {
    return value;
  }
  return Number(value);
}

function userDto(user) {
  if (!user) {
    return user;
  }

  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt
  };
}

function productDto(product) {
  if (!product) {
    return product;
  }

  return {
    id: product.id,
    name: product.name,
    sku: product.sku,
    unitPrice: decimalToNumber(product.unitPrice),
    currentStock: product.currentStock,
    minStockAlert: product.minStockAlert,
    lowStock: product.currentStock <= product.minStockAlert,
    createdAt: product.createdAt,
    updatedAt: product.updatedAt
  };
}

function customerDto(customer) {
  if (!customer) {
    return customer;
  }

  return {
    id: customer.id,
    name: customer.name,
    email: customer.email,
    phone: customer.phone,
    address: customer.address,
    gstNumber: customer.gstNumber,
    createdAt: customer.createdAt,
    updatedAt: customer.updatedAt
  };
}

function challanItemDto(item) {
  if (!item) {
    return item;
  }

  return {
    id: item.id,
    challanId: item.challanId,
    productId: item.productId,
    productName: item.productName,
    sku: item.sku,
    unitPrice: decimalToNumber(item.unitPrice),
    quantity: item.quantity,
    lineTotal: decimalToNumber(item.lineTotal),
    createdAt: item.createdAt,
    updatedAt: item.updatedAt
  };
}

function challanDto(challan) {
  if (!challan) {
    return challan;
  }

  const items = challan.items ? challan.items.map(challanItemDto) : undefined;
  const total = items ? items.reduce((sum, item) => sum + item.lineTotal, 0) : undefined;

  return {
    id: challan.id,
    number: challan.number,
    customerId: challan.customerId,
    customerName: challan.customerName,
    status: challan.status,
    notes: challan.notes,
    createdById: challan.createdById,
    confirmedAt: challan.confirmedAt,
    cancelledAt: challan.cancelledAt,
    createdAt: challan.createdAt,
    updatedAt: challan.updatedAt,
    customer: challan.customer ? customerDto(challan.customer) : undefined,
    createdBy: challan.createdBy ? userDto(challan.createdBy) : undefined,
    items,
    total
  };
}

function stockMovementDto(movement) {
  if (!movement) {
    return movement;
  }

  return {
    id: movement.id,
    productId: movement.productId,
    movementType: movement.movementType,
    quantity: movement.quantity,
    reason: movement.reason,
    challanId: movement.challanId,
    challanItemId: movement.challanItemId,
    createdById: movement.createdById,
    createdAt: movement.createdAt,
    product: movement.product ? productDto(movement.product) : undefined,
    createdBy: movement.createdBy ? userDto(movement.createdBy) : undefined
  };
}

module.exports = {
  challanDto,
  challanItemDto,
  customerDto,
  productDto,
  stockMovementDto,
  userDto
};
