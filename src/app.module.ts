import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { AuthModule } from "./auth/auth.module";
import { CartModule } from "./cart/cart.module";
import { HealthModule } from "./health/health.module";
import { InventoryModule } from "./inventory/inventory.module";
import { PrismaModule } from "./common/prisma/prisma.module";
import { OrdersModule } from "./orders/orders.module";
import { PaymentsModule } from "./payments/payments.module";
import { ProductsModule } from "./products/products.module";
import { RefundsModule } from "./refunds/refunds.module";
import { WebhooksModule } from "./webhooks/webhooks.module";

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true
    }),
    PrismaModule,
    AuthModule,
    ProductsModule,
    InventoryModule,
    CartModule,
    OrdersModule,
    PaymentsModule,
    RefundsModule,
    WebhooksModule,
    HealthModule
  ]
})
export class AppModule {}
