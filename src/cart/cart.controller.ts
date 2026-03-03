import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  UseGuards
} from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";
import { AuthenticatedUser } from "../common/interfaces/authenticated-request.interface";
import { AddCartItemDto } from "./dto/add-cart-item.dto";
import { UpdateCartItemDto } from "./dto/update-cart-item.dto";
import { CartService, CartView } from "./cart.service";

@Controller("cart")
@UseGuards(JwtAuthGuard)
@ApiTags("Cart")
@ApiBearerAuth()
export class CartController {
  constructor(private readonly cartService: CartService) {}

  @Get()
  getCart(@CurrentUser() user: AuthenticatedUser): Promise<CartView> {
    return this.cartService.getCart(user.id);
  }

  @Post("items")
  addItem(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: AddCartItemDto
  ): Promise<CartView> {
    return this.cartService.addItem(user.id, dto);
  }

  @Patch("items/:itemId")
  updateItem(
    @CurrentUser() user: AuthenticatedUser,
    @Param("itemId") itemId: string,
    @Body() dto: UpdateCartItemDto
  ): Promise<CartView> {
    return this.cartService.updateItem(user.id, itemId, dto);
  }

  @Delete("items/:itemId")
  removeItem(
    @CurrentUser() user: AuthenticatedUser,
    @Param("itemId") itemId: string
  ): Promise<CartView> {
    return this.cartService.removeItem(user.id, itemId);
  }
}
