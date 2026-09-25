# Reporting Service

This FastAPI service owns read-heavy operational reports and CSV exports. Keeping these queries in Python makes the data analysis layer independently deployable and gives future analytics work access to Python's data ecosystem without duplicating Prisma migrations. It reads the existing MySQL schema and does not write application data.

Set `DATABASE_URL` to the MySQL URL used by the Node API and `JWT_SECRET` to the same signing secret. The service converts the URL to the PyMySQL driver with SQLAlchemy's URL parser. Set `REPORTS_DATABASE_URL` to a separate account URL in production and grant that account `SELECT` only on the application schema. Every pooled MySQL session is also configured with read-only transaction defaults.

Endpoints are `/reports/low-stock`, `/reports/sales-summary?start_date=YYYY-MM-DD&end_date=YYYY-MM-DD`, and `/reports/challan-export?start_date=YYYY-MM-DD&end_date=YYYY-MM-DD`. Date windows are limited to 366 days, and CSV output is capped at 5,000 rows.
