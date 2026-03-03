import { BadRequestException, Body, Controller, Headers, Post } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { PaymentWebhookDto } from "./dto/payment-webhook.dto";
import { WebhookProcessResult, WebhooksService } from "./webhooks.service";

@Controller("webhooks")
@ApiTags("Webhooks")
export class WebhooksController {
  constructor(private readonly webhooksService: WebhooksService) {}

  @Post("payments")
  async handlePaymentWebhook(
    @Body() payload: PaymentWebhookDto,
    @Headers("x-signature") signature: string | undefined,
    @Headers("x-event-id") eventIdHeader: string | undefined
  ): Promise<WebhookProcessResult> {
    if (!signature) {
      throw new BadRequestException("x-signature header is required.");
    }

    const serializedPayload = JSON.stringify(payload);
    this.webhooksService.verifySignature(serializedPayload, signature);

    const eventId = eventIdHeader ?? payload.id;
    return this.webhooksService.processPaymentEvent(eventId, payload);
  }
}
