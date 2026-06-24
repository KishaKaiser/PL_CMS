import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Put,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Role } from '@pl-cms/shared';
import { Roles, RolesGuard } from '../auth/roles.guard';
import { CreateCmsFormDto, UpdateCmsFormDto } from './forms.dto';
import { FormsService } from './forms.service';

@Controller('admin/forms')
@UseGuards(AuthGuard('jwt'), RolesGuard)
@Roles(Role.ADMIN, Role.EDITOR)
export class AdminFormsController {
  constructor(private readonly formsService: FormsService) {}

  @Get()
  findAll() {
    return this.formsService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.formsService.findOne(id);
  }

  @Get(':id/submissions')
  submissions(@Param('id') id: string) {
    return this.formsService.listSubmissions(id);
  }

  @Post()
  create(@Body() dto: CreateCmsFormDto) {
    return this.formsService.create(dto);
  }

  @Put(':id')
  update(@Param('id') id: string, @Body() dto: UpdateCmsFormDto) {
    return this.formsService.update(id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('id') id: string) {
    return this.formsService.remove(id);
  }
}
