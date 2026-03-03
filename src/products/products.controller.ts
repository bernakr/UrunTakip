import { Body, Controller, Get, Param, Post, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { Roles } from "../common/decorators/roles.decorator";
import { Role } from "../common/enums/role.enum";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";
import { RolesGuard } from "../common/guards/roles.guard";
import { CreateProductDto } from "./dto/create-product.dto";
import { ProductListItem, ProductsService } from "./products.service";

@Controller("products")
@ApiTags("Products")
export class ProductsController {
  constructor(private readonly productsService: ProductsService) {}

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @ApiBearerAuth()
  create(@Body() dto: CreateProductDto): Promise<ProductListItem> {
    return this.productsService.create(dto);
  }

  @Get()
  list(): Promise<ProductListItem[]> {
    return this.productsService.list();
  }

  @Get(":id")
  getById(@Param("id") id: string): Promise<ProductListItem> {
    return this.productsService.getById(id);
  }
}
