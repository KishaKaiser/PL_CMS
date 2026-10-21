import { existsSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { PDFDocument, StandardFonts } from 'pdf-lib';
import { pdfSafe } from './pdf-writer';

/**
 * Fills in the official IRS Form W-9 (Rev. March 2024) that ships with the site (apps/api/assets/forms/fw9.pdf), using
 * the form's own fields. It is NOT signed: the W-9 has to be signed by hand, so the filled-in form is printed, signed and
 * dated by the advisor, and the signed copy is uploaded (or emailed to Support). The fields are left editable, so a typing
 * mistake can be fixed in any PDF viewer before printing.
 */

export type W9Classification = 'INDIVIDUAL' | 'C_CORP' | 'S_CORP' | 'PARTNERSHIP' | 'TRUST_ESTATE' | 'LLC' | 'OTHER';

export interface W9Input {
  /** Line 1: the name on your income tax return. */
  name: string;
  /** Line 2: business name, if different. */
  businessName?: string;
  classification: W9Classification;
  /** Line 3a, for an LLC: C, S or P (the LLC's tax classification). */
  llcTaxClass?: 'C' | 'S' | 'P';
  /** Line 3a, for Other. */
  otherClassification?: string;
  /** Line 3b: a partnership, trust or estate with foreign partners, owners or beneficiaries. */
  foreignPartners?: boolean;
  exemptPayeeCode?: string;
  fatcaCode?: string;
  /** Line 5: number, street and apartment or suite. */
  address: string;
  /** Line 6: city, state and ZIP code. */
  cityStateZip: string;
  /** Line 7: account numbers, if any. */
  accountNumbers?: string;
  tinType: 'SSN' | 'EIN';
  /** Nine digits. */
  tin: string;
}

const F = 'topmostSubform[0].Page1[0].';
const BOXES = `${F}Boxes3a-b_ReadOrder[0].`;

const CLASSIFICATION_BOX: Record<W9Classification, string> = {
  INDIVIDUAL: `${BOXES}c1_1[0]`,
  C_CORP: `${BOXES}c1_1[1]`,
  S_CORP: `${BOXES}c1_1[2]`,
  PARTNERSHIP: `${BOXES}c1_1[3]`,
  TRUST_ESTATE: `${BOXES}c1_1[4]`,
  LLC: `${BOXES}c1_1[5]`,
  OTHER: `${BOXES}c1_1[6]`,
};

function formPath(): string {
  const candidates = [
    resolve(__dirname, '../../../assets/forms/fw9.pdf'),
    resolve(__dirname, '../../assets/forms/fw9.pdf'),
    join(process.cwd(), 'apps/api/assets/forms/fw9.pdf'),
    join(process.cwd(), 'assets/forms/fw9.pdf'),
  ];
  const found = candidates.find((candidate) => existsSync(candidate));
  if (!found) throw new Error('The W-9 form is missing from this installation (apps/api/assets/forms/fw9.pdf).');
  return found;
}

/** The blank official form, which advisors can also download, fill in themselves and upload. */
export function blankW9(): Buffer {
  return readFileSync(formPath());
}

export async function fillW9(input: W9Input): Promise<Uint8Array> {
  const pdf = await PDFDocument.load(blankW9(), { ignoreEncryption: true });
  const form = pdf.getForm();
  const text = (name: string, value: string | undefined) => {
    if (value) form.getTextField(`${F}${name}`).setText(pdfSafe(value));
  };

  text('f1_01[0]', input.name);
  text('f1_02[0]', input.businessName);

  form.getCheckBox(CLASSIFICATION_BOX[input.classification]).check();
  if (input.classification === 'LLC') text('Boxes3a-b_ReadOrder[0].f1_03[0]', input.llcTaxClass);
  if (input.classification === 'OTHER') text('Boxes3a-b_ReadOrder[0].f1_04[0]', input.otherClassification);
  if (input.foreignPartners) form.getCheckBox(`${BOXES}c1_2[0]`).check();

  text('f1_05[0]', input.exemptPayeeCode);
  text('f1_06[0]', input.fatcaCode);
  text('Address_ReadOrder[0].f1_07[0]', input.address);
  text('Address_ReadOrder[0].f1_08[0]', input.cityStateZip);
  text('f1_10[0]', input.accountNumbers);

  // The taxpayer identification number goes in boxes of 3-2-4 (SSN) or 2-7 (EIN) digits.
  if (input.tinType === 'SSN') {
    text('f1_11[0]', input.tin.slice(0, 3));
    text('f1_12[0]', input.tin.slice(3, 5));
    text('f1_13[0]', input.tin.slice(5, 9));
  } else {
    text('f1_14[0]', input.tin.slice(0, 2));
    text('f1_15[0]', input.tin.slice(2, 9));
  }

  const helvetica = await pdf.embedFont(StandardFonts.Helvetica);
  form.updateFieldAppearances(helvetica);

  return pdf.save();
}
