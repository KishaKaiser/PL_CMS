import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import type { Prisma } from '@pl-cms/db';
import { PrismaService } from '../../prisma/prisma.service';
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
import { createStoreZip, readStoreZip } from './zip.util';

const DEFAULT_LAYOUT = {
  version: 1,
  type: 'page',
  settings: { layout: 'full', breadcrumbs: true, showTitle: true, showHeader: true, showFooter: true },
  sections: [
    {
      id: 'section-hero',
      type: 'section',
      settings: { layout: 'full', background: '#ffffff', padding: '48px 24px' },
      blocks: [
        {
          id: 'heading-1',
          type: 'heading',
          props: { text: 'New Builder Page', level: 1, align: 'left' },
        },
        {
          id: 'text-1',
          type: 'text',
          props: { text: 'Start editing this visual layout.' },
        },
      ],
    },
  ],
};

@Injectable()
export class ThemeBuilderService {
  constructor(private readonly prisma: PrismaService) {}

  async getLayout(entityType: string, entityId: string) {
    const layout = await this.prisma.builderLayout.findUnique({
      where: { entityType_entityId: { entityType, entityId } },
      include: { versions: { orderBy: { version: 'desc' }, take: 10 } },
    });
    return layout ?? { entityType, entityId, draftJson: DEFAULT_LAYOUT, status: 'DRAFT', version: 0 };
  }

  async saveLayout(dto: SaveLayoutDto, userId?: string) {
    validateBuilderLayout(dto.layout);
    const existing = await this.prisma.builderLayout.findUnique({
      where: { entityType_entityId: { entityType: dto.entityType, entityId: dto.entityId } },
    });
    const nextVersion = (existing?.version ?? 0) + 1;

    return this.prisma.$transaction(async (tx) => {
      const layout = await tx.builderLayout.upsert({
        where: { entityType_entityId: { entityType: dto.entityType, entityId: dto.entityId } },
        create: {
          entityType: dto.entityType,
          entityId: dto.entityId,
          draftJson: toJsonObject(dto.layout),
          status: 'DRAFT',
          version: nextVersion,
          updatedById: userId,
        },
        update: {
          draftJson: toJsonObject(dto.layout),
          status: 'DRAFT',
          version: nextVersion,
          updatedById: userId,
        },
      });

      await tx.builderLayoutVersion.create({
        data: {
          layoutId: layout.id,
          version: nextVersion,
          snapshot: toJsonObject(dto.layout),
          createdById: userId,
        },
      });

      return layout;
    });
  }

  async publishLayout(entityType: string, entityId: string, userId?: string) {
    const layout = await this.prisma.builderLayout.findUnique({
      where: { entityType_entityId: { entityType, entityId } },
    });
    if (!layout) throw new NotFoundException('Builder layout not found');

    return this.prisma.builderLayout.update({
      where: { id: layout.id },
      data: {
        publishedJson: layout.draftJson as Prisma.InputJsonObject,
        status: 'PUBLISHED',
        publishedAt: new Date(),
        updatedById: userId,
      },
    });
  }

  listTemplates(category?: string) {
    return this.prisma.builderTemplate.findMany({
      where: category ? { category } : undefined,
      orderBy: { updatedAt: 'desc' },
    });
  }

  createTemplate(dto: CreateBuilderTemplateDto, userId?: string) {
    validateBuilderLayout(dto.schemaJson);
    return this.prisma.builderTemplate.create({
      data: {
        name: dto.name.trim(),
        description: dto.description?.trim() || null,
        category: dto.category?.trim() || 'page',
        schemaJson: toJsonObject(dto.schemaJson),
        assignmentRules: toJsonObject(dto.assignmentRules),
        isGlobal: dto.isGlobal ?? false,
        createdById: userId,
      },
    });
  }

  async importTemplate(file: Express.Multer.File | undefined, userId?: string) {
    if (!file) throw new NotFoundException('Template JSON file not provided');
    const payload = JSON.parse(file.buffer.toString('utf8')) as {
      name?: string;
      description?: string;
      category?: string;
      schemaJson?: Record<string, unknown>;
      assignmentRules?: Record<string, unknown>;
    };
    return this.createTemplate(
      {
        name: payload.name || 'Imported Template',
        description: payload.description,
        category: payload.category || 'page',
        schemaJson: payload.schemaJson || payload,
        assignmentRules: payload.assignmentRules,
      },
      userId,
    );
  }

  async exportTemplate(id: string) {
    const template = await this.prisma.builderTemplate.findUnique({ where: { id } });
    if (!template) throw new NotFoundException(`Template ${id} not found`);
    return {
      name: template.name,
      description: template.description,
      category: template.category,
      schemaJson: template.schemaJson,
      assignmentRules: template.assignmentRules,
      exportedAt: new Date().toISOString(),
    };
  }

