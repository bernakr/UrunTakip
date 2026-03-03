import { Module } from "@nestjs/common";
import { QueueModule } from "../queue/queue.module";
import { RefundsController } from "./refunds.controller";
import { RefundsService } from "./refunds.service";

@Module({
  imports: [QueueModule],
  controllers: [RefundsController],
  providers: [RefundsService],
  exports: [RefundsService]
})
export class RefundsModule {}

