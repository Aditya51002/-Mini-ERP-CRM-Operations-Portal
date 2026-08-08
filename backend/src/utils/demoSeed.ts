import "dotenv/config";

import prisma from "../config/db";

// This script ADDS demo data on top of the 4 users created by seed.ts.
// It does NOT delete users, so run `npm run seed` first (once), then this.
// Safe to re-run: it clears only customers/products/challans/movements/notes
// before re-inserting, never touches the User table.

async function main(): Promise<void> {
  const admin = await prisma.user.findUniqueOrThrow({ where: { email: "admin@erp.test" } });
  const sales = await prisma.user.findUniqueOrThrow({ where: { email: "sales@erp.test" } });
  const warehouse = await prisma.user.findUniqueOrThrow({ where: { email: "warehouse@erp.test" } });

  await prisma.stockMovement.deleteMany();
  await prisma.challanItem.deleteMany();
  await prisma.salesChallan.deleteMany();
  await prisma.customerNote.deleteMany();
  await prisma.product.deleteMany();
  await prisma.customer.deleteMany();

  const customerData = [
    { name: "Rohit Malhotra", mobile: "9876500001", email: "rohit@malhotratraders.in", businessName: "Malhotra Traders", gstNumber: "07AAAPM1234C1Z5", customerType: "WHOLESALE" as const, address: "Chandni Chowk, Delhi", status: "ACTIVE" as const, followUpDate: new Date(Date.now() + 5 * 86400000) },
    { name: "Priya Sharma", mobile: "9876500002", email: "priya@sharmaretail.in", businessName: "Sharma Retail Store", gstNumber: null, customerType: "RETAIL" as const, address: "MG Road, Jalandhar", status: "LEAD" as const, followUpDate: new Date(Date.now() + 2 * 86400000) },
    { name: "Vikram Distributors", mobile: "9876500003", email: "contact@vikramdist.com", businessName: "Vikram Distributors Pvt Ltd", gstNumber: "03BBBPD5678E1Z2", customerType: "DISTRIBUTOR" as const, address: "Industrial Area, Ludhiana", status: "ACTIVE" as const, followUpDate: null },
    { name: "Anjali Verma", mobile: "9876500004", email: null, businessName: null, gstNumber: null, customerType: "RETAIL" as const, address: "Sector 22, Chandigarh", status: "INACTIVE" as const, followUpDate: null }
  ];

  const customers = [];
  for (const c of customerData) {
    customers.push(await prisma.customer.create({ data: c }));
  }

  await prisma.customerNote.createMany({
    data: [
      { customerId: customers[0].id, note: "Called regarding bulk order for next month. Interested in 500+ units of steel fasteners.", createdById: sales.id },
      { customerId: customers[1].id, note: "First contact — walked into showroom asking about retail pricing. Follow up before Friday.", createdById: sales.id },
      { customerId: customers[2].id, note: "Long-term distributor, pays on time. Renewed annual agreement.", createdById: sales.id }
    ]
  });

  const productData = [
    { name: "Steel Fastener 8mm", sku: "SKU-STL-8MM", category: "Hardware", unitPrice: "12.50", currentStock: 500, minStockAlert: 100, location: "Rack A1" },
    { name: "Steel Fastener 10mm", sku: "SKU-STL-10MM", category: "Hardware", unitPrice: "15.00", currentStock: 40, minStockAlert: 50, location: "Rack A2" },
    { name: "PVC Pipe 2 inch", sku: "SKU-PVC-2IN", category: "Plumbing", unitPrice: "220.00", currentStock: 300, minStockAlert: 60, location: "Rack B1" },
    { name: "PVC Pipe 4 inch", sku: "SKU-PVC-4IN", category: "Plumbing", unitPrice: "410.00", currentStock: 25, minStockAlert: 30, location: "Rack B2" },
    { name: "Copper Wire 1.5sqmm (100m)", sku: "SKU-CU-1P5", category: "Electrical", unitPrice: "1850.00", currentStock: 80, minStockAlert: 20, location: "Rack C1" },
    { name: "LED Bulb 9W", sku: "SKU-LED-9W", category: "Electrical", unitPrice: "95.00", currentStock: 600, minStockAlert: 150, location: "Rack C2" }
  ];

  const products = [];
  for (const p of productData) {
    products.push(await prisma.product.create({ data: p }));
  }

  await prisma.stockMovement.createMany({
    data: products.map((p) => ({
      productId: p.id,
      quantity: p.currentStock,
      movementType: "IN" as const,
      reason: "Initial stock receipt — opening balance",
      createdById: warehouse.id
    }))
  });

  const confirmedItems = [
    { product: products[0], quantity: 20 },
    { product: products[4], quantity: 5 }
  ];
  const confirmed = await prisma.salesChallan.create({
    data: {
      challanNumber: `CH-${new Date().getFullYear()}-0001`,
      customerId: customers[0].id,
      totalQuantity: confirmedItems.reduce((s, i) => s + i.quantity, 0),
      status: "CONFIRMED",
      createdById: sales.id,
      items: { create: confirmedItems.map((i) => ({ productId: i.product.id, productNameSnapshot: i.product.name, skuSnapshot: i.product.sku, unitPriceSnapshot: i.product.unitPrice, quantity: i.quantity })) }
    }
  });
  for (const i of confirmedItems) {
    await prisma.product.update({ where: { id: i.product.id }, data: { currentStock: { decrement: i.quantity } } });
    await prisma.stockMovement.create({ data: { productId: i.product.id, quantity: i.quantity, movementType: "OUT", reason: `Challan #${confirmed.challanNumber} confirmed`, createdById: sales.id } });
  }

  const draftItems = [{ product: products[2], quantity: 10 }];
  await prisma.salesChallan.create({
    data: {
      challanNumber: `CH-${new Date().getFullYear()}-0002`,
      customerId: customers[2].id,
      totalQuantity: draftItems.reduce((s, i) => s + i.quantity, 0),
      status: "DRAFT",
      createdById: sales.id,
      items: { create: draftItems.map((i) => ({ productId: i.product.id, productNameSnapshot: i.product.name, skuSnapshot: i.product.sku, unitPriceSnapshot: i.product.unitPrice, quantity: i.quantity })) }
    }
  });

  const cancelledItems = [{ product: products[5], quantity: 30 }];
  const cancelled = await prisma.salesChallan.create({
    data: {
      challanNumber: `CH-${new Date().getFullYear()}-0003`,
      customerId: customers[1].id,
      totalQuantity: cancelledItems.reduce((s, i) => s + i.quantity, 0),
      status: "CANCELLED",
      createdById: sales.id,
      items: { create: cancelledItems.map((i) => ({ productId: i.product.id, productNameSnapshot: i.product.name, skuSnapshot: i.product.sku, unitPriceSnapshot: i.product.unitPrice, quantity: i.quantity })) }
    }
  });
  await prisma.stockMovement.create({ data: { productId: cancelledItems[0].product.id, quantity: cancelledItems[0].quantity, movementType: "OUT", reason: `Challan #${cancelled.challanNumber} confirmed`, createdById: sales.id } });
  await prisma.stockMovement.create({ data: { productId: cancelledItems[0].product.id, quantity: cancelledItems[0].quantity, movementType: "IN", reason: `Challan #${cancelled.challanNumber} cancelled`, createdById: admin.id } });

  console.log("Demo data seeded: 4 customers, 6 products (2 below low-stock threshold), 3 challans (confirmed/draft/cancelled).");
}

main()
  .catch((error) => { console.error(error); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });
