import { IsInt, IsOptional, IsString, IsUUID, MaxLength, Min } from "class-validator";

export class CreateRefundDto {
  @IsUUID()
  orderId!: string;

  @IsInt()
  @Min(1)
  amount!: number;

  @IsString()
  @MaxLength(128)
  idempotencyKey!: string;

  @IsOptional()
  @IsString()
  reason?: string;
}

