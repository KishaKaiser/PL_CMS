CREATE TABLE IF NOT EXISTS cms_forms (
  id TEXT PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  description TEXT,
  type TEXT NOT NULL DEFAULT 'CONTACT',
  status TEXT NOT NULL DEFAULT 'DRAFT',
  fields JSONB NOT NULL DEFAULT '[]',
  settings JSONB NOT NULL DEFAULT '{}',
  "successMessage" TEXT NOT NULL DEFAULT 'Thank you. Your submission has been received.',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS cms_form_submissions (
  id TEXT PRIMARY KEY,
  "formId" TEXT NOT NULL,
  data JSONB NOT NULL,
  status TEXT NOT NULL DEFAULT 'NEW',
  "userId" TEXT,
  "ipAddress" TEXT,
  "userAgent" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT cms_form_submissions_form_id_fkey
    FOREIGN KEY ("formId") REFERENCES cms_forms(id)
    ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS cms_forms_type_status_idx ON cms_forms (type, status);
CREATE INDEX IF NOT EXISTS cms_form_submissions_form_id_created_at_idx ON cms_form_submissions ("formId", "createdAt");
CREATE INDEX IF NOT EXISTS cms_form_submissions_status_idx ON cms_form_submissions (status);

INSERT INTO modules (id, name, version, enabled, config, "createdAt", "updatedAt")
VALUES (
  'forms_module',
  'forms',
  '1.0.0',
  true,
  '{}',
  now(),
  now()
)
ON CONFLICT (name) DO NOTHING;
