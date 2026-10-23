import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { AdminCandlesController, CandlesController } from './candles.controller';
import { CandlesService } from './candles.service';

@Module({
  imports: [PrismaModule],
  controllers: [CandlesController, AdminCandlesController],
  providers: [CandlesService],
  exports: [CandlesService],
})
export class CandlesModule {}
