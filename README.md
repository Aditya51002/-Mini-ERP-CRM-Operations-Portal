# Mini ERP + CRM Operations Portal

Wholesale/distribution back-office system for customer management, product
inventory, stock movements, and sales challans.

Repository:
`https://github.com/Aditya51002/-Mini-ERP-CRM-Operations-Portal.git`

## Live Deployment

The public deployment link is temporarily omitted while HTTPS termination and
the production JWT configuration are verified on the host.

## Project Overview

Mini ERP + CRM Operations Portal is a small operations system for teams that
sell and distribute physical goods. It supports role-based access for admin,
sales, warehouse, and accounts users. Sales users can manage customers and
sales challans, warehouse users can manage products and stock, and accounts
users can read operational data without changing it.

The most important business workflow is the sales challan flow. Challans begin
as drafts with no stock impact. On confirmation, the backend locks all involved
product rows in MySQL, verifies stock for every item, decrements stock,
creates stock movement rows, and confirms the challan inside one Prisma
transaction.

## Architecture Summary

The frontend is a React + Vite single-page application styled with Tailwind
CSS. It uses React Router for protected pages, an AuthContext for JWT state,
and an Axios client that attaches `Authorization: Bearer <token>` to API
requests. In Docker, nginx serves the static frontend and proxies `/api/*`
requests to the backend container.

The backend is a TypeScript Node.js + Express API compiled to `dist/` for
production. Routes are grouped by module under `src/modules`, validation is
handled with Zod, and Prisma Client talks to MySQL. Authentication uses
`jsonwebtoken` and `bcryptjs`. Authorization is enforced with backend
middleware, not only by hiding frontend controls.

The runtime stack is containerized with Docker Compose. MySQL stores all data,
the backend container runs Prisma migrations automatically before startup, and
the frontend container serves the production build through nginx. A separate
FastAPI reporting service provides bounded, read-oriented reports and CSV
exports over the existing MySQL schema. CI/CD is handled by GitHub Actions:
pushes to `main` run mandatory lint and backend tests before images are built.

## Tech Stack

- Backend: Node.js, Express, TypeScript
- ORM: Prisma Client for MySQL
- Database: MySQL 8
- Validation: Zod
- Auth: JWT with `jsonwebtoken`, password hashing with `bcryptjs`
- Frontend: React, Vite, Tailwind CSS, plain JavaScript
- HTTP client: Axios
- Containerization: Docker and Docker Compose
- Static serving: nginx
- Reporting API: Python 3.12, FastAPI, SQLAlchemy, PyMySQL
- CI/CD: GitHub Actions, Docker Hub, AWS EC2 over SSH

## Role-Based Access Control (RBAC) Matrix

Backend authorization relies on the `requireAuth` and `requireRole`
middlewares defined in `backend/src/middleware/auth.ts`. Every write route
is guarded server-side by `requireRole(...)` — frontend UI controls only
conditionally render actions based on user role for convenience; the API
remains the actual source of truth for authorization.

| Module                      | ADMIN       | SALES                      | WAREHOUSE   | ACCOUNTS  |
| --------------------------- | ----------- | -------------------------- | ----------- | --------- |
| Customers & Notes           | Full Access | Full Access                | Read-only   | Read-only |
| Products & Stock Adjustment | Full Access | Read-only                  | Full Access | Read-only |
| Stock Movements Audit       | Full Access | Read-only                  | Full Access | Read-only |
| Sales Challans              | Full Access | Create/Edit/Confirm/Cancel | Read-only   | Read-only |

## Sales Challan Business Rules

The implementation follows the original assignment rules:

1. A challan is created as `DRAFT`. Items can be added, edited, or removed
   while still draft. Drafts do not change stock.
2. Each challan item snapshots `productName`, `sku`, and `unitPrice` at the
   moment the item is added. Historical items do not re-read live product
   data.
3. Confirming a draft runs in one Prisma `$transaction`.
4. The transaction row-locks every involved product with raw MySQL
   `SELECT ... FOR UPDATE` because Prisma's model API does not expose row
   locking directly.
5. The transaction checks all products and returns HTTP `422` with every
   insufficient product if any item cannot be fulfilled.
6. If all items can be fulfilled, stock is decremented, one `OUT`
   StockMovement is inserted per item, and the challan becomes `CONFIRMED`.
7. Confirmed challans are immutable.
8. Cancelling a confirmed challan restores stock with reversing `IN`
   StockMovement rows and sets the challan to `CANCELLED`.
