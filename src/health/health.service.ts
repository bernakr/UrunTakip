import { Injectable } from "@nestjs/common";
import { PrismaService } from "../common/prisma/prisma.service";
import { QueueService } from "../queue/queue.service";

export interface HealthView {
  status: "ok" | "degraded";
  checks: {
    database: "ok" | "fail";
    paymentQueue: "ok" | "fail";
    refundQueue: "ok" | "fail";
  };
  timestamp: string;
}

@Injectable()
export class HealthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly queueService: QueueService
  ) {}

  async getHealth(): Promise<HealthView> {
    let databaseOk = false;
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      databaseOk = true;
    } catch {
      databaseOk = false;
    }

    const queueStatus = await this.queueService.healthCheck();
    const paymentQueueOk = queueStatus.paymentQueueReady;
    const refundQueueOk = queueStatus.refundQueueReady;

    const isOk = databaseOk && paymentQueueOk && refundQueueOk;

    return {
      status: isOk ? "ok" : "degraded",
      checks: {
        database: databaseOk ? "ok" : "fail",
        paymentQueue: paymentQueueOk ? "ok" : "fail",
        refundQueue: refundQueueOk ? "ok" : "fail"
      },
      timestamp: new Date().toISOString()
    };
  }
}

