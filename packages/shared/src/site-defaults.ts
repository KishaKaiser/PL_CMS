/**
 * Site defaults: the fonts, colors and button look that everything on the site falls back to when a page, block or
 * slider has not been given its own. Only the values an admin has changed are stored (the "overrides"); everything else
 * keeps following the theme or the built-in look.
 */

export const SITE_DEFAULT_FIELDS = [
  'bodyFont',
  'headingFont',
  'buttonFont',
  'primaryColor',
  'accentColor',
  'textColor',
  'backgroundColor',
  'buttonBackground',
  'buttonText',
  'buttonHoverBackground',
  'buttonHoverText',
  'buttonRadius',
] as const;

export type SiteDefaultField = (typeof SITE_DEFAULT_FIELDS)[number];

/** Every default with a value. Empty headingFont / buttonFont mean "same as the body font". */
export type SiteDefaults = {
  bodyFont: string;
  headingFont: string;
  buttonFont: string;
  primaryColor: string;
  accentColor: string;
  textColor: string;
  backgroundColor: string;
  buttonBackground: string;
  buttonText: string;
  buttonHoverBackground: string;
  buttonHoverText: string;
  /** Corner rounding of buttons, in pixels. */
  buttonRadius: number;
};

/** Only the defaults an admin has changed. */
export type SiteDefaultOverrides = Partial<SiteDefaults>;

export type SiteDefaultsState = {
  /** What an admin has changed. */
  overrides: SiteDefaultOverrides;
  /** What each value would be with no changes (the theme's colors and font, or the built-in look). */
  inherited: SiteDefaults;
  /** What is in effect now: the inherited values with the overrides on top. */
  resolved: SiteDefaults;
};

/** Fonts the site loads (see the root layout) and can therefore offer. An empty value means "same as the body font". */
export const SITE_FONT_CHOICES: Array<{ label: string; value: string }> = [
  { label: 'Inter', value: 'Inter, Arial, sans-serif' },
  { label: 'Arial', value: 'Arial, Helvetica, sans-serif' },
  { label: 'Georgia', value: 'Georgia, serif' },
  { label: 'Poppins', value: 'Poppins, Arial, sans-serif' },
  { label: 'Montserrat', value: 'Montserrat, Arial, sans-serif' },
  { label: 'Playfair Display', value: '"Playfair Display", Georgia, serif' },
  { label: 'Lora', value: 'Lora, Georgia, serif' },
  { label: 'Cormorant Garamond', value: '"Cormorant Garamond", Georgia, serif' },
];

export const SITE_DEFAULTS_BUILT_IN: Omit<SiteDefaults, 'bodyFont' | 'primaryColor' | 'accentColor'> = {
  headingFont: '',
  buttonFont: '',
  textColor: '#111827',
  backgroundColor: '#f9fafb',
  buttonBackground: '#9333ea',
  buttonText: '#ffffff',
  buttonHoverBackground: '#7e22ce',
  buttonHoverText: '#ffffff',
  buttonRadius: 4,
};

const HEX_COLOR = /^#[0-9a-f]{6}$/i;
const FONT_VALUES = new Set(SITE_FONT_CHOICES.map((font) => font.value));
export const SITE_BUTTON_RADIUS_MAX = 60;

const COLOR_FIELDS: SiteDefaultField[] = [
  'primaryColor',
  'accentColor',
  'textColor',
  'backgroundColor',
  'buttonBackground',
  'buttonText',
  'buttonHoverBackground',
  'buttonHoverText',
];
const FONT_FIELDS: SiteDefaultField[] = ['bodyFont', 'headingFont', 'buttonFont'];

/**
 * Keeps only values that are safe to put into the page's styles: six-digit hex colors, fonts from the list above, and a
 * whole-number radius. Anything else is dropped, so a bad value can never reach the stylesheet.
 */
export function sanitizeSiteDefaultOverrides(raw: unknown): SiteDefaultOverrides {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};
  const source = raw as Record<string, unknown>;
  const result: Record<string, string | number> = {};

  for (const field of COLOR_FIELDS) {
    const value = source[field];
    if (typeof value === 'string' && HEX_COLOR.test(value.trim())) result[field] = value.trim().toLowerCase();
  }
  for (const field of FONT_FIELDS) {
    const value = source[field];
    if (typeof value !== 'string') continue;
    // Heading and button fonts may be empty: that means "same as the body font".
    if (FONT_VALUES.has(value) || (value === '' && field !== 'bodyFont')) result[field] = value;
  }
  const radius = Number(source.buttonRadius);
  if (source.buttonRadius !== undefined && source.buttonRadius !== null && source.buttonRadius !== '' && Number.isFinite(radius)) {
    result.buttonRadius = Math.min(SITE_BUTTON_RADIUS_MAX, Math.max(0, Math.round(radius)));
  }
  return result as SiteDefaultOverrides;
}

export function resolveSiteDefaults(inherited: SiteDefaults, overrides: SiteDefaultOverrides): SiteDefaults {
  return { ...inherited, ...overrides };
}

/** The `:root` variables and the heading rule the public site is styled with. Only changed values produce anything. */
export function buildSiteDefaultsCss(overrides: SiteDefaultOverrides): string {
  const safe = sanitizeSiteDefaultOverrides(overrides);
  const variables: string[] = [];
  if (safe.buttonBackground) variables.push(`--site-button-bg:${safe.buttonBackground}`);
  if (safe.buttonText) variables.push(`--site-button-text:${safe.buttonText}`);
  if (safe.buttonHoverBackground) variables.push(`--site-button-hover-bg:${safe.buttonHoverBackground}`);
  if (safe.buttonHoverText) variables.push(`--site-button-hover-text:${safe.buttonHoverText}`);
  if (safe.buttonRadius !== undefined) variables.push(`--site-button-radius:${safe.buttonRadius}px`);
  // An empty button font means "same as the body font", so there is nothing to set.
  if (safe.buttonFont) variables.push(`--site-button-font:${safe.buttonFont}`);

  const rules: string[] = [];
  if (variables.length > 0) rules.push(`:root{${variables.join(';')}}`);
  if (safe.headingFont) rules.push(`.site-shell :is(h1,h2,h3,h4,h5,h6){font-family:${safe.headingFont}}`);
  return rules.join('');
}
