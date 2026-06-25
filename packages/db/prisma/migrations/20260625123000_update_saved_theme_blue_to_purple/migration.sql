UPDATE "settings"
SET "value" = REPLACE("value", '#4f46e5', '#6f21b6')
WHERE "key" = 'site_theme'
  AND "value" LIKE '%#4f46e5%';
