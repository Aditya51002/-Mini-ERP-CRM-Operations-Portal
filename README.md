# Mini ERP + CRM Operations Portal

Wholesale/distribution back-office system for customer management, product
inventory, stock movements, and sales challans.

Repository:
`https://github.com/Aditya51002/-Mini-ERP-CRM-Operations-Portal.git`

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

The backend is a plain JavaScript Node.js + Express API. Routes are grouped by
module under `src/modules`, validation is handled with Zod, and Prisma Client
talks to MySQL. Authentication uses `jsonwebtoken` and `bcryptjs`.
Authorization is enforced with backend middleware, not only by hiding frontend
controls.

The runtime stack is containerized with Docker Compose. MySQL stores all data,
the backend container runs Prisma migrations automatically before startup, and
the frontend container serves the production build through nginx. CI/CD is
handled by GitHub Actions: on each push to `main`, the workflow installs
dependencies, runs available checks, builds Docker images, pushes them to
Docker Hub, then SSHes into EC2 and runs `docker compose pull && docker compose
up -d`.

## Tech Stack

- Backend: Node.js, Express, plain JavaScript
- ORM: Prisma Client for MySQL
- Database: MySQL 8
- Validation: Zod
- Auth: JWT with `jsonwebtoken`, password hashing with `bcryptjs`
- Frontend: React, Vite, Tailwind CSS, plain JavaScript
- HTTP client: Axios
- Containerization: Docker and Docker Compose
- Static serving: nginx
- CI/CD: GitHub Actions, Docker Hub, AWS EC2 over SSH

## RBAC Matrix

Backend middleware enforces this matrix.

| Module | Admin | Sales | Warehouse | Accounts |
| --- | --- | --- | --- | --- |
| Customers | Full | Full | Read | Read |
| Products | Full | Read | Full | Read |
| Stock movements | Full | Read | Full | Read |
| Challans | Full | Create/Confirm/Cancel | Read | Read |

Frontend role-based hiding is only a convenience. The API remains the source
of truth for authorization.

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

## Local Setup With Docker

Prerequisites:

- Docker Desktop or Docker Engine with Docker Compose
- Docker version 29.4.2 or compatible

Create the backend environment file:

```bash
cp backend/.env.example backend/.env
```

For Docker Compose, edit `backend/.env` so `DATABASE_URL` uses the `mysql`
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

| Variable | Example | Purpose |
| --- | --- | --- |
| `PORT` | `4000` | Express server port |
| `DATABASE_URL` | `mysql://erp_user:erp_password@mysql:3306/mini_erp_crm` | Prisma MySQL connection string |
| `JWT_SECRET` | `change_this_secret_in_production` | Secret used to sign JWTs |
| `JWT_EXPIRES_IN` | `8h` | JWT lifetime passed to `jsonwebtoken` |
| `CORS_ORIGIN` | `http://localhost` | Allowed browser origin |

Frontend variables:

| Variable | Example | Purpose |
| --- | --- | --- |
| `VITE_API_URL` | `http://localhost:4000` or `/api` | Axios base URL |

Docker/EC2 compose variables:

| Variable | Example | Purpose |
| --- | --- | --- |
| `DOCKERHUB_USERNAME` | `your-dockerhub-user` | Docker Hub namespace for deployment images |
| `IMAGE_TAG` | `latest` or a git SHA | Image tag used by production compose |
| `MYSQL_ROOT_PASSWORD` | `strong-root-password` | MySQL root password |
| `MYSQL_DATABASE` | `mini_erp_crm` | MySQL database name |
| `MYSQL_USER` | `erp_user` | MySQL app user |
| `MYSQL_PASSWORD` | `strong-app-password` | MySQL app password |

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

Seed users:

```bash
npm run seed
```

Or inside Docker:

```bash
docker compose exec backend npm run seed
```

The seed script recreates exactly one user for each role.

## Test Login Credentials

```text
ADMIN: admin@erp.test / Password123!
SALES: sales@erp.test / Password123!
WAREHOUSE: warehouse@erp.test / Password123!
ACCOUNTS: accounts@erp.test / Password123!
```

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

