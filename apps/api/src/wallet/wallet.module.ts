import { Module } from '@nestjs/common';
import { CheckoutModule } from '../checkout/checkout.module';
import { PaypalWalletController } from './paypal-wallet.controller';
import { PaypalWalletService } from './paypal-wallet.service';
import { WalletController } from './wallet.controller';
import { WalletService } from './wallet.service';

@Module({
  imports: [CheckoutModule],
  controllers: [WalletController, PaypalWalletController],
  providers: [WalletService, PaypalWalletService],
  exports: [PaypalWalletService],
})
export class WalletModule {}