9. Cancelling a draft only sets the challan to `CANCELLED`; no stock movement
   is created.
10. Product responses include computed `lowStock`, where
    `currentStock <= minStockAlert`. This flag is advisory only.
11. Customers and products can be deleted only when no challans, notes, stock
    movements, or purchase orders reference them. Foreign-key restrictions
    preserve the operational audit trail; these records are not soft-deleted.

## Local Setup With Docker

Prerequisites:

- Docker Desktop or Docker Engine with Docker Compose
- Docker version 29.4.2 or compatible

Create the backend environment file:

```bash
cp backend/.env.example backend/.env
cp .env.example .env
```

Set unique values for the four MySQL variables in root `.env`. Edit
`backend/.env` so `DATABASE_URL` uses the same database/user and the `mysql`
service name:

```env
PORT=4000
DATABASE_URL=mysql://erp_user:erp_password@mysql:3306/mini_erp_crm
JWT_SECRET=change_this_secret_in_production
JWT_EXPIRES_IN=8h
CORS_ORIGIN=http://localhost
```

Start all services:

```bash
docker compose up --build
```

The frontend runs at:

```text
http://localhost
```

The backend is exposed directly at:

```text
http://localhost:4000
```

The frontend nginx container proxies browser API requests from `/api/*` to the
backend container.

The backend Docker entrypoint runs:

```bash
npx prisma migrate deploy
```

This automatically migrates a fresh MySQL volume before the API starts.

Seed the four test users:

```bash
docker compose exec backend npm run seed
```

Seed the demo data:

```bash
docker compose exec backend npm run seed:demo
```

Note: For security, MySQL port 3306 is not published to the host. Direct database access must go through the backend container or via:

```bash
docker compose exec mysql mysql -u root -p
```

Reset the Docker database:

```bash
docker compose down -v
docker compose up --build
```

## Local Setup Without Docker

Prerequisites:

- Node.js 20
- MySQL 8
- npm

Create a MySQL database and user:

```sql
CREATE DATABASE mini_erp_crm;
CREATE USER 'erp_user'@'localhost' IDENTIFIED BY 'erp_password';
GRANT ALL PRIVILEGES ON mini_erp_crm.* TO 'erp_user'@'localhost';
FLUSH PRIVILEGES;
```

Configure backend environment:

```bash
cp backend/.env.example backend/.env
```

Use a local MySQL URL:

```env
PORT=4000
DATABASE_URL=mysql://erp_user:erp_password@localhost:3306/mini_erp_crm
JWT_SECRET=change_this_secret_in_production
JWT_EXPIRES_IN=8h
CORS_ORIGIN=http://localhost:5173
```

Install and run the backend:

```bash
cd backend
npm install
npm run prisma:generate
npm run prisma:migrate
npm run build
npm run seed
npm run dev
```

Install and run the frontend in another terminal:

```bash
cd frontend
cp .env.example .env
npm install
npm run dev
```

Use this frontend environment for local non-Docker development:

```env
VITE_API_URL=http://localhost:4000
```

The Vite dev server runs at:

```text
http://localhost:5173
```

## Environment Variables

Backend variables:

| Variable                         | Example                                                 | Purpose                                 |
| -------------------------------- | ------------------------------------------------------- | --------------------------------------- |
| `PORT`                           | `4000`                                                  | Express server port                     |
| `DATABASE_URL`                   | `mysql://erp_user:erp_password@mysql:3306/mini_erp_crm` | Prisma MySQL connection string          |
| `JWT_SECRET`                     | `change_this_secret_in_production`                      | Secret used to sign JWTs                |
| `JWT_EXPIRES_IN`                 | `8h`                                                    | JWT lifetime passed to `jsonwebtoken`   |
| `CORS_ORIGIN`                    | `http://localhost`                                      | Allowed browser origin                  |
| `ANTHROPIC_API_KEY`              | unset                                                   | Enables customer relationship summaries |
| `ANTHROPIC_MODEL`                | `claude-haiku-4-5-20251001`                             | Anthropic Messages API model            |
| `CUSTOMER_SUMMARY_CACHE_SECONDS` | `300`                                                   | Summary cache lifetime                  |
| `CUSTOMER_SUMMARY_RATE_LIMIT`    | `5`                                                     | Summary calls per minute per client     |

Frontend variables:

| Variable       | Example                           | Purpose        |
| -------------- | --------------------------------- | -------------- |
| `VITE_API_URL` | `http://localhost:4000` or `/api` | Axios base URL |

