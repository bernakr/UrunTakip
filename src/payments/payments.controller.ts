import { Body, Controller, Get, Param, Post, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";
import { AuthenticatedUser } from "../common/interfaces/authenticated-request.interface";
import { CreatePaymentAttemptDto } from "./dto/create-payment-attempt.dto";
import { PaymentAttemptView, PaymentsService } from "./payments.service";

@Controller("payments")
@UseGuards(JwtAuthGuard)
@ApiTags("Payments")
@ApiBearerAuth()
export class PaymentsController {
  constructor(private readonly paymentsService: PaymentsService) {}

  @Post("attempts")
  createAttempt(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreatePaymentAttemptDto
  ): Promise<PaymentAttemptView> {
    return this.paymentsService.createAttempt(user.id, dto);
  }

  @Get("attempts/:id")
  getAttempt(
    @CurrentUser() user: AuthenticatedUser,
    @Param("id") id: string
  ): Promise<PaymentAttemptView> {
    return this.paymentsService.getAttemptForUser(user.id, id);
  }
}
