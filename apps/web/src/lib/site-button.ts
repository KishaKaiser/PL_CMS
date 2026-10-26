import type { CSSProperties } from 'react';

/**
 * For a button drawn with the `site-button-colors` class (see globals.css). It looks as it always has, in `fallback`
 * (normally the theme's primary color) and, if it had one, `hoverFallback`, until a button color is chosen on the Site
 * Defaults page.
 */
export function siteButtonStyle(fallback: string, hoverFallback?: string): CSSProperties {
  return {
    '--site-button-fallback': fallback,
    ...(hoverFallback ? { '--site-button-hover-fallback': hoverFallback } : {}),
  } as CSSProperties;
}
