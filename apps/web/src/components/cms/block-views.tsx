import type { CSSProperties } from 'react';
import { PdfViewer } from './pdf-viewer';

/**
 * Page-builder blocks that are drawn the same way on the live page and in the editor's preview, so what you see while
 * editing is what visitors get. They are plain markup (no scripts), so they work in server and client components alike.
 */

interface BlockLike {
  id: string;
  props: Record<string, unknown>;
}

// ── Button ───────────────────────────────────────────────────────────────────────────

export type ButtonAlign = 'left' | 'center' | 'right';
export type ButtonWidth = 'auto' | 'full';

export function buttonAlign(value: unknown): ButtonAlign {
  return value === 'center' || value === 'right' ? value : 'left';
}

export function buttonWidth(value: unknown): ButtonWidth {
  return value === 'full' ? 'full' : 'auto';
}

/**
 * A button. The text is always centred inside it (so a long or multi-line label stays centred, and a full-width button
 * looks right). The button itself can sit at the left, centre or right of its row, or fill the whole row. A plain
 * left-aligned button is drawn exactly as before, so buttons on existing pages do not move.
 */
export function ButtonBlockView({ block, color }: { block: BlockLike; color?: string }) {
  const align = buttonAlign(block.props.align);
  const width = buttonWidth(block.props.width);
  const label = String(block.props.label ?? 'Learn More');
  const style: CSSProperties = { whiteSpace: 'pre-line', ...(color ? { backgroundColor: color } : {}) };
  const link = (
    <a
      href={String(block.props.href ?? '#')}
      className={`inline-block rounded px-4 py-2 text-center text-white ${color ? '' : 'bg-purple-600'} ${width === 'full' ? 'w-full' : ''} ${align === 'left' && width === 'auto' ? 'mb-4' : ''}`}
      style={style}
    >
      {label}
    </a>
  );
  if (align === 'left' && width === 'auto') return link;
  return (
    <div className="mb-4" style={{ textAlign: align }}>
      {link}
    </div>
  );
}

// ── Accordion ────────────────────────────────────────────────────────────────────────

export interface AccordionItem {
  id: string;
  title: string;
  body: string;
}

export function getAccordionItems(block: BlockLike): AccordionItem[] {
  const raw = block.props.items;
  if (!Array.isArray(raw)) return [];
  return raw
    .map((item, index): AccordionItem | null => {
      if (!item || typeof item !== 'object') return null;
      const value = item as Record<string, unknown>;
      return { id: String(value.id ?? `item-${index}`), title: String(value.title ?? ''), body: String(value.body ?? '') };
    })
    .filter((item): item is AccordionItem => item !== null);
}

/**
 * Sections that open and close, like a list of questions and answers. Each answer can use the same HTML as a text block.
 * "One open at a time" makes opening one close the others; the first can start open.
 */
export function AccordionBlockView({ block, accent }: { block: BlockLike; accent?: string }) {
  const items = getAccordionItems(block);
  const boxed = block.props.style !== 'lines';
  const singleOpen = block.props.singleOpen !== false;
  const openFirst = block.props.openFirst === true;
  const title = String(block.props.title ?? '').trim();
  const group = singleOpen ? { name: `accordion-${block.id}` } : {};

  if (items.length === 0) return <div className="mb-4 rounded bg-gray-100 p-6 text-center text-sm text-gray-500">Accordion: add some items</div>;

  return (
    <div className="mb-6">
      {title && <h2 className="mb-3 text-2xl font-bold">{title}</h2>}
      <div className={boxed ? 'space-y-3' : 'divide-y border-y'}>
        {items.map((item, index) => (
          <details key={item.id} {...group} open={openFirst && index === 0 ? true : undefined} className={`group ${boxed ? 'rounded-lg border bg-white shadow-sm' : ''}`}>
            <summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-4 py-3 text-left font-semibold marker:hidden [&::-webkit-details-marker]:hidden">
              <span>{item.title || 'Untitled'}</span>
              <span aria-hidden="true" className="shrink-0 text-sm transition-transform duration-200 group-open:rotate-180" style={accent ? { color: accent } : undefined}>
                ▼
              </span>
            </summary>
            <div className="cms-rich-content px-4 pb-4 leading-7" dangerouslySetInnerHTML={{ __html: item.body }} />
          </details>
        ))}
      </div>
    </div>
  );
}

// ── PDF viewer ───────────────────────────────────────────────────────────────────────

/** A PDF from the media library, shown in the page with a page-by-page viewer. Nothing is drawn on the live page until one is chosen. */
export function PdfBlockView({ block, placeholder = false }: { block: BlockLike; placeholder?: boolean }) {
  const src = String(block.props.src ?? '');
  const title = String(block.props.title ?? '').trim();
  const height = Math.min(1400, Math.max(300, Number(block.props.height ?? 720) || 720));
  if (!src) {
    return placeholder ? <div className="mb-4 rounded bg-gray-100 p-12 text-center text-sm text-gray-500">PDF viewer: choose a PDF</div> : null;
  }
  return (
    <div className="mb-6">
      {title && <h2 className="mb-3 text-2xl font-bold">{title}</h2>}
      <PdfViewer src={src} title={title} height={height} showDownload={block.props.showDownload !== false} />
    </div>
  );
}
