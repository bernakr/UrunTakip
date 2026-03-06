import { Transform } from "class-transformer";
import { IsIn, IsInt, IsOptional, IsString, Max, MaxLength, Min } from "class-validator";

const ALLOWED_SORT = [
  "newest",
  "oldest",
  "price_asc",
  "price_desc",
  "name_asc",
  "name_desc"
] as const;

export type ProductSort = (typeof ALLOWED_SORT)[number];

export class ListProductsQueryDto {
  @IsOptional()
  @IsString()
  @MaxLength(120)
  q?: string;

  @IsOptional()
  @IsIn(ALLOWED_SORT)
  sort?: ProductSort;

  @Transform(({ value }) => {
    if (value === undefined || value === null || value === "") {
      return undefined;
    }
    return Number(value);
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  page?: number;

  @Transform(({ value }) => {
    if (value === undefined || value === null || value === "") {
      return undefined;
    }
    return Number(value);
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;
}
