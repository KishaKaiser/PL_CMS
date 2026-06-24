import { Module } from '@nestjs/common';
import { ConfigModule } from './config/config.module';
import { PrismaModule } from './prisma/prisma.module';
import { HealthModule } from './health/health.module';
import { AuthModule } from './auth/auth.module';
import { InstallModule } from './install/install.module';
import { WebSocketGatewayModule } from './websocket/websocket.module';
import { ThrottlerModule } from '@nestjs/throttler';
import { ProductsModule } from './products/products.module';
import { CheckoutModule } from './checkout/checkout.module';
import { PaymentsModule } from './payments/payments.module';
import { WalletModule } from './wallet/wallet.module';
import { BillingModule } from './billing/billing.module';
import { ShippingModule } from './shipping/shipping.module';
import { FulfillmentModule } from './fulfillment/fulfillment.module';
import { AdminModule } from './admin/admin.module';
import { PublicContentModule } from './public/public-content.module';
import { MessagesModule } from './messages/messages.module';
import { AccountModule } from './account/account.module';
import { DefaultContentModule } from './bootstrap/default-content.module';
import { FormsModule } from './forms/forms.module';
import { SlidersModule } from './sliders/sliders.module';

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
    InstallModule,
    AuthModule,
    WebSocketGatewayModule,
    ProductsModule,
    CheckoutModule,
    PaymentsModule,
    WalletModule,
    BillingModule,
    ShippingModule,
    FulfillmentModule,
    AdminModule,
    PublicContentModule,
    MessagesModule,
    AccountModule,
    DefaultContentModule,
    FormsModule,
    SlidersModule,
  ],
})
export class AppModule {}
