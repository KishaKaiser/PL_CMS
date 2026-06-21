import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { DefaultContentModule } from '../bootstrap/default-content.module';
import { InstallController } from './install.controller';
import { InstallService } from './install.service';

@Module({
  imports: [PrismaModule, DefaultContentModule],
  controllers: [InstallController],
  providers: [InstallService],
})
export class InstallModule {}
