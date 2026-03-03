import { IsInt, IsOptional, IsString, IsUUID, NotEquals } from "class-validator";

export class AdjustInventoryDto {
  @IsUUID()
  productId!: string;

  @IsInt()
  @NotEquals(0)
  delta!: number;

  @IsOptional()
  @IsString()
  reason?: string;
}

