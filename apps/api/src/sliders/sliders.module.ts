import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { AdminSlidersController } from './admin-sliders.controller';
import { SlidersController } from './sliders.controller';
import { SlidersService } from './sliders.service';

@Module({
  imports: [PrismaModule],
  controllers: [AdminSlidersController, SlidersController],
  providers: [SlidersService],
})
export class SlidersModule {}
