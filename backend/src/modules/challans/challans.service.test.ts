import { beforeEach, describe, expect, it, vi } from "vitest";

import { cancelChallan, confirmChallan } from "./challans.service";
import AppError from "../../utils/AppError";
import { SalesChallanStatus, StockMovementType } from "../../constants/enums";

const item = {
  id: 8,
  productId: 3,
  productNameSnapshot: "Widget",
  skuSnapshot: "W-3",
  quantity: 4
};

function makeDatabase(stock = 10, status: string = SalesChallanStatus.DRAFT) {
  const tx = {
    salesChallan: {
      findUnique: vi
        .fn()
        .mockResolvedValue({ id: 7, challanNumber: "CH-2026-0007", status, items: [item] }),
      update: vi.fn().mockResolvedValue({})
    },
    product: { update: vi.fn().mockResolvedValue({}) },
    stockMovement: { create: vi.fn().mockResolvedValue({}) },
    $queryRaw: vi
      .fn()
      .mockResolvedValue([{ id: 3, name: "Widget", sku: "W-3", currentStock: stock }])
  };
  const database = {
    $transaction: vi.fn(async (callback: (client: typeof tx) => unknown) => callback(tx))
  };
  return { database, tx };
}

describe("challan inventory service", () => {
  beforeEach(() => vi.clearAllMocks());

  it("confirms and deducts stock within the transaction", async () => {
    const { database, tx } = makeDatabase();
    await confirmChallan(database as never, 7, 12);
    expect(tx.product.update).toHaveBeenCalledWith({
      where: { id: 3 },
      data: { currentStock: { decrement: 4 } }
    });
    expect(tx.stockMovement.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          movementType: StockMovementType.OUT,
          quantity: 4,
          createdById: 12
        })
      })
    );
    expect(tx.salesChallan.update).toHaveBeenCalledWith({
      where: { id: 7 },
      data: { status: SalesChallanStatus.CONFIRMED }
    });
  });

  it("rejects insufficient stock with all product details and 422", async () => {
    const { database, tx } = makeDatabase(2);
    await expect(confirmChallan(database as never, 7, 12)).rejects.toMatchObject({
      statusCode: 422,
      details: {
        insufficientProducts: [
          {
            productId: 3,
            productName: "Widget",
            sku: "W-3",
            availableQuantity: 2,
            requestedQuantity: 4
          }
        ]
      }
    } satisfies Partial<AppError>);
    expect(tx.product.update).not.toHaveBeenCalled();
    expect(tx.salesChallan.update).not.toHaveBeenCalled();
  });

  it("cancel restores stock and writes a reversing movement", async () => {
    const { database, tx } = makeDatabase(6, SalesChallanStatus.CONFIRMED);
    await cancelChallan(database as never, 7, 12);
    expect(tx.product.update).toHaveBeenCalledWith({
      where: { id: 3 },
      data: { currentStock: { increment: 4 } }
    });
    expect(tx.stockMovement.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          movementType: StockMovementType.IN,
          quantity: 4,
          createdById: 12
        })
      })
    );
    expect(tx.salesChallan.update).toHaveBeenCalledWith({
      where: { id: 7 },
      data: { status: SalesChallanStatus.CANCELLED }
    });
  });
});
