import { rgb } from 'pdf-lib';
import { PdfWriter, pdfSafe } from './pdf-writer';

export interface DirectDepositInput {
  accountHolder: string;
  bankName: string;
  accountType: 'CHECKING' | 'SAVINGS';
  routingNumber: string;
  accountNumber: string;
  email: string;
  phone: string;
  /** The typed signature. */
  signature: string;
  signedAt: Date;
  ipAddress?: string;
}

const AUTHORIZATION =
  'I authorize The Psychic Link (the "Company") to send credit entries (direct deposits) to the account listed above for ' +
  'amounts the Company owes me for services I provide as an independent advisor. If a deposit is made in error, I ' +
  'authorize the Company to send a debit entry to correct it, up to the amount of the error. This authorization stays in ' +
  'effect until I give the Company written notice that I am cancelling it, in enough time to act on it. I confirm that the ' +
  'account information above is correct and that I am an authorized owner of the account.';

/** The US bank routing number check: nine digits whose weighted sum (3, 7, 1, repeating) is a multiple of ten. */
export function isValidRoutingNumber(routing: string): boolean {
  if (!/^\d{9}$/.test(routing)) return false;
  const weights = [3, 7, 1, 3, 7, 1, 3, 7, 1];
  const sum = routing.split('').reduce((total, digit, index) => total + Number(digit) * weights[index], 0);
  return sum % 10 === 0;
}

/**
 * The Direct Deposit Authorization form. With no input it is a blank, fillable PDF to download, complete and upload;
 * with input it is the same form filled in and signed electronically.
 */
export async function buildDirectDepositPdf(input?: DirectDepositInput): Promise<Uint8Array> {
  const pdf = await PdfWriter.create('Direct Deposit Authorization');
  const form = input ? null : pdf.doc.getForm();

  pdf.text('Direct Deposit Authorization', { font: pdf.bold, size: 18, gap: 4 });
  pdf.text('The Psychic Link  |  Independent Advisor payments', { font: pdf.italic, size: 9.5, gap: 12, color: [0.35, 0.35, 0.35] });
  pdf.text(
    'Complete this form so The Psychic Link can pay the money you earn straight into your bank account. Keep your account ' +
      'details private: this form is stored encrypted and only authorized staff can open it.',
    { gap: 10 },
  );

  /** One labelled box: the value drawn in it when filled, or a fillable text field when blank. */
  const box = (label: string, name: string, value: string | undefined, width = pdf.contentWidth) => {
    pdf.ensure(46);
    const page = pdf.currentPage;
    pdf.space(10);
    const labelY = pdf.cursorY;
    page.drawText(pdfSafe(label), { x: pdf.margin, y: labelY, size: 8.5, font: pdf.bold, color: rgb(0.3, 0.3, 0.3) });
    const boxY = labelY - 22;
    page.drawRectangle({ x: pdf.margin, y: boxY, width, height: 18, borderColor: rgb(0.55, 0.55, 0.55), borderWidth: 0.7 });
    if (form) {
      const field = form.createTextField(name);
      field.addToPage(page, { x: pdf.margin + 1, y: boxY + 1, width: width - 2, height: 16, borderWidth: 0, font: pdf.regular });
    } else if (value) {
      page.drawText(pdfSafe(value), { x: pdf.margin + 6, y: boxY + 5, size: 10.5, font: pdf.bold });
    }
    pdf.space(30);
  };

  box('Name of account holder', 'accountHolder', input?.accountHolder);
  box('Bank name', 'bankName', input?.bankName);

  // Account type
  pdf.ensure(40);
  const page = pdf.currentPage;
  pdf.space(10);
  const typeY = pdf.cursorY;
  page.drawText('Type of account', { x: pdf.margin, y: typeY, size: 8.5, font: pdf.bold, color: rgb(0.3, 0.3, 0.3) });
  const radio = form?.createRadioGroup('accountType');
  (['CHECKING', 'SAVINGS'] as const).forEach((type, index) => {
    const x = pdf.margin + index * 140;
    const y = typeY - 20;
    page.drawRectangle({ x, y, width: 12, height: 12, borderColor: rgb(0.55, 0.55, 0.55), borderWidth: 0.7 });
    if (radio) radio.addOptionToPage(type === 'CHECKING' ? 'Checking' : 'Savings', page, { x, y, width: 12, height: 12, borderWidth: 0 });
    else if (input?.accountType === type) page.drawText('X', { x: x + 2.5, y: y + 2.5, size: 10, font: pdf.bold });
    page.drawText(type === 'CHECKING' ? 'Checking' : 'Savings', { x: x + 18, y: y + 2, size: 10, font: pdf.regular });
  });
  pdf.space(34);

  box('Bank routing number (9 digits)', 'routingNumber', input?.routingNumber, 250);
  box('Account number', 'accountNumber', input?.accountNumber, 250);
  box('Your email', 'email', input?.email, 330);
  box('Your phone number', 'phone', input?.phone, 250);

  pdf.heading('Authorization', 11);
  pdf.text(AUTHORIZATION, { gap: 8 });

  pdf.ensure(110);
  if (input) {
    pdf.space(4);
    pdf.text('Signature:', { size: 10, gap: 0 });
    pdf.text(input.signature, { font: pdf.script, size: 22, gap: 2 });
    pdf.text(`Signed electronically on ${input.signedAt.toUTCString()}${input.ipAddress ? ` from IP address ${input.ipAddress}` : ''}.`, {
      font: pdf.italic,
      size: 8.5,
      gap: 2,
      color: [0.35, 0.35, 0.35],
    });
    pdf.field('Date', input.signedAt.toISOString().slice(0, 10));
  } else {
    pdf.blankLine('Signature of account holder', 300);
    pdf.blankLine('Date', 140);
  }

  if (form) form.updateFieldAppearances(pdf.regular);
  return pdf.finish('Direct Deposit Authorization');
}
