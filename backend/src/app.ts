import cors from "cors";
import express from "express";
import helmet from "helmet";

import { requireAuth } from "./middleware/auth";
import errorHandler from "./middleware/errorHandler";
import { apiLimiter, authLimiter } from "./middleware/rateLimiter";
import authRoutes from "./modules/auth/auth.routes";
import challansRoutes from "./modules/challans/challans.routes";
import customersRoutes from "./modules/customers/customers.routes";
import productsRoutes from "./modules/products/products.routes";
import purchaseOrdersRoutes from "./modules/purchaseOrders/purchaseOrders.routes";
import reportsRoutes from "./modules/reports/reports.routes";
import suppliersRoutes from "./modules/suppliers/suppliers.routes";

const app = express();

// Security Headers with Helmet
app.use(helmet());

// Enable CORS
app.use(
  cors({
    origin: process.env.CORS_ORIGIN || "*",
    credentials: true
  })
);

app.use(express.json());

// Global API rate limiting
app.use(apiLimiter);

app.get("/health", (req, res) => {
  res.json({ status: "ok" });
});

// Rate-limited auth routes
app.use("/auth/login", authLimiter);
app.use("/auth", authRoutes);

// Core Modules
app.use("/challans", challansRoutes);
app.use("/customers", customersRoutes);
app.use("/products", productsRoutes);
app.use("/suppliers", suppliersRoutes);
app.use("/purchase-orders", purchaseOrdersRoutes);
app.use("/reports", reportsRoutes);

app.use(requireAuth);
app.use((req, res) => {
  res.status(404).json({
    error: {
      message: `Route not found: ${req.method} ${req.originalUrl}`
    }
  });
});

app.use(errorHandler);

export default app;
