# Mini ERP + CRM Operations Portal

A wholesale/distribution back-office portal built with Node.js, Express, Prisma, MySQL, React, Vite, Tailwind CSS, Docker, and GitHub Actions.

## Modules

- Auth with JWT and bcryptjs
- Role-based access control for ADMIN, SALES, WAREHOUSE, and ACCOUNTS
- Customers
- Products with computed `lowStock`
- Stock movements
- Sales challans with draft, confirm, and cancel workflows

## Local Development

Copy backend environment values:

```bash
cp backend/.env.example backend/.env
```

Start the full stack with Docker:

```bash
docker compose up --build
```

The frontend runs at `http://localhost:5173` and the backend API runs at `http://localhost:4000/api`.

Create the first admin user from the login screen, or call:

```bash
curl -X POST http://localhost:4000/api/auth/bootstrap \
  -H "Content-Type: application/json" \
  -d '{"name":"Admin","email":"admin@example.com","password":"ChangeMe123!"}'
```

After the first user exists, bootstrap is disabled.

## Backend Scripts

```bash
cd backend
npm install
npm run prisma:generate
npm run prisma:migrate
npm run dev
```

## Frontend Scripts

```bash
cd frontend
npm install
npm run dev
```

## RBAC

Server middleware enforces the role matrix. Frontend controls are only convenience; authorization decisions are made by the API.

## Challan Rules

Draft challans do not affect stock. Item rows snapshot `productName`, `sku`, and `unitPrice` when the item is added. Confirming a draft locks involved products with `SELECT ... FOR UPDATE`, validates all shortages, decrements stock, writes OUT stock movements, and sets the challan to CONFIRMED inside one Prisma transaction. Cancelling a confirmed challan reverses stock with IN movements inside a transaction. Confirmed challans cannot be edited.
