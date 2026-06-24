import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { AdminFormsController } from './admin-forms.controller';
import { FormsController } from './forms.controller';
import { FormsService } from './forms.service';

@Module({
  imports: [PrismaModule],
  controllers: [AdminFormsController, FormsController],
  providers: [FormsService],
})
export class FormsModule {}
