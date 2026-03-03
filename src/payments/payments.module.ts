import { Module } from "@nestjs/common";
import { QueueModule } from "../queue/queue.module";
import { PaymentsController } from "./payments.controller";
import { PaymentsService } from "./payments.service";

@Module({
  imports: [QueueModule],
  controllers: [PaymentsController],
  providers: [PaymentsService],
  exports: [PaymentsService]
})
export class PaymentsModule {}

