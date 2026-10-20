import { Module } from '@nestjs/common';
import { ConfigModule } from './config/config.module';
import { PrismaModule } from './prisma/prisma.module';
import { HealthModule } from './health/health.module';
import { AuthModule } from './auth/auth.module';
import { InstallModule } from './install/install.module';
import { WebSocketGatewayModule } from './websocket/websocket.module';
import { ThrottlerModule } from '@nestjs/throttler';
import { ScheduleModule } from '@nestjs/schedule';
import { ProductsModule } from './products/products.module';
import { CheckoutModule } from './checkout/checkout.module';
import { PaymentsModule } from './payments/payments.module';
import { WalletModule } from './wallet/wallet.module';
import { BillingModule } from './billing/billing.module';
import { AppointmentsModule } from './appointments/appointments.module';
import { CallbacksModule } from './callbacks/callbacks.module';
import { HotlineModule } from './hotline/hotline.module';
import { ShippingModule } from './shipping/shipping.module';
import { FulfillmentModule } from './fulfillment/fulfillment.module';
import { AdminModule } from './admin/admin.module';
import { PublicContentModule } from './public/public-content.module';
import { FreeMinutesModule } from './free-minutes/free-minutes.module';
import { MessagesModule } from './messages/messages.module';
import { PayoutsModule } from './payouts/payouts.module';
import { AccountModule } from './account/account.module';
import { DefaultContentModule } from './bootstrap/default-content.module';
import { FormsModule } from './forms/forms.module';
import { SlidersModule } from './sliders/sliders.module';
import { NewsletterModule } from './newsletter/newsletter.module';
import { StoreModule } from './store/store.module';
import { AstrologyModule } from './astrology/astrology.module';
import { IdentityModule } from './identity/identity.module';

@Module({
  imports: [
    ConfigModule,
    ScheduleModule.forRoot(),
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
    AppointmentsModule,
    CallbacksModule,
    HotlineModule,
    ShippingModule,
    FulfillmentModule,
    AdminModule,
    PublicContentModule,
    MessagesModule,
    PayoutsModule,
    FreeMinutesModule,
    AccountModule,
    DefaultContentModule,
    FormsModule,
    SlidersModule,
    NewsletterModule,
    StoreModule,
    AstrologyModule,
    IdentityModule,
  ],
})
export class AppModule {}
