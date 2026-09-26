import csv
from datetime import date, timedelta
from io import StringIO
from typing import Annotated

import jwt
from fastapi import APIRouter, Depends, FastAPI, HTTPException, Query
from fastapi.responses import StreamingResponse
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy import create_engine, event, text
from sqlalchemy.engine import make_url
from sqlalchemy.exc import SQLAlchemyError

from app.config import settings
from app.constants import (
    ALLOWED_ROLES,
    API_PREFIX,
    AUTH_INVALID_MESSAGE,
    AUTH_REQUIRED_MESSAGE,
    CONFIRMED_CHALLAN_STATUS,
    CSV_FILENAME,
    DATABASE_UNAVAILABLE_MESSAGE,
    DATE_RANGE_ERROR,
    DEFAULT_EXPORT_LIMIT,
    HTTP_SERVICE_UNAVAILABLE,
    HTTP_UNAUTHORIZED,
    HTTP_UNPROCESSABLE_ENTITY,
    MAX_DATE_RANGE_DAYS,
    MAX_EXPORT_LIMIT,
    READ_ONLY_SESSION_SQL,
)

report_database_url = make_url(settings.reports_database_url or settings.database_url).set(
    drivername="mysql+pymysql"
)
engine = create_engine(report_database_url, pool_pre_ping=True, pool_recycle=1800)
app = FastAPI(title="ERP Reporting Service", docs_url=None, redoc_url=None)
reports = APIRouter(prefix=API_PREFIX)
bearer = HTTPBearer(auto_error=False)


@event.listens_for(engine, "connect")
def configure_read_only_session(dbapi_connection, connection_record):
    cursor = dbapi_connection.cursor()
    try:
        cursor.execute(READ_ONLY_SESSION_SQL)
    finally:
        cursor.close()


def require_auth(
    credentials: Annotated[HTTPAuthorizationCredentials | None, Depends(bearer)],
):
    if not credentials:
        raise HTTPException(status_code=HTTP_UNAUTHORIZED, detail=AUTH_REQUIRED_MESSAGE)
    try:
        payload = jwt.decode(credentials.credentials, settings.jwt_secret, algorithms=["HS256"])
        if payload.get("role") not in ALLOWED_ROLES:
            raise HTTPException(status_code=HTTP_UNAUTHORIZED, detail=AUTH_INVALID_MESSAGE)
    except jwt.PyJWTError as exc:
        raise HTTPException(status_code=HTTP_UNAUTHORIZED, detail=AUTH_INVALID_MESSAGE) from exc


@app.get("/health")
def health():
    try:
        with engine.connect() as connection:
            connection.execute(text("SELECT 1"))
        return {"status": "ok"}
    except SQLAlchemyError as exc:
        raise HTTPException(
            status_code=HTTP_SERVICE_UNAVAILABLE, detail=DATABASE_UNAVAILABLE_MESSAGE
        ) from exc


@reports.get("/low-stock", dependencies=[Depends(require_auth)])
def low_stock():
    query = text("""
        SELECT id, name, sku, currentStock, minStockAlert
        FROM Product
        WHERE currentStock <= minStockAlert
        ORDER BY currentStock ASC, sku ASC
    """)
    with engine.connect() as connection:
        rows = connection.execute(query).mappings().all()
    return {"items": [dict(row) for row in rows], "total": len(rows)}


@reports.get("/sales-summary", dependencies=[Depends(require_auth)])
def sales_summary(start_date: date, end_date: date):
    if end_date < start_date or (end_date - start_date).days > MAX_DATE_RANGE_DAYS:
        raise HTTPException(status_code=HTTP_UNPROCESSABLE_ENTITY, detail=DATE_RANGE_ERROR)
    query = text("""
        SELECT COUNT(DISTINCT c.id) AS challanCount,
               COALESCE(SUM(i.quantity), 0) AS quantity,
               COALESCE(SUM(i.unitPriceSnapshot * i.quantity), 0) AS revenue
        FROM SalesChallan c
        LEFT JOIN ChallanItem i ON i.challanId = c.id
        WHERE c.status = :confirmed
          AND c.createdAt >= :start_at
          AND c.createdAt < :end_at
    """)
    params = {
        "confirmed": CONFIRMED_CHALLAN_STATUS,
        "start_at": start_date,
        "end_at": end_date + timedelta(days=1),
    }
    with engine.connect() as connection:
        result = dict(connection.execute(query, params).mappings().one())
    result["revenue"] = float(result["revenue"])
    return result


@reports.get("/challan-export", dependencies=[Depends(require_auth)])
def challan_export(
    start_date: date,
    end_date: date,
    limit: int = Query(DEFAULT_EXPORT_LIMIT, ge=1, le=MAX_EXPORT_LIMIT),
):
    if end_date < start_date or (end_date - start_date).days > MAX_DATE_RANGE_DAYS:
        raise HTTPException(status_code=HTTP_UNPROCESSABLE_ENTITY, detail=DATE_RANGE_ERROR)
    query = text("""
        SELECT c.challanNumber, c.status, c.createdAt, cu.name AS customerName,
               i.skuSnapshot, i.productNameSnapshot, i.quantity, i.unitPriceSnapshot
        FROM SalesChallan c
        JOIN Customer cu ON cu.id = c.customerId
        LEFT JOIN ChallanItem i ON i.challanId = c.id
        WHERE c.createdAt >= :start_at AND c.createdAt < :end_at
        ORDER BY c.createdAt DESC, c.id DESC, i.id ASC
        LIMIT :row_limit
    """)
    params = {
        "start_at": start_date,
        "end_at": end_date + timedelta(days=1),
        "row_limit": limit,
    }
    with engine.connect() as connection:
        rows = connection.execute(query, params).mappings().all()
    output = StringIO()
    writer = csv.writer(output)
    writer.writerow(
        [
            "challanNumber",
            "status",
            "createdAt",
            "customerName",
            "sku",
            "productName",
            "quantity",
            "unitPrice",
        ]
    )
    for row in rows:
        writer.writerow(
            [
                row["challanNumber"],
                row["status"],
                row["createdAt"],
                row["customerName"],
                row["skuSnapshot"],
                row["productNameSnapshot"],
                row["quantity"],
                row["unitPriceSnapshot"],
            ]
        )
    output.seek(0)
    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": CSV_FILENAME},
    )


app.include_router(reports)
