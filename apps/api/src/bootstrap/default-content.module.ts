import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { DefaultContentService } from './default-content.service';

@Module({
  imports: [PrismaModule],
  providers: [DefaultContentService],
})
export class DefaultContentModule {}
