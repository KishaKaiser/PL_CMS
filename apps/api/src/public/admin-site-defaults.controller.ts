import { Body, Controller, Get, Put, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Role, SITE_SETTING_KEYS, sanitizeSiteDefaultOverrides } from '@pl-cms/shared';
import { Roles, RolesGuard } from '../auth/roles.guard';
import { PrismaService } from '../prisma/prisma.service';
import { SaveSiteDefaultsDto } from './public-content.dto';
import { PublicContentService } from './public-content.service';

/** The site defaults page: shows what is in effect and saves only the values an admin has changed. */
@Controller('admin/site-defaults')
@UseGuards(AuthGuard('jwt'), RolesGuard)
@Roles(Role.ADMIN, Role.EDITOR)
export class AdminSiteDefaultsController {
  constructor(
    private readonly publicContent: PublicContentService,
    private readonly prisma: PrismaService,
  ) {}

  @Get()
  async find() {
    return (await this.publicContent.getSiteConfig()).siteDefaults;
  }

  @Put()
  async save(@Body() dto: SaveSiteDefaultsDto) {
    const overrides = sanitizeSiteDefaultOverrides(dto.overrides);
    const value = JSON.stringify(overrides);
    await this.prisma.setting.upsert({
      where: { key: SITE_SETTING_KEYS.SITE_DEFAULTS },
      update: { value },
      create: { key: SITE_SETTING_KEYS.SITE_DEFAULTS, value },
    });
    return (await this.publicContent.getSiteConfig()).siteDefaults;
  }
}
