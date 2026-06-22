import {
  IsArray,
  IsBoolean,
  IsObject,
  IsOptional,
  IsString,
  Matches,
} from 'class-validator';

export class SaveLayoutDto {
  @IsString()
  entityType!: string;

  @IsString()
  entityId!: string;

  @IsObject()
  layout!: Record<string, unknown>;
}

export class CreateBuilderTemplateDto {
  @IsString()
  name!: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  category?: string;

  @IsObject()
  schemaJson!: Record<string, unknown>;

  @IsOptional()
  @IsObject()
  assignmentRules?: Record<string, unknown>;

  @IsOptional()
  @IsBoolean()
  isGlobal?: boolean;
}

export class CreateWidgetDto {
  @IsString()
  type!: string;

  @IsString()
  label!: string;

  @IsOptional()
  @IsString()
  category?: string;

  @IsOptional()
  @IsString()
  pluginName?: string;

  @IsOptional()
  @IsObject()
  schemaJson?: Record<string, unknown>;

  @IsOptional()
  @IsObject()
  defaultJson?: Record<string, unknown>;

  @IsOptional()
  @IsBoolean()
  enabled?: boolean;
}

export class CreateGlobalComponentDto {
  @IsString()
  name!: string;

  @IsString()
  componentType!: string;

  @IsObject()
  schemaJson!: Record<string, unknown>;
}

export class CreateThemeDto {
  @IsString()
  name!: string;

  @IsString()
  @Matches(/^[a-z0-9][a-z0-9-]*$/i, {
    message: 'slug must use letters, numbers, and hyphens',
  })
  slug!: string;

  @IsOptional()
  @IsString()
  version?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsObject()
  globalStyles?: Record<string, unknown>;

  @IsOptional()
  @IsObject()
  templates?: Record<string, unknown>;

  @IsOptional()
  @IsObject()
  components?: Record<string, unknown>;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  widgetRegistry?: string[];

  @IsOptional()
  @IsObject()
  schemaJson?: Record<string, unknown>;
}

export class UpdateThemeDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  @Matches(/^[a-z0-9][a-z0-9-]*$/i, {
    message: 'slug must use letters, numbers, and hyphens',
  })
  slug?: string;

  @IsOptional()
  @IsString()
  version?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsObject()
  globalStyles?: Record<string, unknown>;

  @IsOptional()
  @IsObject()
  templates?: Record<string, unknown>;

  @IsOptional()
  @IsObject()
  components?: Record<string, unknown>;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  widgetRegistry?: string[];

  @IsOptional()
  @IsObject()
  schemaJson?: Record<string, unknown>;
}

export class AssignPageDesignDto {
  @IsOptional()
  @IsString()
  builderTemplateId?: string | null;

  @IsOptional()
  @IsString()
  cmsThemeId?: string | null;
}

export class ThemeAssetDto {
  @IsString()
  assetType!: string;

  @IsString()
  path!: string;

  @IsOptional()
  @IsString()
  mimeType?: string;

  @IsOptional()
  @IsString()
  content?: string;

  @IsOptional()
  @IsString()
  mediaAssetId?: string;
}

export class SaveThemeAssetsDto {
  @IsArray()
  assets!: ThemeAssetDto[];
}
