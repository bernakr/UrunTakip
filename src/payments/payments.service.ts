import {
  BadRequestException,
  Injectable,
  NotFoundException
} from "@nestjs/common";
import { OrderStatus, PaymentAttemptStatus, Prisma } from "@prisma/client";
import { PrismaService } from "../common/prisma/prisma.service";
import { QueueService } from "../queue/queue.service";
import { CreatePaymentAttemptDto } from "./dto/create-payment-attempt.dto";

export interface PaymentAttemptView {
  id: string;
  orderId: string;
  status: PaymentAttemptStatus;
  idempotencyKey: string;
  createdAt: Date;
}

@Injectable()
export class PaymentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly queueService: QueueService
  ) {}

  async createAttempt(
    userId: string,
    dto: CreatePaymentAttemptDto
  ): Promise<PaymentAttemptView> {
    const order = await this.prisma.order.findFirst({
      where: {
        id: dto.orderId,
        userId
      }
    });
    if (!order) {
      throw new NotFoundException("Order not found.");
    }
    if (order.status !== OrderStatus.PENDING_PAYMENT) {
      throw new BadRequestException("Order is not in payable state.");
    }

    let attempt;
    try {
      attempt = await this.prisma.paymentAttempt.create({
        data: {
          orderId: dto.orderId,
          idempotencyKey: dto.idempotencyKey,
          status: PaymentAttemptStatus.PENDING
        }
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2002"
      ) {
        const existingAttempt = await this.prisma.paymentAttempt.findFirst({
          where: {
            orderId: dto.orderId,
            idempotencyKey: dto.idempotencyKey
          }
        });
        if (!existingAttempt) {
          throw error;
        }
        attempt = existingAttempt;
      } else {
        throw error;
      }
    }

    if (attempt.status === PaymentAttemptStatus.PENDING) {
      await this.queueService.enqueuePayment({
        paymentAttemptId: attempt.id,
        orderId: attempt.orderId
      });
    }

    return {
      id: attempt.id,
      orderId: attempt.orderId,
      status: attempt.status,
      idempotencyKey: attempt.idempotencyKey,
      createdAt: attempt.createdAt
    };
  }

  async getAttemptForUser(
    userId: string,
    paymentAttemptId: string
  ): Promise<PaymentAttemptView> {
    const attempt = await this.prisma.paymentAttempt.findFirst({
      where: {
        id: paymentAttemptId,
        order: { userId }
      }
    });
    if (!attempt) {
      throw new NotFoundException("Payment attempt not found.");
    }

    return {
      id: attempt.id,
      orderId: attempt.orderId,
      status: attempt.status,
      idempotencyKey: attempt.idempotencyKey,
      createdAt: attempt.createdAt
    };
  }
}

