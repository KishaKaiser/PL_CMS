CREATE TABLE IF NOT EXISTS "builder_layouts" (
  "id" TEXT NOT NULL,
  "entityType" TEXT NOT NULL,
  "entityId" TEXT NOT NULL,
  "draftJson" JSONB NOT NULL,
  "publishedJson" JSONB,
  "version" INTEGER NOT NULL DEFAULT 1,
  "status" TEXT NOT NULL DEFAULT 'DRAFT',
  "updatedById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "publishedAt" TIMESTAMP(3),
  CONSTRAINT "builder_layouts_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "builder_layouts_entityType_entityId_key" ON "builder_layouts"("entityType", "entityId");
CREATE INDEX IF NOT EXISTS "builder_layouts_entityType_entityId_idx" ON "builder_layouts"("entityType", "entityId");

ALTER TABLE "builder_layouts"
ADD CONSTRAINT "builder_layouts_updatedById_fkey"
FOREIGN KEY ("updatedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE IF NOT EXISTS "builder_layout_versions" (
  "id" TEXT NOT NULL,
  "layoutId" TEXT NOT NULL,
  "version" INTEGER NOT NULL,
  "snapshot" JSONB NOT NULL,
  "createdById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "builder_layout_versions_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "builder_layout_versions_layoutId_version_idx" ON "builder_layout_versions"("layoutId", "version");

ALTER TABLE "builder_layout_versions"
ADD CONSTRAINT "builder_layout_versions_layoutId_fkey"
FOREIGN KEY ("layoutId") REFERENCES "builder_layouts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "builder_layout_versions"
ADD CONSTRAINT "builder_layout_versions_createdById_fkey"
FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE IF NOT EXISTS "builder_templates" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "category" TEXT NOT NULL DEFAULT 'page',
  "schemaJson" JSONB NOT NULL,
  "assignmentRules" JSONB NOT NULL DEFAULT '{}',
  "isGlobal" BOOLEAN NOT NULL DEFAULT false,
  "createdById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "builder_templates_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "builder_templates_category_idx" ON "builder_templates"("category");

ALTER TABLE "builder_templates"
ADD CONSTRAINT "builder_templates_createdById_fkey"
FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE IF NOT EXISTS "global_components" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "componentType" TEXT NOT NULL,
  "schemaJson" JSONB NOT NULL,
  "createdById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "global_components_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "builder_widgets" (
  "id" TEXT NOT NULL,
  "type" TEXT NOT NULL,
  "label" TEXT NOT NULL,
  "category" TEXT NOT NULL DEFAULT 'content',
  "pluginName" TEXT,
  "schemaJson" JSONB NOT NULL DEFAULT '{}',
  "defaultJson" JSONB NOT NULL DEFAULT '{}',
  "enabled" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "builder_widgets_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "builder_widgets_type_key" ON "builder_widgets"("type");
CREATE INDEX IF NOT EXISTS "builder_widgets_category_idx" ON "builder_widgets"("category");

CREATE INDEX IF NOT EXISTS "global_components_componentType_idx" ON "global_components"("componentType");

ALTER TABLE "global_components"
ADD CONSTRAINT "global_components_createdById_fkey"
FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE IF NOT EXISTS "cms_themes" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "slug" TEXT NOT NULL,
  "version" TEXT NOT NULL DEFAULT '1.0.0',
  "description" TEXT,
  "isActive" BOOLEAN NOT NULL DEFAULT false,
  "globalStyles" JSONB NOT NULL DEFAULT '{}',
  "templates" JSONB NOT NULL DEFAULT '{}',
  "components" JSONB NOT NULL DEFAULT '{}',
  "widgetRegistry" JSONB NOT NULL DEFAULT '[]',
  "schemaJson" JSONB NOT NULL DEFAULT '{}',
  "createdById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "cms_themes_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "cms_themes_slug_key" ON "cms_themes"("slug");

ALTER TABLE "cms_themes"
ADD CONSTRAINT "cms_themes_createdById_fkey"
FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE IF NOT EXISTS "theme_assets" (
  "id" TEXT NOT NULL,
  "themeId" TEXT NOT NULL,
  "assetType" TEXT NOT NULL,
  "path" TEXT NOT NULL,
  "mimeType" TEXT,
  "content" TEXT,
  "mediaAssetId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "theme_assets_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "theme_assets_themeId_idx" ON "theme_assets"("themeId");

ALTER TABLE "theme_assets"
ADD CONSTRAINT "theme_assets_themeId_fkey"
FOREIGN KEY ("themeId") REFERENCES "cms_themes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "theme_assets"
ADD CONSTRAINT "theme_assets_mediaAssetId_fkey"
FOREIGN KEY ("mediaAssetId") REFERENCES "media_assets"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "pages"
ADD COLUMN IF NOT EXISTS "builderTemplateId" TEXT,
ADD COLUMN IF NOT EXISTS "cmsThemeId" TEXT;

CREATE INDEX IF NOT EXISTS "pages_builderTemplateId_idx" ON "pages"("builderTemplateId");
CREATE INDEX IF NOT EXISTS "pages_cmsThemeId_idx" ON "pages"("cmsThemeId");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'pages_builderTemplateId_fkey'
  ) THEN
    ALTER TABLE "pages"
    ADD CONSTRAINT "pages_builderTemplateId_fkey"
    FOREIGN KEY ("builderTemplateId") REFERENCES "builder_templates"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'pages_cmsThemeId_fkey'
  ) THEN
    ALTER TABLE "pages"
    ADD CONSTRAINT "pages_cmsThemeId_fkey"
    FOREIGN KEY ("cmsThemeId") REFERENCES "cms_themes"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

INSERT INTO "builder_widgets" ("id", "type", "label", "category", "schemaJson", "defaultJson", "enabled", "updatedAt")
VALUES
  ('widget_heading', 'heading', 'Heading', 'content', '{"props":{"text":"string","level":"number","align":"string"}}', '{"id":"heading","type":"heading","props":{"text":"New Heading","level":2}}', true, now()),
  ('widget_text', 'text', 'Text', 'content', '{"props":{"text":"string"}}', '{"id":"text","type":"text","props":{"text":"New text block."}}', true, now()),
  ('widget_image', 'image', 'Image', 'media', '{"props":{"src":"string","alt":"string"}}', '{"id":"image","type":"image","props":{"src":"","alt":""}}', true, now()),
  ('widget_button', 'button', 'Button', 'content', '{"props":{"label":"string","href":"string"}}', '{"id":"button","type":"button","props":{"label":"Learn More","href":"#"}}', true, now()),
  ('widget_columns', 'columns', 'Columns', 'layout', '{"props":{"columns":"number"},"children":"recursive"}', '{"id":"columns","type":"columns","props":{"columns":2},"children":[]}', true, now())
ON CONFLICT ("type") DO NOTHING;