Docker/EC2 compose variables:

| Variable              | Example               | Purpose                                    |
| --------------------- | --------------------- | ------------------------------------------ |
| `DOCKERHUB_USERNAME`  | `your-dockerhub-user` | Docker Hub namespace for deployment images |
| `IMAGE_TAG`           | `latest` or a git SHA | Image tag used by production compose       |
| `MYSQL_ROOT_PASSWORD` | unique secret         | MySQL root password                        |
| `MYSQL_DATABASE`      | `mini_erp_crm`        | MySQL database name                        |
| `MYSQL_USER`          | `erp_user`            | MySQL app user                             |
| `MYSQL_PASSWORD`      | unique secret         | MySQL app password                         |

## Migrations and Seed

Generate Prisma Client:

```bash
cd backend
npm run prisma:generate
```

Run migrations in local development:

```bash
npm run prisma:migrate
```

Run production migrations:

```bash
npx prisma migrate deploy
```

In Docker, production migrations are run automatically by
`backend/docker-entrypoint.sh`.

Build and seed users in local non-Docker development:

```bash
npm run build
npm run seed
```

Or inside Docker:

```bash
docker compose exec backend npm run seed
```

The seed script recreates exactly one user for each role.

### Demo Data (optional)

For demoing or recording the app with realistic data, run the demo seed
script after the base seed. It does not touch the `User` table — it only
populates customers, products, stock movements, and sales challans covering
all three challan statuses (draft, confirmed, cancelled) and two
intentionally low-stock products, so the low-stock flag and confirm/cancel
flows are visible immediately.

```bash
npm run seed        # creates the 4 role users, if not already seeded
npm run seed:demo   # adds demo customers, products, and challans
```

In Docker:

```bash
docker compose exec backend npm run seed
docker compose exec backend npm run seed:demo
```

See [DEMO.md](DEMO.md) for seeded demo accounts.

## API Overview

Import `postman_collection.json` into Postman for runnable examples. The
collection uses:

```text
{{baseUrl}}
{{token}}
```

Default Postman `baseUrl`:

```text
http://localhost:4000
```

When testing through the Docker frontend nginx proxy, set `baseUrl` to:

```text
http://localhost/api
```

Run `Auth -> Login` first. Its test script stores the JWT in `{{token}}` for
the protected requests.

Main API routes:

| Method   | Path                      | Purpose                                                                                |
| -------- | ------------------------- | -------------------------------------------------------------------------------------- |
| `GET`    | `/health`                 | Health check                                                                           |
| `POST`   | `/auth/login`             | Login and receive JWT                                                                  |
| `GET`    | `/customers`              | Paginated customer list                                                                |
| `GET`    | `/customers/:id`          | Customer detail with notes and challan history                                         |
| `POST`   | `/customers`              | Create customer, Admin/Sales                                                           |
| `PUT`    | `/customers/:id`          | Update customer, Admin/Sales                                                           |
| `DELETE` | `/customers/:id`          | Delete customer, Admin/Sales                                                           |
| `POST`   | `/customers/:id/notes`    | Add customer note, Admin/Sales                                                         |
| `POST`   | `/customers/:id/summary`  | Generate cached AI relationship summary, Admin/Sales                                   |
| `GET`    | `/products`               | Paginated product list with `lowStock`                                                 |
| `GET`    | `/products/:id`           | Product detail with recent stock movements                                             |
| `POST`   | `/products`               | Create product, Admin/Warehouse                                                        |
| `PUT`    | `/products/:id`           | Update product, Admin/Warehouse                                                        |
| `DELETE` | `/products/:id`           | Delete product, Admin/Warehouse                                                        |
| `POST`   | `/products/:id/stock`     | Manual stock movement, Admin/Warehouse                                                 |
| `GET`    | `/products/:id/movements` | Paginated stock movement log                                                           |
| `GET`    | `/challans`               | Paginated challan list                                                                 |
| `GET`    | `/challans/:id`           | Challan detail with items                                                              |
| `POST`   | `/challans`               | Create draft challan, Admin/Sales                                                      |
| `PUT`    | `/challans/:id`           | Edit draft challan, Admin/Sales                                                        |
| `GET`    | `/challans/:id/invoice`   | Stream PDF invoice (CONFIRMED status only; returns 409 for DRAFT/CANCELLED), All roles |
| `POST`   | `/challans/:id/confirm`   | Confirm draft challan, Admin/Sales                                                     |
| `POST`   | `/challans/:id/cancel`    | Cancel draft or confirmed challan, Admin/Sales                                         |

