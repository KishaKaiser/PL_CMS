INSERT INTO "cms_themes" (
  "id",
  "name",
  "slug",
  "version",
  "description",
  "isActive",
  "globalStyles",
  "templates",
  "components",
  "widgetRegistry",
  "schemaJson",
  "createdAt",
  "updatedAt"
)
SELECT
  'theme_basic_default',
  'Basic Default',
  'basic-default',
  '1.0.0',
  'Clean starter theme for all pages until another theme is activated.',
  NOT EXISTS (SELECT 1 FROM "cms_themes" WHERE "isActive" = true),
  '{
    "primaryColor": "#4f46e5",
    "accentColor": "#0f766e",
    "fontFamily": "Inter, Arial, sans-serif",
    "heroTitle": "Psychic Link CMS",
    "heroBody": "A clean default CMS theme ready for pages, posts, and builder layouts."
  }'::jsonb,
  '{
    "header": {
      "layout": "contained",
      "style": "simple"
    },
    "footer": {
      "layout": "contained",
      "style": "simple"
    },
    "pageTypes": {
      "page": {
        "layout": "content",
        "container": "default"
      },
      "post": {
        "layout": "article",
        "container": "default"
      },
      "archive": {
        "layout": "listing",
        "container": "wide"
      }
    }
  }'::jsonb,
  '{"widgets":["heading","text","image","button","columns"]}'::jsonb,
  '["heading","text","image","button","columns"]'::jsonb,
  '{"builderVersion":1,"supports":["global-theme","sections","blocks","responsive-preview","theme-assets"]}'::jsonb,
  now(),
  now()
WHERE NOT EXISTS (SELECT 1 FROM "cms_themes" WHERE "slug" = 'basic-default');
