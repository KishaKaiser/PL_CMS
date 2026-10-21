import { PDFDocument, PDFFont, PDFPage, StandardFonts, rgb } from 'pdf-lib';

/** Letter size, in points. */
export const PAGE_WIDTH = 612;
export const PAGE_HEIGHT = 792;

/**
 * The built-in PDF fonts only cover Latin-1, so anything else (and the curly quotes and dashes people paste in) is
 * swapped for a plain look-alike or a question mark instead of making the PDF fail.
 */
export function pdfSafe(text: string): string {
  return text
    .replace(/[‘’‚]/g, "'")
    .replace(/[“”„]/g, '"')
    .replace(/[–—]/g, '-')
    .replace(/…/g, '...')
    .replace(/[\r\t]/g, ' ')
    .replace(/[^\n\x20-\x7E\xA0-\xFF]/g, '?');
}

/** A tiny top-to-bottom text layout on top of pdf-lib: headings, paragraphs, bullets and label/value lines. */
export class PdfWriter {
  readonly margin = 54;
  private page!: PDFPage;
  private y = 0;

  private constructor(
    readonly doc: PDFDocument,
    readonly regular: PDFFont,
    readonly bold: PDFFont,
    readonly italic: PDFFont,
    readonly script: PDFFont,
  ) {
    this.newPage();
  }

  static async create(title: string): Promise<PdfWriter> {
    const doc = await PDFDocument.create();
    doc.setTitle(pdfSafe(title));
    doc.setProducer('The Psychic Link');
    doc.setCreator('The Psychic Link');
    const [regular, bold, italic, script] = await Promise.all([
      doc.embedFont(StandardFonts.Helvetica),
      doc.embedFont(StandardFonts.HelveticaBold),
      doc.embedFont(StandardFonts.HelveticaOblique),
      doc.embedFont(StandardFonts.TimesRomanItalic),
    ]);
    return new PdfWriter(doc, regular, bold, italic, script);
  }

  get currentPage(): PDFPage {
    return this.page;
  }

  get cursorY(): number {
    return this.y;
  }

  get contentWidth(): number {
    return PAGE_WIDTH - this.margin * 2;
  }

  newPage() {
    this.page = this.doc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
    this.y = PAGE_HEIGHT - this.margin;
  }

  /** Starts a new page unless this much room is left. */
  ensure(space: number) {
    if (this.y - space < this.margin + 18) this.newPage();
  }

  space(amount: number) {
    this.y -= amount;
  }

  wrap(text: string, font: PDFFont, size: number, maxWidth: number): string[] {
    const lines: string[] = [];
    for (const paragraph of pdfSafe(text).split('\n')) {
      let line = '';
      for (const word of paragraph.split(/\s+/).filter(Boolean)) {
        const attempt = line ? `${line} ${word}` : word;
        if (font.widthOfTextAtSize(attempt, size) <= maxWidth || !line) {
          line = attempt;
        } else {
          lines.push(line);
          line = word;
        }
      }
      lines.push(line);
    }
    return lines;
  }

  /** Draws wrapped text at the left margin plus `indent`, moving down. */
  text(text: string, opts: { font?: PDFFont; size?: number; indent?: number; gap?: number; color?: [number, number, number] } = {}) {
    const font = opts.font ?? this.regular;
    const size = opts.size ?? 10;
    const indent = opts.indent ?? 0;
    const leading = size * 1.35;
    for (const line of this.wrap(text, font, size, this.contentWidth - indent)) {
      this.ensure(leading);
      this.y -= leading;
      if (line) {
        this.page.drawText(line, { x: this.margin + indent, y: this.y, size, font, color: rgb(...(opts.color ?? [0.1, 0.1, 0.1])) });
      }
    }
    this.y -= opts.gap ?? 4;
  }

  heading(text: string, size = 11) {
    this.ensure(size * 3);
    this.y -= 6;
    this.text(text, { font: this.bold, size, gap: 3 });
  }

  bullet(text: string) {
    const size = 10;
    const leading = size * 1.35;
    const lines = this.wrap(text, this.regular, size, this.contentWidth - 22);
    this.ensure(leading * Math.min(lines.length, 2));
    lines.forEach((line, index) => {
      this.ensure(leading);
      this.y -= leading;
      if (index === 0) this.page.drawText('-', { x: this.margin + 8, y: this.y, size, font: this.regular });
      this.page.drawText(line, { x: this.margin + 20, y: this.y, size, font: this.regular, color: rgb(0.1, 0.1, 0.1) });
    });
    this.y -= 2;
  }

  /** "Label:  value", with the value in bold. */
  field(label: string, value: string, opts: { size?: number } = {}) {
    const size = opts.size ?? 10;
    this.ensure(size * 2);
    this.y -= size * 1.5;
    this.page.drawText(pdfSafe(`${label}:`), { x: this.margin, y: this.y, size, font: this.regular });
    const labelWidth = this.regular.widthOfTextAtSize(pdfSafe(`${label}:`), size) + 6;
    this.page.drawText(pdfSafe(value), { x: this.margin + labelWidth, y: this.y, size, font: this.bold });
    this.y -= 4;
  }

  /** A line to write on, with its caption underneath. */
  blankLine(caption: string, width = 260) {
    this.ensure(34);
    this.y -= 22;
    this.page.drawLine({ start: { x: this.margin, y: this.y }, end: { x: this.margin + width, y: this.y }, thickness: 0.6, color: rgb(0.2, 0.2, 0.2) });
    this.y -= 11;
    this.page.drawText(pdfSafe(caption), { x: this.margin, y: this.y, size: 8, font: this.italic, color: rgb(0.35, 0.35, 0.35) });
    this.y -= 2;
  }

  /** Adds "Page n of N" along the bottom of every page, and returns the finished file. */
  async finish(footer: string): Promise<Uint8Array> {
    const pages = this.doc.getPages();
    pages.forEach((page, index) => {
      const label = pdfSafe(`${footer}  |  Page ${index + 1} of ${pages.length}`);
      const width = this.regular.widthOfTextAtSize(label, 8);
      page.drawText(label, { x: (PAGE_WIDTH - width) / 2, y: 28, size: 8, font: this.regular, color: rgb(0.45, 0.45, 0.45) });
    });
    return this.doc.save();
  }
}
