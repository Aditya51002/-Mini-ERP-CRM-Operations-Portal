import { Prisma, PrismaClient } from "@prisma/client";

import { appConfig } from "../../config/appConfig";
import { HTTP_STATUS } from "../../constants/httpStatus";
import { SalesChallanStatus, StockMovementType } from "../../constants/enums";
import { ERROR_MESSAGES } from "../../constants/messages";
import AppError from "../../utils/AppError";

interface RequestedDemand {
  productId: number;
  productName: string;
  sku: string;
  requestedQuantity: number;
}

interface InsufficientProduct {
  productId: number;
  productName: string;
  sku: string;
  availableQuantity: number;
  requestedQuantity: number;
}

function aggregateRequestedItems(
  items: Array<{
    productId: number;
    productNameSnapshot: string;
    skuSnapshot: string;
    quantity: number;
  }>
): Map<number, RequestedDemand> {
  const demand = new Map<number, RequestedDemand>();
  for (const item of items) {
    const existing = demand.get(item.productId) ?? {
      productId: item.productId,
      productName: item.productNameSnapshot,
      sku: item.skuSnapshot,
      requestedQuantity: 0
    };
    existing.requestedQuantity += item.quantity;
    demand.set(item.productId, existing);
  }
  return demand;
}

async function lockProductRows(tx: Prisma.TransactionClient, productIds: number[]) {
  if (productIds.length === 0) return [];
  const stableProductIds = [...productIds].sort((left, right) => left - right);
  return tx.$queryRaw<Array<{ id: number; name: string; sku: string; currentStock: number }>>`
    SELECT id, name, sku, currentStock
    FROM Product
    WHERE id IN (${Prisma.join(stableProductIds)})
    ORDER BY id
    FOR UPDATE
  `;
}

async function lockChallanRow(tx: Prisma.TransactionClient, id: number): Promise<void> {
  await tx.$queryRaw`SELECT id FROM SalesChallan WHERE id = ${id} FOR UPDATE`;
}

export async function confirmChallan(
  database: PrismaClient,
  id: number,
  userId: number
): Promise<void> {
  await database.$transaction(
    async (tx) => {
      await lockChallanRow(tx, id);
      const challan = await tx.salesChallan.findUnique({
        where: { id },
        include: { items: { orderBy: { id: "asc" } } }
      });
      if (!challan) throw new AppError(ERROR_MESSAGES.CHALLAN_NOT_FOUND, HTTP_STATUS.NOT_FOUND);
      if (challan.status === SalesChallanStatus.CONFIRMED) {
        throw new AppError(ERROR_MESSAGES.CHALLAN_ALREADY_CONFIRMED, HTTP_STATUS.CONFLICT);
      }
      if (challan.status === SalesChallanStatus.CANCELLED) {
        throw new AppError(ERROR_MESSAGES.CHALLAN_CANCELLED_CONFIRM, HTTP_STATUS.CONFLICT);
      }
      if (challan.items.length === 0) {
        throw new AppError(ERROR_MESSAGES.CHALLAN_EMPTY, HTTP_STATUS.UNPROCESSABLE_ENTITY);
      }

      const demand = aggregateRequestedItems(challan.items);
      const lockedProducts = await lockProductRows(tx, [...demand.keys()]);
      const productById = new Map(lockedProducts.map((product) => [Number(product.id), product]));
      const insufficientProducts: InsufficientProduct[] = [];
      for (const requested of demand.values()) {
        const product = productById.get(requested.productId);
        const availableQuantity = product ? Number(product.currentStock) : 0;
        if (!product || availableQuantity < requested.requestedQuantity) {
          insufficientProducts.push({
            productId: requested.productId,
            productName: requested.productName,
            sku: requested.sku,
            availableQuantity,
            requestedQuantity: requested.requestedQuantity
          });
        }
      }
      if (insufficientProducts.length > 0) {
        throw new AppError(ERROR_MESSAGES.INSUFFICIENT_STOCK, HTTP_STATUS.UNPROCESSABLE_ENTITY, {
          insufficientProducts
        });
      }

      for (const item of challan.items) {
        await tx.product.update({
          where: { id: item.productId },
          data: { currentStock: { decrement: item.quantity } }
        });
        await tx.stockMovement.create({
          data: {
            productId: item.productId,
            quantity: item.quantity,
            movementType: StockMovementType.OUT,
            reason: `Challan #${challan.challanNumber} confirmed`,
            createdById: userId
          }
        });
      }
      await tx.salesChallan.update({
        where: { id },
        data: { status: SalesChallanStatus.CONFIRMED }
      });
    },
    { timeout: appConfig.transactionTimeoutMs }
  );
}

export async function cancelChallan(
  database: PrismaClient,
  id: number,
  userId: number
): Promise<void> {
  await database.$transaction(
    async (tx) => {
      await lockChallanRow(tx, id);
      const challan = await tx.salesChallan.findUnique({
        where: { id },
        include: { items: { orderBy: { id: "asc" } } }
      });
      if (!challan) throw new AppError(ERROR_MESSAGES.CHALLAN_NOT_FOUND, HTTP_STATUS.NOT_FOUND);
      if (challan.status === SalesChallanStatus.CANCELLED) {
        throw new AppError(ERROR_MESSAGES.CHALLAN_ALREADY_CANCELLED, HTTP_STATUS.CONFLICT);
      }
      if (challan.status === SalesChallanStatus.CONFIRMED) {
        await lockProductRows(tx, [...new Set(challan.items.map((item) => item.productId))]);
        for (const item of challan.items) {
          await tx.product.update({
            where: { id: item.productId },
            data: { currentStock: { increment: item.quantity } }
          });
          await tx.stockMovement.create({
            data: {
              productId: item.productId,
              quantity: item.quantity,
              movementType: StockMovementType.IN,
              reason: `Challan #${challan.challanNumber} cancelled`,
              createdById: userId
            }
          });
        }
      }
      await tx.salesChallan.update({
        where: { id },
        data: { status: SalesChallanStatus.CANCELLED }
      });
    },
    { timeout: appConfig.transactionTimeoutMs }
  );
}
