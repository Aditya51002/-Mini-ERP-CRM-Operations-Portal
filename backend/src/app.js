const cors = require("cors");
const express = require("express");
const morgan = require("morgan");

const authRoutes = require("./routes/auth.routes");
const challanRoutes = require("./routes/challans.routes");
const customerRoutes = require("./routes/customers.routes");
const productRoutes = require("./routes/products.routes");
const stockMovementRoutes = require("./routes/stockMovements.routes");
const { errorHandler, notFoundHandler } = require("./middleware/errorHandler");

const app = express();

app.use(
  cors({
    origin: process.env.FRONTEND_ORIGIN || true,
    credentials: true
  })
);
app.use(express.json({ limit: "1mb" }));
app.use(morgan("dev"));

app.get("/api/health", (req, res) => {
  res.json({ ok: true, service: "mini-erp-crm-backend" });
});

app.use("/api/auth", authRoutes);
app.use("/api/customers", customerRoutes);
app.use("/api/products", productRoutes);
app.use("/api/stock-movements", stockMovementRoutes);
app.use("/api/challans", challanRoutes);

app.use(notFoundHandler);
app.use(errorHandler);

module.exports = app;