Read reports are served by the Python service behind the frontend proxy at
`/api/reports/low-stock`, `/api/reports/sales-summary`, and
`/api/reports/challan-export`. These requests require the same bearer JWT.

## Docker Deployment

Local Docker Compose builds from source:

```bash
docker compose up --build
```

The root `docker-compose.yml` includes local `build` contexts and local image
names. For EC2 deployment, use `docker-compose.production.yml`. The deploy
workflow copies it to EC2 before pulling the published images:

```text
DOCKERHUB_USERNAME/mini-erp-crm-backend:${IMAGE_TAG:-latest}
DOCKERHUB_USERNAME/mini-erp-crm-frontend:${IMAGE_TAG:-latest}
DOCKERHUB_USERNAME/mini-erp-crm-reports:${IMAGE_TAG:-latest}
```

## EC2 Deployment

1. Provision an Ubuntu EC2 instance and allow ports `22` and `80`.
2. Install Docker and the Docker Compose plugin.
3. Create `/opt/mini-erp-crm/.env` with MySQL variables, `DATABASE_URL` using
   the `mysql` service name, a unique `JWT_SECRET`, and optional Anthropic
   settings.
4. Copy `docker-compose.production.yml` to `/opt/mini-erp-crm`.
5. Export `DOCKERHUB_USERNAME` and `IMAGE_TAG=latest`, then run
   `docker compose -f docker-compose.production.yml pull` and
   `docker compose -f docker-compose.production.yml up -d`.

The deploy workflow updates the production Compose file along with the images.
The backend container runs migrations automatically on first start. After the
first start, seed users with:

```bash
cd /opt/mini-erp-crm
docker compose -f docker-compose.production.yml exec backend npm run seed
```

## CI/CD

GitHub Actions workflow:

```text
.github/workflows/deploy.yml
```

Trigger:

```text
push to main
```

Workflow behavior:

1. Check out the repository.
2. Set up Node.js 20.
3. Install backend and frontend dependencies.
4. Generate Prisma Client.
5. Type-check the backend.
6. Run mandatory backend and frontend lint, backend tests, and Python lint.
7. Build the Python reporting image and frontend.
8. Build and push Docker images to Docker Hub with both tags:
   - `latest`
   - the git SHA
9. Copy the production Compose file to EC2, then run:

```bash
docker compose -f docker-compose.production.yml pull
docker compose -f docker-compose.production.yml up -d
```

Required GitHub repository secrets:

| Secret                | Purpose                              |
| --------------------- | ------------------------------------ |
| `DOCKERHUB_USERNAME`  | Docker Hub username/namespace        |
| `DOCKERHUB_TOKEN`     | Docker Hub access token              |
| `EC2_HOST`            | EC2 Elastic IP or public DNS         |
| `EC2_USER` (optional) | SSH username (defaults to `ubuntu`)  |
| `EC2_SSH_KEY`         | Private SSH key for the EC2 instance |

The workflow assumes the EC2 deploy directory is:

```text
/opt/mini-erp-crm
```

If you use a different path, update `DEPLOY_DIR` in
`.github/workflows/deploy.yml`.

## Known Limitations

- The EC2 host still needs a real DNS name, Let's Encrypt certificate, and
  HTTPS nginx configuration before a public deployment link is restored.
- The live host's JWT secret cannot be verified from this repository; confirm
  it is not the example placeholder before publishing the endpoint.
- Login uses an eight-hour JWT without refresh or password reset flows. For
  this small, single-deployment project, the bounded session lifetime keeps
  token handling simple; production use should add refresh-token rotation and
  account recovery.
- Delete endpoints are implemented, but foreign keys reject deletion when
  records have operational history. There is no archive/restore workflow.
- The Python report service opens read-only MySQL sessions. Compose uses the
  local application account for convenience; production should grant its
  separate report account `SELECT` only.
- Customer summaries require an Anthropic API key. Requests are capped at
  five per minute per client and cached for five minutes; the small output
  token cap limits per-call cost, but provider pricing and availability still
  apply.
- The EC2 deployment is a single-node Docker Compose setup. It does not include
  automated database backups, multi-AZ failover, or horizontal scaling.
- MySQL's port `3306` is intentionally not published to the host — it is
  only reachable inside the Compose network by the backend and reporting
  services. This was a deliberate fix after an initial deployment briefly
  exposed it publicly.
