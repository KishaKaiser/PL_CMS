import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { AdminFreeMinutesController, FreeMinutesController } from './free-minutes.controller';
import { FreeMinutesService } from './free-minutes.service';

@Module({
  imports: [PrismaModule],
  controllers: [FreeMinutesController, AdminFreeMinutesController],
  providers: [FreeMinutesService],
  exports: [FreeMinutesService],
})
export class FreeMinutesModule {}
