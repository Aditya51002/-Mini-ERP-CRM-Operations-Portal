import cors from "cors";
import express from "express";

import { requireAuth } from "./middleware/auth";
import errorHandler from "./middleware/errorHandler";
import authRoutes from "./modules/auth/auth.routes";
import challansRoutes from "./modules/challans/challans.routes";
import customersRoutes from "./modules/customers/customers.routes";
import productsRoutes from "./modules/products/products.routes";

const app = express();

app.use(
  cors({
    origin: process.env.CORS_ORIGIN || "*",
    credentials: true
  })
);
app.use(express.json());

app.get("/health", (req, res) => {
  res.json({ status: "ok" });
});

app.use("/auth", authRoutes);
app.use("/challans", challansRoutes);
app.use("/customers", customersRoutes);
app.use("/products", productsRoutes);

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