  listWidgets() {
    return this.prisma.builderWidget.findMany({
      orderBy: [{ enabled: 'desc' }, { category: 'asc' }, { label: 'asc' }],
    });
  }

  createWidget(dto: CreateWidgetDto) {
    return this.prisma.builderWidget.upsert({
      where: { type: dto.type },
      create: {
        type: dto.type.trim(),
        label: dto.label.trim(),
        category: dto.category?.trim() || 'content',
        pluginName: dto.pluginName?.trim() || null,
        schemaJson: toJsonObject(dto.schemaJson),
        defaultJson: toJsonObject(dto.defaultJson),
        enabled: dto.enabled ?? true,
      },
      update: {
        label: dto.label.trim(),
        category: dto.category?.trim() || 'content',
        pluginName: dto.pluginName?.trim() || null,
        schemaJson: toJsonObject(dto.schemaJson),
        defaultJson: toJsonObject(dto.defaultJson),
        enabled: dto.enabled ?? true,
      },
    });
  }

  listGlobalComponents() {
    return this.prisma.globalComponent.findMany({ orderBy: { updatedAt: 'desc' } });
  }

  createGlobalComponent(dto: CreateGlobalComponentDto, userId?: string) {
    return this.prisma.globalComponent.create({
      data: {
        name: dto.name.trim(),
        componentType: dto.componentType.trim(),
        schemaJson: toJsonObject(dto.schemaJson),
        createdById: userId,
      },
    });
  }

  listThemes() {
    return this.prisma.cmsTheme.findMany({
      orderBy: [{ isActive: 'desc' }, { updatedAt: 'desc' }],
      include: { assets: true },
    });
  }

  async createTheme(dto: CreateThemeDto, userId?: string) {
    const existing = await this.prisma.cmsTheme.findUnique({ where: { slug: dto.slug } });
    if (existing) throw new ConflictException(`Theme slug "${dto.slug}" already exists`);
    return this.prisma.$transaction(async (tx) => {
      await tx.cmsTheme.updateMany({ data: { isActive: false } });
      return tx.cmsTheme.create({
        data: {
          name: dto.name.trim(),
          slug: dto.slug.trim(),
          version: dto.version?.trim() || '1.0.0',
          description: dto.description?.trim() || null,
          isActive: true,
          globalStyles: toJsonObject(dto.globalStyles),
          templates: toJsonObject(dto.templates),
          components: toJsonObject(dto.components),
          widgetRegistry: (dto.widgetRegistry ?? []) as Prisma.InputJsonArray,
          schemaJson: toJsonObject(dto.schemaJson),
          createdById: userId,
        },
        include: { assets: true },
      });
    });
  }

  async activateTheme(id: string) {
    await this.ensureTheme(id);
    return this.prisma.$transaction(async (tx) => {
      await tx.cmsTheme.updateMany({ data: { isActive: false } });
      return tx.cmsTheme.update({ where: { id }, data: { isActive: true }, include: { assets: true } });
    });
  }

  async updateTheme(id: string, dto: UpdateThemeDto) {
    const currentTheme = await this.prisma.cmsTheme.findUnique({ where: { id }, select: { id: true, slug: true } });
    if (!currentTheme) throw new NotFoundException(`Theme ${id} not found`);

    const nextSlug = dto.slug?.trim();
    if (nextSlug && nextSlug !== currentTheme.slug) {
      const existingSlug = await this.prisma.cmsTheme.findUnique({ where: { slug: nextSlug }, select: { id: true } });
      if (existingSlug && existingSlug.id !== id) {
        throw new ConflictException(`Theme slug "${nextSlug}" already exists`);
      }
    }

    return this.prisma.cmsTheme.update({
      where: { id },
      data: {
        ...(dto.name !== undefined ? { name: dto.name.trim() } : {}),
        ...(nextSlug !== undefined ? { slug: nextSlug } : {}),
        ...(dto.version !== undefined ? { version: dto.version.trim() || '1.0.0' } : {}),
        ...(dto.description !== undefined ? { description: dto.description?.trim() || null } : {}),
        ...(dto.globalStyles !== undefined ? { globalStyles: toJsonObject(dto.globalStyles) } : {}),
        ...(dto.templates !== undefined ? { templates: toJsonObject(dto.templates) } : {}),
        ...(dto.components !== undefined ? { components: toJsonObject(dto.components) } : {}),
        ...(dto.widgetRegistry !== undefined
          ? { widgetRegistry: dto.widgetRegistry as Prisma.InputJsonArray }
          : {}),
        ...(dto.schemaJson !== undefined ? { schemaJson: toJsonObject(dto.schemaJson) } : {}),
      },
      include: { assets: true },
    });
  }

