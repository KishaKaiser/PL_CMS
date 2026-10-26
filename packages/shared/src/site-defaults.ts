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
  'bodyFontSize',
  'h1FontSize',
  'h2FontSize',
  'h3FontSize',
  'buttonFontSize',
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
  /** Text sizes in pixels: normal text, the three heading levels, and button text. */
  bodyFontSize: number;
  h1FontSize: number;
  h2FontSize: number;
  h3FontSize: number;
  buttonFontSize: number;
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
  bodyFontSize: 16,
  h1FontSize: 36,
  h2FontSize: 30,
  h3FontSize: 24,
  buttonFontSize: 14,
};

const HEX_COLOR = /^#[0-9a-f]{6}$/i;
const FONT_VALUES = new Set(SITE_FONT_CHOICES.map((font) => font.value));
export const SITE_BUTTON_RADIUS_MAX = 60;

/** The whole-number fields and the smallest and largest value each may have. */
export const SITE_NUMBER_LIMITS = {
  buttonRadius: [0, SITE_BUTTON_RADIUS_MAX],
  bodyFontSize: [12, 24],
  h1FontSize: [18, 96],
  h2FontSize: [16, 80],
  h3FontSize: [14, 64],
  buttonFontSize: [10, 32],
} as const satisfies Record<string, readonly [number, number]>;
export type SiteNumberField = keyof typeof SITE_NUMBER_LIMITS;

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
  for (const field of Object.keys(SITE_NUMBER_LIMITS) as SiteNumberField[]) {
    const raw = source[field];
    const value = Number(raw);
    if (raw === undefined || raw === null || raw === '' || !Number.isFinite(value)) continue;
    const [min, max] = SITE_NUMBER_LIMITS[field];
    result[field] = Math.min(max, Math.max(min, Math.round(value)));
  }
  return result as SiteDefaultOverrides;
}

export function resolveSiteDefaults(inherited: SiteDefaults, overrides: SiteDefaultOverrides): SiteDefaults {
  return { ...inherited, ...overrides };
}

// The buttons across the public pages (shop, cart, login, newsletter, forms...) are plain links and buttons that were
// written with these Tailwind colors. When a button color is chosen on the Site Defaults page they follow it.
const BUTTON_TAGS = '.site-shell :is(a,button,input[type="submit"]):not(:disabled)';
const BUTTON_BACKGROUND_CLASSES = ':is(.bg-purple-600,.bg-purple-700,.bg-indigo-600)';
const BUTTON_HOVER_CLASSES = ':is(.hover\\:bg-purple-700,.hover\\:bg-purple-800,.hover\\:bg-indigo-700)';

/**
 * The `:root` variables and the rules the public site is styled with: the heading font, and the button look for the
 * page-builder and slider buttons (which read the variables) and for the shop and account buttons (which are restyled
 * here). Only changed values produce anything, so an untouched site gets no css at all.
 */
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
  // With a new button color but no hover color chosen, buttons darken a little on hover instead of keeping the old one.
  const autoHover = safe.buttonBackground ? `color-mix(in srgb,${safe.buttonBackground} 82%,black)` : '';
  if (autoHover) variables.push(`--site-button-hover-auto:${autoHover}`);

  if (safe.buttonFontSize !== undefined) variables.push(`--site-button-size:${safe.buttonFontSize}px`);

  const rules: string[] = [];
  if (variables.length > 0) rules.push(`:root{${variables.join(';')}}`);
  if (safe.headingFont) rules.push(`.site-shell :is(h1,h2,h3,h4,h5,h6){font-family:${safe.headingFont}}`);
  // Text sizes. Text that sets its own size (a heading or text block with a size chosen in the page editor, or a Tailwind
  // size on a small label) is not touched: only headings and the page text as a whole follow these.
  if (safe.bodyFontSize !== undefined) rules.push(`.site-shell{font-size:${safe.bodyFontSize}px}`);
  if (safe.h1FontSize !== undefined) rules.push(`.site-shell h1{font-size:${safe.h1FontSize}px}`);
  if (safe.h2FontSize !== undefined) rules.push(`.site-shell h2{font-size:${safe.h2FontSize}px}`);
  if (safe.h3FontSize !== undefined) rules.push(`.site-shell h3{font-size:${safe.h3FontSize}px}`);
  if (safe.buttonFontSize !== undefined) {
    rules.push(`.site-shell :is(.site-button,.site-button-colors){font-size:${safe.buttonFontSize}px}`);
  }

  const normal: string[] = [];
  if (safe.buttonBackground) normal.push(`background-color:${safe.buttonBackground}`);
  if (safe.buttonText) normal.push(`color:${safe.buttonText}`);
  if (safe.buttonFont) normal.push(`font-family:${safe.buttonFont}`);
  if (safe.buttonFontSize !== undefined) normal.push(`font-size:${safe.buttonFontSize}px`);
  if (normal.length > 0) rules.push(`${BUTTON_TAGS}${BUTTON_BACKGROUND_CLASSES}{${normal.join(';')}}`);

  const hover: string[] = [];
  const hoverBackground = safe.buttonHoverBackground ?? autoHover;
  if (hoverBackground) hover.push(`background-color:${hoverBackground}`);
  if (safe.buttonHoverText) hover.push(`color:${safe.buttonHoverText}`);
  if (hover.length > 0) rules.push(`${BUTTON_TAGS}${BUTTON_HOVER_CLASSES}:hover{${hover.join(';')}}`);
  return rules.join('');
}
