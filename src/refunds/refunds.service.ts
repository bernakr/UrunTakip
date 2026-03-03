import {
  BadRequestException,
  Injectable,
  NotFoundException
} from "@nestjs/common";
import { OrderStatus, Prisma, RefundStatus } from "@prisma/client";
import { PrismaService } from "../common/prisma/prisma.service";
import { QueueService } from "../queue/queue.service";
import { CreateRefundDto } from "./dto/create-refund.dto";

export interface RefundView {
  id: string;
  orderId: string;
  amount: number;
  status: RefundStatus;
  idempotencyKey: string;
  createdAt: Date;
}

@Injectable()
export class RefundsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly queueService: QueueService
  ) {}

  async createRefund(userId: string, dto: CreateRefundDto): Promise<RefundView> {
    const order = await this.prisma.order.findFirst({
      where: { id: dto.orderId, userId }
    });
    if (!order) {
      throw new NotFoundException("Order not found.");
    }
    if (order.status !== OrderStatus.PAID) {
      throw new BadRequestException("Only paid orders can be refunded.");
    }
    if (dto.amount > order.totalAmount) {
      throw new BadRequestException("Refund amount exceeds order total.");
    }

    let refund = null;
    try {
      refund = await this.prisma.refundRequest.create({
        data: {
          orderId: dto.orderId,
          amount: dto.amount,
          reason: dto.reason,
          idempotencyKey: dto.idempotencyKey,
          status: RefundStatus.REQUESTED
        }
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2002"
      ) {
        refund = await this.prisma.refundRequest.findFirst({
          where: { orderId: dto.orderId, idempotencyKey: dto.idempotencyKey }
        });
      } else {
        throw error;
      }
    }

    if (!refund) {
      throw new BadRequestException("Refund request could not be created.");
    }

    if (refund.status === RefundStatus.REQUESTED) {
      await this.queueService.enqueueRefund({
        refundRequestId: refund.id,
        orderId: refund.orderId
      });
    }

    return {
      id: refund.id,
      orderId: refund.orderId,
      amount: refund.amount,
      status: refund.status,
      idempotencyKey: refund.idempotencyKey,
      createdAt: refund.createdAt
    };
  }

  async getRefund(userId: string, refundId: string): Promise<RefundView> {
    const refund = await this.prisma.refundRequest.findFirst({
      where: {
        id: refundId,
        order: { userId }
      }
    });
    if (!refund) {
      throw new NotFoundException("Refund request not found.");
    }

    return {
      id: refund.id,
      orderId: refund.orderId,
      amount: refund.amount,
      status: refund.status,
      idempotencyKey: refund.idempotencyKey,
      createdAt: refund.createdAt
    };
  }
}

