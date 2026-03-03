import { BadRequestException, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../common/prisma/prisma.service";
import { AdjustInventoryDto } from "./dto/adjust-inventory.dto";
import { InventoryService } from "./inventory.service";

type TxInventory = {
  findUnique: jest.Mock;
  update: jest.Mock;
};

type TxClient = {
  inventory: TxInventory;
};

type PrismaServiceMock = {
  inventory: {
    findUnique: jest.Mock;
  };
  $transaction: jest.Mock;
};

describe("InventoryService", () => {
  let service: InventoryService;
  let prismaMock: PrismaServiceMock;

  beforeEach(() => {
    prismaMock = {
      inventory: {
        findUnique: jest.fn()
      },
      $transaction: jest.fn()
    };
    service = new InventoryService(prismaMock as unknown as PrismaService);
  });

  it("returns inventory view", async () => {
    prismaMock.inventory.findUnique.mockResolvedValue({
      productId: "p1",
      onHand: 10,
      reserved: 4,
      updatedAt: new Date("2026-01-01T00:00:00.000Z")
    });

    const result = await service.getByProductId("p1");
    expect(result.available).toBe(6);
    expect(result.onHand).toBe(10);
    expect(result.reserved).toBe(4);
  });

  it("throws when inventory not found", async () => {
    prismaMock.inventory.findUnique.mockResolvedValue(null);
    await expect(service.getByProductId("missing")).rejects.toBeInstanceOf(
      NotFoundException
    );
  });

  it("throws when resulting onHand is negative", async () => {
    const tx: TxClient = {
      inventory: {
        findUnique: jest.fn().mockResolvedValue({
          id: "inv1",
          productId: "p1",
          onHand: 2,
          reserved: 0
        }),
        update: jest.fn()
      }
    };

    prismaMock.$transaction.mockImplementation(
      async (callback: (client: TxClient) => Promise<unknown>) => callback(tx)
    );

    const dto: AdjustInventoryDto = { productId: "p1", delta: -5 };
    await expect(service.adjust(dto)).rejects.toBeInstanceOf(BadRequestException);
  });

  it("updates inventory when delta is valid", async () => {
    const tx: TxClient = {
      inventory: {
        findUnique: jest.fn().mockResolvedValue({
          id: "inv1",
          productId: "p1",
          onHand: 5,
          reserved: 2
        }),
        update: jest.fn().mockResolvedValue({
          productId: "p1",
          onHand: 7,
          reserved: 2,
          updatedAt: new Date("2026-01-02T00:00:00.000Z")
        })
      }
    };

    prismaMock.$transaction.mockImplementation(
      async (callback: (client: TxClient) => Promise<unknown>) => callback(tx)
    );

    const dto: AdjustInventoryDto = { productId: "p1", delta: 2 };
    const result = await service.adjust(dto);

    expect(tx.inventory.update).toHaveBeenCalledWith({
      where: { id: "inv1" },
      data: { onHand: 7 }
    });
    expect(result.available).toBe(5);
  });
});

