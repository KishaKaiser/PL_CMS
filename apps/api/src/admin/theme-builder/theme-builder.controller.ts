import {
  Body,
  Controller,
  Get,
  Header,
  Param,
  Post,
  Query,
  Request,
  StreamableFile,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { FileInterceptor } from '@nestjs/platform-express';
import { Role } from '@pl-cms/shared';
import { Roles, RolesGuard } from '../../auth/roles.guard';
import {
  CreateBuilderTemplateDto,
  CreateGlobalComponentDto,
  CreateThemeDto,
  CreateWidgetDto,
  AssignPageDesignDto,
  SaveLayoutDto,
  SaveThemeAssetsDto,
  UpdateThemeDto,
} from './theme-builder.dto';
import { ThemeBuilderService } from './theme-builder.service';

type AuthenticatedRequest = { user: { id: string } };

@Controller('admin/builder')
@UseGuards(AuthGuard('jwt'), RolesGuard)
@Roles(Role.ADMIN, Role.EDITOR)
export class ThemeBuilderController {
  constructor(private readonly themeBuilder: ThemeBuilderService) {}

  @Get('layouts/:entityType/:entityId')
  getLayout(@Param('entityType') entityType: string, @Param('entityId') entityId: string) {
    return this.themeBuilder.getLayout(entityType, entityId);
  }

  @Post('layouts')
  saveLayout(@Body() dto: SaveLayoutDto, @Request() req: AuthenticatedRequest) {
    return this.themeBuilder.saveLayout(dto, req.user.id);
  }

  @Post('layouts/:entityType/:entityId/publish')
  publishLayout(
    @Param('entityType') entityType: string,
    @Param('entityId') entityId: string,
    @Request() req: AuthenticatedRequest,
  ) {
    return this.themeBuilder.publishLayout(entityType, entityId, req.user.id);
  }

  @Get('templates')
  listTemplates(@Query('category') category?: string) {
    return this.themeBuilder.listTemplates(category);
  }

  @Get('widgets')
  listWidgets() {
    return this.themeBuilder.listWidgets();
  }

  @Post('widgets')
  createWidget(@Body() dto: CreateWidgetDto) {
    return this.themeBuilder.createWidget(dto);
  }

  @Post('templates')
  createTemplate(@Body() dto: CreateBuilderTemplateDto, @Request() req: AuthenticatedRequest) {
    return this.themeBuilder.createTemplate(dto, req.user.id);
  }

  @Get('templates/:id/export')
  @Header('Content-Type', 'application/json')
  async exportTemplate(@Param('id') id: string) {
    return this.themeBuilder.exportTemplate(id);
  }

  @Post('templates/import')
  @UseInterceptors(FileInterceptor('file'))
  importTemplate(
    @UploadedFile() file: Express.Multer.File | undefined,
    @Request() req: AuthenticatedRequest,
  ) {
    return this.themeBuilder.importTemplate(file, req.user.id);
  }

  @Get('components')
  listComponents() {
    return this.themeBuilder.listGlobalComponents();
  }

  @Post('components')
  createComponent(@Body() dto: CreateGlobalComponentDto, @Request() req: AuthenticatedRequest) {
    return this.themeBuilder.createGlobalComponent(dto, req.user.id);
  }

  @Get('themes')
  listThemes() {
    return this.themeBuilder.listThemes();
  }

  @Post('themes')
  createTheme(@Body() dto: CreateThemeDto, @Request() req: AuthenticatedRequest) {
    return this.themeBuilder.createTheme(dto, req.user.id);
  }

  @Post('themes/:id')
  updateTheme(@Param('id') id: string, @Body() dto: UpdateThemeDto) {
    return this.themeBuilder.updateTheme(id, dto);
  }

  @Post('themes/:id/activate')
  activateTheme(@Param('id') id: string) {
    return this.themeBuilder.activateTheme(id);
  }

  @Post('themes/:id/assets')
  saveAssets(@Param('id') id: string, @Body() dto: SaveThemeAssetsDto) {
    return this.themeBuilder.saveThemeAssets(id, dto);
  }

  @Get('themes/:id/export')
  @Header('Content-Type', 'application/zip')
  async exportTheme(@Param('id') id: string) {
    return new StreamableFile(await this.themeBuilder.exportThemeZip(id));
  }

  @Post('themes/import')
  @UseInterceptors(FileInterceptor('file'))
  importTheme(
    @UploadedFile() file: Express.Multer.File | undefined,
    @Request() req: AuthenticatedRequest,
  ) {
    return this.themeBuilder.importThemeZip(file, req.user.id);
  }

  @Post('pages/:pageId/design')
  assignPageDesign(@Param('pageId') pageId: string, @Body() dto: AssignPageDesignDto) {
    return this.themeBuilder.assignPageDesign(pageId, dto);
  }
}
