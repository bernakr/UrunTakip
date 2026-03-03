import { IsString, IsUUID, MaxLength, MinLength } from "class-validator";

export class CreatePaymentAttemptDto {
  @IsUUID()
  orderId!: string;

  @IsString()
  @MinLength(8)
  @MaxLength(128)
  idempotencyKey!: string;
}

