import { Body, Controller, Get, Param, Post, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";
import { AuthenticatedUser } from "../common/interfaces/authenticated-request.interface";
import { CheckoutDto } from "./dto/checkout.dto";
import {
  OrderTimelineEventView,
  OrderView,
  OrdersService
} from "./orders.service";

@Controller("orders")
@UseGuards(JwtAuthGuard)
@ApiTags("Orders")
@ApiBearerAuth()
export class OrdersController {
  constructor(private readonly ordersService: OrdersService) {}

  @Post("checkout")
  checkout(
    @CurrentUser() user: AuthenticatedUser,
    @Body() _dto: CheckoutDto
  ): Promise<OrderView> {
    return this.ordersService.checkout(user.id);
  }

  @Get()
  list(@CurrentUser() user: AuthenticatedUser): Promise<OrderView[]> {
    return this.ordersService.listByUser(user.id);
  }

  @Get(":id")
  getById(
    @CurrentUser() user: AuthenticatedUser,
    @Param("id") id: string
  ): Promise<OrderView> {
    return this.ordersService.getByIdForUser(user.id, id);
  }

  @Post(":id/cancel")
  cancel(
    @CurrentUser() user: AuthenticatedUser,
    @Param("id") id: string
  ): Promise<OrderView> {
    return this.ordersService.cancelForUser(user.id, id);
  }

  @Get(":id/timeline")
  timeline(
    @CurrentUser() user: AuthenticatedUser,
    @Param("id") id: string
  ): Promise<OrderTimelineEventView[]> {
    return this.ordersService.getTimelineForUser(user.id, id);
  }
}
