# 📚 Mini ERP + CRM Operations Portal — Complete Project Documentation

Wholesale and distribution back-office system for customer management, product inventory, stock movements, and sales challans with automated PDF invoice generation.

---

## 🔗 Quick Links & Live Deployment

| Resource | Link / Path | Description |
| :--- | :--- | :--- |
| **Live Web Application** | [http://3.110.174.53](http://3.110.174.53) | Production UI hosted on AWS EC2 |
| **Live Backend API** | [http://3.110.174.53/api](http://3.110.174.53/api) | Production Express API via Nginx Proxy |
| **API Health Check** | [http://3.110.174.53/api/health](http://3.110.174.53/api/health) | Live system status check |
| **Postman Collection** | [`postman_collection.json`](file:///d:/Project/Mini%20ERP%20+%20CRM%20Operations%20Portal/postman_collection.json) | Importable Postman API Collection |
| **GitHub Repository** | [GitHub Repo](https://github.com/Aditya51002/-Mini-ERP-CRM-Operations-Portal.git) | Source Code Repository |

---

## 🔑 Test Login Credentials

The application enforces **Role-Based Access Control (RBAC)** across 4 user roles. Log in to the hosted application or API using the following credentials:

| Role | Email Address | Password | Permissions & Overview |
| :--- | :--- | :--- | :--- |
| 🛡️ **ADMIN** | `admin@erp.test` | `Password123!` | Full unrestricted access to all modules, users, customers, products, inventory, and challans. |
| 💼 **SALES** | `sales@erp.test` | `Password123!` | Create & edit customers, add customer follow-up notes, create draft sales challans, edit, confirm, and cancel challans. |
| 📦 **WAREHOUSE** | `warehouse@erp.test` | `Password123!` | Create & edit products, perform manual stock adjustments (`IN`, `OUT`, `ADJUSTMENT`), view stock audit log. |
| 📊 **ACCOUNTS** | `accounts@erp.test` | `Password123!` | Read-only access to customers, products, stock movements, sales challans, and stream PDF tax invoices. |

---

## 📮 Postman Collection & Integration Guide

A complete Postman test collection is included in the project root: [`postman_collection.json`](file:///d:/Project/Mini%20ERP%20+%20CRM%20Operations%20Portal/postman_collection.json).

### Setup & Usage Instructions:

1. **Import the Collection**:
   - Open Postman -> Click **Import** -> Select [`postman_collection.json`](file:///d:/Project/Mini%20ERP%20+%20CRM%20Operations%20Portal/postman_collection.json) from the repository root.

2. **Configure Environment Variables**:
   - Open the collection variables tab in Postman and set `baseUrl`:
     - **Live Production Server**: `http://3.110.174.53/api`
     - **Local Docker Setup**: `http://localhost/api`
     - **Local Direct Express API**: `http://localhost:4000`

3. **Authenticate & Auto-Fetch Bearer Token**:
   - Run the request under **Auth -> Login** (pre-filled with `admin@erp.test` / `Password123!`).
   - The embedded test script automatically extracts `token` from the response JSON and saves it into the `{{token}}` collection variable.
   - All subsequent requests under `Customers`, `Products`, `Stock Movements`, and `Challans` automatically use `Authorization: Bearer {{token}}`.

---

## 🏗️ Architecture Summary & Tech Stack

```
                       +-------------------------------+
                       |      Web Browser (Client)     |
                       +---------------+---------------+
                                       |
                                       v
                       +---------------+---------------+
                       |          Nginx Proxy          |
                       |       (Port 80 on EC2)        |
                       +-------+---------------+-------+
                               |               |
                 Static Assets |               | /api/* Requests
                               v               v
                       +-------+---+   +-------+-------+
                       | React UI  |   | Express API   |
                       | (Vite/JS) |   | (TypeScript)  |
                       +-----------+   +-------+-------+
                                               |
                                               v (Prisma ORM)
                                       +-------+-------+
                                       |  MySQL 8 DB   |
                                       +---------------+
```

### Technology Stack
- **Backend**: Node.js 20, Express, TypeScript (compiled to CommonJS in `dist/`)
- **Database & ORM**: MySQL 8, Prisma Client (with raw SQL `SELECT ... FOR UPDATE` row locking)
- **Validation & Security**: Zod schemas, JWT (`jsonwebtoken`), Password hashing (`bcryptjs`)
- **PDF Generation**: PDFKit server-side streaming
- **Frontend**: React (Vite SPA), Tailwind CSS, Axios with JWT request interceptors, React Router DOM
- **DevOps**: Docker & Docker Compose, Nginx Proxy, GitHub Actions CI/CD, AWS EC2

---

## 🔒 Role-Based Access Control (RBAC) Matrix

Authorization is strictly enforced by server middleware (`requireAuth`, `requireRole`). Frontend UI controls conditionally render actions based on user role for optimal user experience.

| Feature / Module | ADMIN | SALES | WAREHOUSE | ACCOUNTS |
| :--- | :---: | :---: | :---: | :---: |
| **Login / User Profile** | ✅ | ✅ | ✅ | ✅ |
| **View Customers & Search** | ✅ | ✅ | ✅ | ✅ |
| **Create / Edit Customer & Add Notes** | ✅ | ✅ | ❌ | ❌ |
| **View Products & Search** | ✅ | ✅ | ✅ | ✅ |
| **Create / Edit Products** | ✅ | ❌ | ✅ | ❌ |
| **Manual Stock Adjustments** | ✅ | ❌ | ✅ | ❌ |
| **Stock Movement Audit Log** | ✅ | ✅ | ✅ | ✅ |
| **View & Manage Suppliers** | ✅ | ❌ | ✅ | ✅ |
| **Create / Edit / Receive Purchase Orders (GRN)** | ✅ | ❌ | ✅ | ❌ |
| **Create / Edit Draft Sales Challan** | ✅ | ✅ | ❌ | ❌ |
| **Confirm Draft Sales Challan** | ✅ | ✅ | ❌ | ❌ |
| **Cancel Sales Challan** | ✅ | ✅ | ❌ | ❌ |
| **Download PDF Tax Invoice** | ✅ | ✅ | ✅ | ✅ |
| **View Visual Analytics Dashboard** | ✅ | ✅ | ✅ | ✅ |

---

## ⚙️ Core Business Workflows

### 🏭 Inbound Procurement & Goods Receipt Note (GRN) Flow

1. **Vendor & Supplier Setup**:
   - Register suppliers with vendor code, contact details, address, and GST numbers.
2. **Purchase Order Creation**:
   - Create draft Purchase Orders (`PO-YYYYMMDD-XXXX`) specifying products, quantities, and agreed unit cost snapshot.
   - Transition PO status from `DRAFT` to `ORDERED` when dispatched to vendor.
3. **Atomic Stock Replenishment (Goods Receipt Note)**:
   - When goods arrive at the warehouse, confirming receipt (`POST /purchase-orders/:id/receive`) triggers an atomic Prisma transaction.
   - Automatically increments `Product.currentStock` for all PO items and generates audit log records (`IN` `StockMovement` tagged as `"PO Receipt PO-XXXX"`).

### 📋 Sales Challan Lifecycle & Concurrency Control

1. **Draft Creation**:
   - A Sales Challan starts in `DRAFT` status.
   - Items can be added, updated, or removed while in `DRAFT`.
   - Adding or editing items does **not** change inventory stock.
   - Each item snapshots `productName`, `sku`, and `unitPrice` at addition time.

2. **Atomic Confirmation with Row Locking**:
   - Confirming a draft runs in a single Prisma transaction (`prisma.$transaction`).
   - Locks involved product rows in MySQL via raw `SELECT ... FOR UPDATE`.
   - Validates that `currentStock >= requestedQuantity` for all items.
   - If stock is insufficient for any item, transaction rolls back with HTTP `422 Unprocessable Entity` listing all failing items.
   - If stock is sufficient, decrements inventory stock, creates an `OUT` `StockMovement` row per item, and sets status to `CONFIRMED`.

3. **Cancellation & Inventory Restoration**:
   - Cancelling a `DRAFT` challan updates status to `CANCELLED` without touching inventory.
   - Cancelling a `CONFIRMED` challan executes an atomic transaction restoring inventory stock, creating `IN` `StockMovement` audit rows, and marking status as `CANCELLED`.

4. **PDF Tax Invoice Streaming**:
   - `GET /challans/:id/invoice` streams a formatted tax invoice PDF generated on the fly with PDFKit for `CONFIRMED` challans.

---

## 🔒 Security & Production Hardening

- **Rate Limiting (`express-rate-limit`)**: Brute-force login protection limiting `/auth/login` requests to 5 per 15-minute window per IP, and a general API limiter of 100 reqs/min.
- **Security Headers (`helmet`)**: Enforces HTTP security headers including Content-Security-Policy (CSP), X-Frame-Options, X-Content-Type-Options, and Strict-Transport-Security.
- **Nginx HTTPS SSL/TLS**: Production Nginx configuration template (`nginx.https.conf`) included for SSL termination, Let's Encrypt ACME challenges, and HTTP-to-HTTPS redirection.

---

## 📡 Complete API Reference

Base URL (Live): `http://3.110.174.53/api`  
Base URL (Docker): `http://localhost/api`  
Base URL (Local Express): `http://localhost:4000`

### 🔑 Authentication (`/auth`)
- `POST /auth/login` — Public (Rate Limited) — Authenticate user credentials & return JWT.
- `GET /auth/me` — All Roles — Fetch profile of current logged-in user.

### 👥 Customers (`/customers`)
- `GET /customers` — All Roles — List paginated customers (`page`, `pageSize`, `search`, `status`).
- `GET /customers/:id` — All Roles — Get customer detail with follow-up notes & challan history.
- `POST /customers` — ADMIN, SALES — Create new customer.
- `PUT /customers/:id` — ADMIN, SALES — Update customer details.
- `POST /customers/:id/notes` — ADMIN, SALES — Append follow-up note to customer.

### 📦 Products & Inventory (`/products`)
- `GET /products` — All Roles — List paginated products with computed `lowStock` flag (`currentStock <= minStockAlert`).
- `GET /products/:id` — All Roles — Get product detail with stock movement history.
- `POST /products` — ADMIN, WAREHOUSE — Create new product.
- `PUT /products/:id` — ADMIN, WAREHOUSE — Update product details / stock alert threshold.
- `POST /products/:id/stock` — ADMIN, WAREHOUSE — Manual stock movement (`IN`, `OUT`, `ADJUSTMENT`).
- `GET /products/:id/movements` — All Roles — Paginated stock movement audit log.

### 🏭 Suppliers & Vendor Management (`/suppliers`)
- `GET /suppliers` — All Roles — List paginated suppliers with search and active PO count.
- `GET /suppliers/:id` — All Roles — Get supplier details with PO history.
- `POST /suppliers` — ADMIN, WAREHOUSE — Create new supplier.
- `PUT /suppliers/:id` — ADMIN, WAREHOUSE — Update supplier details.

### 🛍️ Purchase Orders & Goods Receipt (`/purchase-orders`)
- `GET /purchase-orders` — All Roles — List purchase orders (`page`, `pageSize`, `search`, `status`).
- `GET /purchase-orders/:id` — All Roles — Get PO details with line items.
- `POST /purchase-orders` — ADMIN, WAREHOUSE — Create draft PO.
- `POST /purchase-orders/:id/order` — ADMIN, WAREHOUSE — Mark PO as `ORDERED`.
- `POST /purchase-orders/:id/receive` — ADMIN, WAREHOUSE — Receive Goods (GRN), increment stock & log movements atomically.
- `POST /purchase-orders/:id/cancel` — ADMIN, WAREHOUSE — Cancel PO.

### 📄 Sales Challans (`/challans`)
- `GET /challans` — All Roles — List sales challans (`page`, `pageSize`, `status`, `customerId`, `search`).
- `GET /challans/:id` — All Roles — Get sales challan detail with line items.
- `POST /challans` — ADMIN, SALES — Create new `DRAFT` sales challan.
- `PUT /challans/:id` — ADMIN, SALES — Update items on `DRAFT` sales challan.
- `POST /challans/:id/confirm` — ADMIN, SALES — Confirm draft challan & deduct stock atomically.
- `POST /challans/:id/cancel` — ADMIN, SALES — Cancel draft or confirmed challan & restore stock.
- `GET /challans/:id/invoice` — All Roles — Stream PDF Tax Invoice (Confirmed status only).

### 📊 Analytics & Reports (`/reports`)
- `GET /reports/dashboard` — All Roles — Fetch executive metrics: 30-day sales revenue trend, top customers, category stock valuation, and low-stock alerts.

---

## 🛠️ Local Development & Setup

### Option A: Running with Docker (Recommended)

```bash
# 1. Clone repository
git clone https://github.com/Aditya51002/-Mini-ERP-CRM-Operations-Portal.git
cd "-Mini-ERP-CRM-Operations-Portal"

# 2. Setup backend environment
cp backend/.env.example backend/.env

# 3. Start Docker Compose
docker compose up --build -d

# 4. Seed database users & demo data
docker compose exec backend npm run seed
docker compose exec backend npm run seed:demo
```
- App UI: `http://localhost`
- Backend API: `http://localhost:4000` or `http://localhost/api`

---

### Option B: Running Standalone (Without Docker)

```bash
# Backend Setup
cd backend
cp .env.example .env
npm install
npm run prisma:generate
npm run prisma:migrate
npm run build
npm run seed
npm run seed:demo
npm run dev

# Frontend Setup (in another terminal)
cd ../frontend
cp .env.example .env
npm install
npm run dev
```
- Frontend UI: `http://localhost:5173`
- Backend API: `http://localhost:4000`

---

## 🚀 CI/CD & Deployment

- **Pipeline**: GitHub Actions (`.github/workflows/deploy.yml`)
- **Trigger**: Automatic on push to `main` branch.
- **Workflow**:
  1. Installs dependencies & runs Prisma generator.
  2. Type-checks backend TypeScript & runs linters.
  3. Builds frontend static assets.
  4. Builds Docker images & pushes to Docker Hub with tags `latest` and `git-sha`.
  5. SSHes into AWS EC2 host and executes `docker compose pull && docker compose up -d`.