  async deleteTheme(id: string) {
    const theme = await this.prisma.cmsTheme.findUnique({
      where: { id },
      select: { id: true, isActive: true },
    });
    if (!theme) throw new NotFoundException(`Theme ${id} not found`);
    if (theme.isActive) {
      throw new BadRequestException('Activate another theme before deleting this active theme');
    }

    await this.prisma.cmsTheme.delete({ where: { id } });
    return { success: true };
  }

  async saveThemeAssets(themeId: string, dto: SaveThemeAssetsDto) {
    await this.ensureTheme(themeId);
    await this.prisma.themeAsset.deleteMany({ where: { themeId } });
    return this.prisma.themeAsset.createMany({
      data: dto.assets.map((asset) => ({
        themeId,
        assetType: asset.assetType,
        path: asset.path,
        mimeType: asset.mimeType ?? null,
        content: asset.content ?? null,
        mediaAssetId: asset.mediaAssetId ?? null,
      })),
    });
  }

  async exportThemeZip(themeId: string) {
    const theme = await this.prisma.cmsTheme.findUnique({
      where: { id: themeId },
      include: { assets: true },
    });
    if (!theme) throw new NotFoundException(`Theme ${themeId} not found`);

    const manifest = {
      name: theme.name,
      slug: theme.slug,
      version: theme.version,
      description: theme.description,
      schema: theme.schemaJson,
      globalStyles: theme.globalStyles,
      templates: theme.templates,
      components: theme.components,
      widgetRegistry: theme.widgetRegistry,
    };

    return createStoreZip([
      { path: 'theme.json', content: JSON.stringify(manifest, null, 2) },
      ...theme.assets.map((asset) => ({
        path: `assets/${asset.path}`,
        content: asset.content ?? '',
      })),
    ]);
  }

  async importThemeZip(file: Express.Multer.File | undefined, userId?: string) {
    if (!file) throw new NotFoundException('Theme ZIP file not provided');
    const entries = readStoreZip(file.buffer);
    const manifestBuffer = entries.get('theme.json');
    if (!manifestBuffer) throw new NotFoundException('theme.json not found in ZIP');
    const manifest = JSON.parse(manifestBuffer.toString('utf8')) as CreateThemeDto;
    validateThemeManifest(manifest);
    const slug = manifest.slug || manifest.name?.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') || 'imported-theme';

    const theme = await this.createTheme(
      {
        ...manifest,
        slug: `${slug}-${Date.now()}`,
      },
      userId,
    );

    const assets = Array.from(entries.entries())
      .filter(([path]) => path.startsWith('assets/'))
      .map(([path, content]) => ({
        assetType: path.endsWith('.css') ? 'css' : path.endsWith('.js') ? 'js' : 'asset',
        path: path.replace(/^assets\//, ''),
        content: content.toString('utf8'),
      }));

    if (assets.length > 0) await this.saveThemeAssets(theme.id, { assets });
    return this.prisma.cmsTheme.findUnique({ where: { id: theme.id }, include: { assets: true } });
  }

  private async ensureTheme(id: string) {
    const theme = await this.prisma.cmsTheme.findUnique({ where: { id }, select: { id: true } });
    if (!theme) throw new NotFoundException(`Theme ${id} not found`);
  }

  async assignPageDesign(pageId: string, dto: AssignPageDesignDto) {
    return this.prisma.page.update({
      where: { id: pageId },
      data: {
        ...(dto.builderTemplateId !== undefined
          ? {
              builderTemplate: dto.builderTemplateId
                ? { connect: { id: dto.builderTemplateId } }
                : { disconnect: true },
            }
          : {}),
        ...(dto.cmsThemeId !== undefined
          ? {
              cmsTheme: dto.cmsThemeId
                ? { connect: { id: dto.cmsThemeId } }
                : { disconnect: true },
            }
          : {}),
      },
      select: { id: true, builderTemplateId: true, cmsThemeId: true },
    });
  }
}

function toJsonObject(value: Record<string, unknown> | undefined): Prisma.InputJsonObject {
  return (value ?? {}) as Prisma.InputJsonObject;
}

function validateBuilderLayout(value: Record<string, unknown>) {
  if (!value || typeof value !== 'object') throw new NotFoundException('Builder layout JSON is required');
  if (!Array.isArray(value.sections)) {
    throw new NotFoundException('Builder layout must include a sections array');
  }
}

function validateThemeManifest(value: CreateThemeDto) {
  if (!value.name) throw new NotFoundException('Theme manifest must include a name');
  if (!value.globalStyles || typeof value.globalStyles !== 'object') {
    throw new NotFoundException('Theme manifest must include globalStyles');
  }
}
