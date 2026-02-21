import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { InstallController } from './install.controller';
import { InstallService } from './install.service';

@Module({
  imports: [PrismaModule],
  controllers: [InstallController],
  providers: [InstallService],
})
export class InstallModule {}
