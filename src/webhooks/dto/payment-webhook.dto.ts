import {
  IsISO8601,
  IsIn,
  IsString,
  IsUUID,
  ValidateNested
} from "class-validator";
import { Type } from "class-transformer";

class PaymentWebhookDataDto {
  @IsUUID()
  paymentAttemptId!: string;

  @IsUUID()
  orderId!: string;
}

export class PaymentWebhookDto {
  @IsString()
  id!: string;

  @IsIn(["payment.succeeded", "payment.failed"])
  type!: "payment.succeeded" | "payment.failed";

  @IsISO8601()
  occurredAt!: string;

  @ValidateNested()
  @Type(() => PaymentWebhookDataDto)
  data!: PaymentWebhookDataDto;
}

