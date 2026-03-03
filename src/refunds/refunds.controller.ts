import { Body, Controller, Get, Param, Post, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";
import { AuthenticatedUser } from "../common/interfaces/authenticated-request.interface";
import { CreateRefundDto } from "./dto/create-refund.dto";
import { RefundView, RefundsService } from "./refunds.service";

@Controller("refunds")
@UseGuards(JwtAuthGuard)
@ApiTags("Refunds")
@ApiBearerAuth()
export class RefundsController {
  constructor(private readonly refundsService: RefundsService) {}

  @Post()
  createRefund(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateRefundDto
  ): Promise<RefundView> {
    return this.refundsService.createRefund(user.id, dto);
  }

  @Get(":id")
  getRefund(
    @CurrentUser() user: AuthenticatedUser,
    @Param("id") id: string
  ): Promise<RefundView> {
    return this.refundsService.getRefund(user.id, id);
  }
}
