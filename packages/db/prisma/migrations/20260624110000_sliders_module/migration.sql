CREATE TABLE IF NOT EXISTS cms_sliders (
  id TEXT PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'DRAFT',
  slides JSONB NOT NULL DEFAULT '[]',
  settings JSONB NOT NULL DEFAULT '{}',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS cms_sliders_status_idx ON cms_sliders (status);

INSERT INTO modules (id, name, version, enabled, config, "createdAt", "updatedAt")
VALUES (
  'sliders_module',
  'sliders',
  '1.0.0',
  true,
  '{}',
  now(),
  now()
)
ON CONFLICT (name) DO NOTHING;
