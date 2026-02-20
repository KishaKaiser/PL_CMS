import { Module } from '@nestjs/common';
import { ConfigModule } from './config/config.module';
import { PrismaModule } from './prisma/prisma.module';
import { HealthModule } from './health/health.module';
import { AuthModule } from './auth/auth.module';
import { WebSocketGatewayModule } from './websocket/websocket.module';
import { ThrottlerModule } from '@nestjs/throttler';
import { ProductsModule } from './products/products.module';
import { CheckoutModule } from './checkout/checkout.module';
import { PaymentsModule } from './payments/payments.module';
import { WalletModule } from './wallet/wallet.module';
import { BillingModule } from './billing/billing.module';

@Module({
  imports: [
    ConfigModule,
    ThrottlerModule.forRoot([
      {
        ttl: 60_000,
        limit: 100,
      },
    ]),
    PrismaModule,
    HealthModule,
    AuthModule,
    WebSocketGatewayModule,
    ProductsModule,
    CheckoutModule,
    PaymentsModule,
    WalletModule,
    BillingModule,
  ],
})
export class AppModule {}
