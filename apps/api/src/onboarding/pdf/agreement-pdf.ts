import { AGREEMENT_ACKNOWLEDGEMENTS, parseAgreement } from '../agreement-text';
import { PdfWriter, pdfSafe } from './pdf-writer';

export interface AgreementPdfInput {
  title: string;
  body: string;
  representativeName?: string | null;
  representativeTitle?: string | null;
  advisorName: string;
  professionalName: string;
  email: string;
  phone: string;
  /** The typed signature. Leave out for a blank copy to print, sign by hand and upload. */
  signature?: string;
  signedAt?: Date;
  ipAddress?: string;
}

/** The agreement as a PDF: signed electronically when a signature is given, otherwise a blank copy with lines to sign. */
export async function buildAgreementPdf(input: AgreementPdfInput): Promise<Uint8Array> {
  const pdf = await PdfWriter.create(input.title);
  const signed = !!input.signature;

  pdf.text(input.title, { font: pdf.bold, size: 18, gap: 10 });
  for (const block of parseAgreement(input.body)) {
    if (block.type === 'heading') pdf.heading(block.text);
    else if (block.type === 'bullet') pdf.bullet(block.text);
    else pdf.text(block.text, { gap: 6 });
  }

  // Acknowledgement
  pdf.ensure(150);
  pdf.heading('ADVISOR ACKNOWLEDGEMENT', 12);
  pdf.text('I certify that:', { gap: 3 });
  for (const statement of AGREEMENT_ACKNOWLEDGEMENTS) pdf.bullet(`${signed ? '[X]' : '[  ]'} ${statement}`);

  // Advisor information and signature
  pdf.ensure(210);
  pdf.heading('Advisor Information', 12);
  if (signed) {
    pdf.field('Advisor Name', input.advisorName);
    pdf.field('Professional Name', input.professionalName);
    pdf.field('Email', input.email);
    pdf.field('Phone', input.phone);
    pdf.space(8);
    pdf.text('Signature:', { size: 10, gap: 0 });
    pdf.space(2);
    pdf.text(input.signature as string, { font: pdf.script, size: 22, gap: 2 });
    const when = input.signedAt ?? new Date();
    pdf.text(`Signed electronically on ${when.toUTCString()}${input.ipAddress ? ` from IP address ${input.ipAddress}` : ''}.`, {
      font: pdf.italic,
      size: 8.5,
      gap: 2,
      color: [0.35, 0.35, 0.35],
    });
    pdf.field('Date', when.toISOString().slice(0, 10));
  } else {
    pdf.blankLine('Advisor Name');
    pdf.blankLine('Professional Name');
    pdf.blankLine('Email');
    pdf.blankLine('Phone');
    pdf.blankLine('Signature');
    pdf.blankLine('Date', 140);
  }

  // The Company
  pdf.ensure(140);
  pdf.heading('The Psychic Link', 12);
  const name = input.representativeName?.trim();
  const title = input.representativeTitle?.trim();
  if (name) pdf.field('Authorized Representative', name);
  else pdf.blankLine('Authorized Representative');
  if (title) pdf.field('Title', title);
  else pdf.blankLine('Title');
  pdf.blankLine('Signature');
  pdf.blankLine('Date', 140);

  return pdf.finish(pdfSafe(`${input.title} - ${signed ? input.advisorName : 'blank copy'}`));
}