| Method | Path | Purpose |
| --- | --- | --- |
| `GET` | `/health` | Health check |
| `POST` | `/auth/login` | Login and receive JWT |
| `GET` | `/customers` | Paginated customer list |
| `GET` | `/customers/:id` | Customer detail with notes and challan history |
| `POST` | `/customers` | Create customer, Admin/Sales |
| `PUT` | `/customers/:id` | Update customer, Admin/Sales |
| `POST` | `/customers/:id/notes` | Add customer note, Admin/Sales |
| `GET` | `/products` | Paginated product list with `lowStock` |
| `GET` | `/products/:id` | Product detail with recent stock movements |
| `POST` | `/products` | Create product, Admin/Warehouse |
| `PUT` | `/products/:id` | Update product, Admin/Warehouse |
| `POST` | `/products/:id/stock` | Manual stock movement, Admin/Warehouse |
| `GET` | `/products/:id/movements` | Paginated stock movement log |
| `GET` | `/challans` | Paginated challan list |
| `GET` | `/challans/:id` | Challan detail with items |
| `POST` | `/challans` | Create draft challan, Admin/Sales |
| `PUT` | `/challans/:id` | Edit draft challan, Admin/Sales |
| `POST` | `/challans/:id/confirm` | Confirm draft challan, Admin/Sales |
| `POST` | `/challans/:id/cancel` | Cancel draft or confirmed challan, Admin/Sales |

## Docker Deployment

Local Docker Compose builds from source:

```bash
docker compose up --build
```

The root `docker-compose.yml` includes local `build` contexts and local image
names. For EC2 deployment, use the production compose file shown in
`EC2_SETUP.md`. That production file references Docker Hub images:

```text
DOCKERHUB_USERNAME/mini-erp-crm-backend:${IMAGE_TAG:-latest}
DOCKERHUB_USERNAME/mini-erp-crm-frontend:${IMAGE_TAG:-latest}
```

## EC2 Deployment

Follow `EC2_SETUP.md` to:

1. Provision a free-tier `t2.micro` Ubuntu EC2 instance.
2. Open security group ports `22`, `80`, and `443`.
3. Allocate and associate an Elastic IP.
4. Install Docker and the Docker Compose plugin.
5. Create `/opt/mini-erp-crm/docker-compose.yml`.
6. Create `/opt/mini-erp-crm/.env`.
7. Run the first manual `docker compose pull && docker compose up -d`.

The backend container runs migrations automatically on first start. After the
first start, seed users with:

```bash
cd /opt/mini-erp-crm
docker compose exec backend npm run seed
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
5. Run backend/frontend lint scripts if they exist.
6. Run backend/frontend test scripts if they exist.
7. Build the frontend.
8. Build and push Docker images to Docker Hub with both tags:
   - `latest`
   - the git SHA
9. SSH into EC2 and run:

```bash
docker compose pull
docker compose up -d
```

Required GitHub repository secrets:

| Secret | Purpose |
| --- | --- |
| `DOCKERHUB_USERNAME` | Docker Hub username/namespace |
| `DOCKERHUB_TOKEN` | Docker Hub access token |
| `EC2_HOST` | EC2 Elastic IP or public DNS |
| `EC2_USER` | SSH username, usually `ubuntu` |
| `EC2_SSH_KEY` | Private SSH key for the EC2 instance |

The workflow assumes the EC2 deploy directory is:

```text
/opt/mini-erp-crm
```

If you use a different path, update `DEPLOY_DIR` in
`.github/workflows/deploy.yml`.

## Known Limitations

- There is no formal automated unit/integration test suite yet. The workflow
  runs lint/test scripts if they are added later.
- TLS certificates and HTTPS termination are not automated. Port `443` is
  opened in the EC2 guide for a future reverse proxy or load balancer.
- The app uses JWT login without refresh tokens or password reset flows.
- Customer and product delete endpoints are not implemented.
- The EC2 deployment is a single-node Docker Compose setup. It does not include
  automated database backups, multi-AZ failover, or horizontal scaling.
- The frontend hides actions by role, but security depends on the backend RBAC
  middleware.

## Assumptions Made

- The assignment requires plain JavaScript only, so there are no TypeScript
  files.
- IDs are MySQL auto-increment integers generated by Prisma.
- The deployment target is one EC2 instance running Docker Compose.
- Docker Hub image repositories are named:
  - `mini-erp-crm-backend`
  - `mini-erp-crm-frontend`
- Sales challan stock consistency is handled in MySQL transactions with
  `SELECT ... FOR UPDATE`.
- Product `lowStock` is advisory and never blocks challan confirmation or stock
  adjustment logic by itself.
