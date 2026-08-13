import express from "express";

import prisma from "../../config/db";
import { requireAuth } from "../../middleware/auth";
import { asyncHandler } from "../../middleware/errorHandler";

const router = express.Router();

// GET /reports/dashboard - Analytics & KPI Dashboard
router.get(
  "/dashboard",
  requireAuth,
  asyncHandler(async (req, res) => {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const [
      customersCount,
      productsCount,
      suppliersCount,
      activePOsCount,
      lowStockProducts,
      confirmedChallans,
      allProducts
    ] = await Promise.all([
      prisma.customer.count(),
      prisma.product.count(),
      prisma.supplier.count(),
      prisma.purchaseOrder.count({
        where: { status: { in: ["DRAFT", "ORDERED"] } }
      }),
      prisma.product.findMany({
        where: {
          currentStock: { lte: prisma.product.fields.minStockAlert }
        },
        select: {
          id: true,
          name: true,
          sku: true,
          currentStock: true,
          minStockAlert: true,
          unitPrice: true
        }
      }),
      prisma.salesChallan.findMany({
        where: {
          status: "CONFIRMED"
        },
        include: {
          customer: { select: { name: true, businessName: true } },
          items: true
        },
        orderBy: { createdAt: "asc" }
      }),
      prisma.product.findMany({
        select: {
          category: true,
          currentStock: true,
          unitPrice: true
        }
      })
    ]);

    // Calculate Sales Revenue Trend over last 30 days
    const dailyMap: Record<string, { date: string; revenue: number; quantity: number; count: number }> = {};
    let totalRevenue = 0;

    // Initialize 30 days
    for (let i = 29; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const dateStr = d.toISOString().slice(0, 10);
      dailyMap[dateStr] = { date: dateStr, revenue: 0, quantity: 0, count: 0 };
    }

    // Populate daily sales
    for (const challan of confirmedChallans) {
      const dateStr = challan.createdAt.toISOString().slice(0, 10);
      const challanTotal = challan.items.reduce(
        (sum, item) => sum + Number(item.unitPriceSnapshot) * item.quantity,
        0
      );
      totalRevenue += challanTotal;

      if (dailyMap[dateStr]) {
        dailyMap[dateStr].revenue += challanTotal;
        dailyMap[dateStr].quantity += challan.totalQuantity;
        dailyMap[dateStr].count += 1;
      }
    }

    const salesTrend = Object.values(dailyMap);

    // Top Customers by Revenue
    const customerMap: Record<string, { customerName: string; revenue: number; orders: number }> = {};
    for (const challan of confirmedChallans) {
      const name = challan.customer.businessName || challan.customer.name;
      const challanTotal = challan.items.reduce(
        (sum, item) => sum + Number(item.unitPriceSnapshot) * item.quantity,
        0
      );
      if (!customerMap[name]) {
        customerMap[name] = { customerName: name, revenue: 0, orders: 0 };
      }
      customerMap[name].revenue += challanTotal;
      customerMap[name].orders += 1;
    }

    const topCustomers = Object.values(customerMap)
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 5);

    // Inventory Valuation & Category Breakdown
    const categoryMap: Record<string, { category: string; stockCount: number; valuation: number }> = {};
    let totalInventoryValuation = 0;

    for (const prod of allProducts) {
      const cat = prod.category || "Uncategorized";
      const val = Number(prod.unitPrice) * prod.currentStock;
      totalInventoryValuation += val;

      if (!categoryMap[cat]) {
        categoryMap[cat] = { category: cat, stockCount: 0, valuation: 0 };
      }
      categoryMap[cat].stockCount += prod.currentStock;
      categoryMap[cat].valuation += val;
    }

    const inventoryCategoryBreakdown = Object.values(categoryMap);

    res.json({
      kpis: {
        totalRevenue: Math.round(totalRevenue * 100) / 100,
        confirmedChallansCount: confirmedChallans.length,
        totalCustomers: customersCount,
        totalProducts: productsCount,
        totalSuppliers: suppliersCount,
        activePOsCount,
        totalInventoryValuation: Math.round(totalInventoryValuation * 100) / 100,
        lowStockAlertCount: lowStockProducts.length
      },
      salesTrend,
      topCustomers,
      inventoryCategoryBreakdown,
      lowStockProducts
    });
  })
);

export default router;
