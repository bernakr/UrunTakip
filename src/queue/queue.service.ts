import { Injectable, OnModuleDestroy } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { JobsOptions, Queue } from "bullmq";
import { QUEUES } from "./queue.constants";

export interface PaymentJobData {
  paymentAttemptId: string;
  orderId: string;
}

export interface RefundJobData {
  refundRequestId: string;
  orderId: string;
}

@Injectable()
export class QueueService implements OnModuleDestroy {
  private readonly connection: {
    host: string;
    port: number;
    password?: string;
  };
  private readonly paymentQueue: Queue;
  private readonly refundQueue: Queue;

  constructor(private readonly configService: ConfigService) {
    const redisHost = this.configService.get<string>("REDIS_HOST", "localhost");
    const redisPort = Number(this.configService.get<string>("REDIS_PORT", "6379"));
    const redisPassword = this.configService.get<string>("REDIS_PASSWORD");

    this.connection = {
      host: redisHost,
      port: redisPort,
      password: redisPassword || undefined
    };

    this.paymentQueue = new Queue(QUEUES.PAYMENT, {
      connection: this.connection
    });
    this.refundQueue = new Queue(QUEUES.REFUND, {
      connection: this.connection
    });
  }

  async enqueuePayment(data: PaymentJobData): Promise<void> {
    const options: JobsOptions = {
      delay: 2000,
      attempts: 3,
      backoff: {
        type: "exponential",
        delay: 1000
      },
      removeOnComplete: true,
      removeOnFail: 50
    };
    await this.paymentQueue.add(`payment-${data.paymentAttemptId}`, data, options);
  }

  async enqueueRefund(data: RefundJobData): Promise<void> {
    const options: JobsOptions = {
      delay: 2000,
      attempts: 3,
      backoff: {
        type: "exponential",
        delay: 1000
      },
      removeOnComplete: true,
      removeOnFail: 50
    };
    await this.refundQueue.add(`refund-${data.refundRequestId}`, data, options);
  }

  async healthCheck(): Promise<{ paymentQueueReady: boolean; refundQueueReady: boolean }> {
    let paymentQueueReady = false;
    let refundQueueReady = false;

    try {
      await this.paymentQueue.waitUntilReady();
      paymentQueueReady = true;
    } catch {
      paymentQueueReady = false;
    }

    try {
      await this.refundQueue.waitUntilReady();
      refundQueueReady = true;
    } catch {
      refundQueueReady = false;
    }

    return { paymentQueueReady, refundQueueReady };
  }

  async onModuleDestroy(): Promise<void> {
    await this.paymentQueue.close();
    await this.refundQueue.close();
  }
}
