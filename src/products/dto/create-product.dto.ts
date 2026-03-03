import {
  IsBoolean,
  IsInt,
  IsOptional,
  IsPositive,
  IsString,
  Min
} from "class-validator";

export class CreateProductDto {
  @IsString()
  sku!: string;

  @IsString()
  name!: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsInt()
  @Min(0)
  price!: number;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsInt()
  @IsPositive()
  initialStock?: number;
}

