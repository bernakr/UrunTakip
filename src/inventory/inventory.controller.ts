import { Body, Controller, Get, Param, Post, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { Roles } from "../common/decorators/roles.decorator";
import { Role } from "../common/enums/role.enum";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";
import { RolesGuard } from "../common/guards/roles.guard";
import { AdjustInventoryDto } from "./dto/adjust-inventory.dto";
import { InventoryService, InventoryView } from "./inventory.service";

@Controller("inventory")
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN)
@ApiTags("Inventory")
@ApiBearerAuth()
export class InventoryController {
  constructor(private readonly inventoryService: InventoryService) {}

  @Get(":productId")
  getByProductId(@Param("productId") productId: string): Promise<InventoryView> {
    return this.inventoryService.getByProductId(productId);
  }

  @Post("adjustments")
  adjust(@Body() dto: AdjustInventoryDto): Promise<InventoryView> {
    return this.inventoryService.adjust(dto);
  }
}
