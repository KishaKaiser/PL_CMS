import { Module } from '@nestjs/common';
import { MailModule } from '../mail/mail.module';
import { PrismaModule } from '../prisma/prisma.module';
import { CartRecoveryService } from './cart-recovery.service';
import { StoreController } from './store.controller';
import { StoreService } from './store.service';

@Module({
  imports: [PrismaModule, MailModule],
  controllers: [StoreController],
  providers: [StoreService, CartRecoveryService],
  exports: [StoreService, CartRecoveryService],
})
export class StoreModule {}
