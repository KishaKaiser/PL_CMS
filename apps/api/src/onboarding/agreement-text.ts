/**
 * The Independent Advisor Agreement advisors sign during onboarding. Admin can edit the wording (Admin > Advisor
 * applications > Agreement); this is what is used until they do. Written in a tiny markup so it renders on the site
 * and in the signed PDF alike:
 *
 *   ## Heading            a numbered section heading
 *   - Item                a bullet in the list above/below it
 *   anything else         a paragraph (blank lines separate paragraphs)
 */

export const DEFAULT_AGREEMENT_TITLE = 'Independent Advisor Agreement';

export const DEFAULT_AGREEMENT_BODY = `This Independent Advisor Agreement ("Agreement") is entered into between The Psychic Link and the undersigned Advisor ("Advisor") as of the date signed below.

## 1. PURPOSE

The Company operates a platform that connects clients with independent spiritual advisors, psychics, mediums, tarot readers, astrologers, energy healers, and related practitioners.

Advisor desires to provide services through The Psychic Link platform as an independent contractor under the terms outlined in this Agreement.

## 2. INDEPENDENT CONTRACTOR STATUS

Advisor acknowledges and agrees that:

- Advisor is an independent contractor and not an employee.
- Advisor is responsible for all federal, state, and local taxes.
- Advisor is not entitled to employee benefits, workers' compensation, unemployment insurance, or retirement benefits from the Company.
- Advisor controls how readings and services are performed, subject to Company standards.

Nothing in this Agreement creates an employer-employee relationship, partnership, or joint venture.

## 3. SERVICES PROVIDED

Advisor may provide one or more of the following services:

- Psychic Readings
- Mediumship
- Tarot Readings
- Astrology
- Numerology
- Spiritual Coaching
- Energy Healing
- Oracle Readings
- Dream Interpretation
- Other approved spiritual services

Advisor agrees to provide services professionally, ethically, and respectfully.

## 4. PROFESSIONAL STANDARDS

Advisor agrees to:

- Treat clients with dignity and respect.
- Maintain confidentiality of client information.
- Communicate honestly regarding abilities and services.
- Avoid deceptive or fraudulent practices.
- Refrain from discrimination based on race, religion, gender, age, disability, nationality, or sexual orientation.
- Follow all Company policies and procedures.

## 5. PROHIBITED ACTIVITIES

Advisor shall not:

- Claim guaranteed outcomes.
- Diagnose medical conditions.
- Provide medical advice.
- Provide legal advice.
- Provide financial or investment advice.
- Encourage fear-based purchasing.
- Solicit clients outside the platform without Company authorization.
- Harass, threaten, manipulate, or exploit clients.

The Company reserves the right to suspend or terminate accounts that violate these standards.

## 6. CLIENT INFORMATION & CONFIDENTIALITY

Advisor agrees that all client information is confidential.

Advisor shall:

- Maintain confidentiality during and after termination.
- Not share client information with third parties.
- Use client information solely for providing platform services.
- Comply with all applicable privacy laws.

## 7. INTELLECTUAL PROPERTY

Advisor retains ownership of personal reading methods, techniques, and spiritual practices.

The Company retains ownership of:

- The Psychic Link name
- Branding
- Logos
- Website content
- Marketing materials
- Customer databases
- Platform technology

Advisor may not use Company intellectual property except as authorized.

## 8. NON-SOLICITATION

During participation on the platform and for twelve (12) months following termination, Advisor agrees not to:

- Directly solicit Company clients obtained through the platform.
- Attempt to move Company clients to private services.
- Circumvent Company billing processes.

Violation may result in immediate termination and legal remedies.

## 9. COMPENSATION

Advisor shall be compensated according to the then-current Advisor Compensation Schedule provided by the Company.

The Company reserves the right to modify compensation structures with advance notice.

Payments shall be issued through approved payment methods.

Advisor is responsible for reporting all income and taxes.

## 10. BACKGROUND REVIEW AND VERIFICATION

Advisor authorizes the Company to verify:

- Identity
- Professional background
- References
- Public-facing business information

The Company may request additional documentation as part of the onboarding process.

## 11. PERFORMANCE REQUIREMENTS

Advisor agrees to:

- Maintain professional conduct.
- Meet minimum platform standards.
- Respond to clients promptly.
- Maintain accurate availability.

Repeated client complaints, misconduct, or failure to meet standards may result in suspension or termination.

## 12. RECORDING CONSENT

Advisor understands that readings, chats, calls, or sessions conducted through Company systems may be recorded for:

- Quality assurance
- Training
- Compliance
- Dispute resolution

Such recordings remain Company property.

## 13. LIMITATION OF LIABILITY

Advisor understands that spiritual and psychic services are intended for entertainment, personal insight, and spiritual guidance purposes only.

Advisor agrees to hold harmless and indemnify The Psychic Link from claims arising from Advisor conduct, statements, recommendations, or services.

## 14. TERMINATION

Either party may terminate this Agreement at any time with written notice.

The Company may immediately terminate this Agreement for:

- Fraud
- Misrepresentation
- Client abuse
- Ethical violations
- Breach of confidentiality
- Violation of platform policies

Upon termination, Advisor shall immediately cease representing themselves as affiliated with The Psychic Link.

## 15. GOVERNING LAW

This Agreement shall be governed by the laws of the State of Florida.

Any legal dispute arising under this Agreement shall be resolved in the courts of Seminole County, Florida.

## 16. ENTIRE AGREEMENT

This Agreement constitutes the entire understanding between the parties and supersedes prior discussions, representations, or agreements.

No modification shall be valid unless in writing and signed by both parties.`;

/** The statements the advisor ticks before signing ("Advisor Acknowledgement"). Every one has to be ticked. */
export const AGREEMENT_ACKNOWLEDGEMENTS = [
  'I am at least 18 years of age.',
  'I understand that I am an independent contractor.',
  "I agree to comply with The Psychic Link's policies and standards.",
  'I understand that psychic and spiritual services are provided for guidance and entertainment purposes only.',
  'I have read and understand this Agreement.',
];

export type AgreementBlock =
  | { type: 'intro'; text: string }
  | { type: 'heading'; text: string }
  | { type: 'paragraph'; text: string }
  | { type: 'bullet'; text: string };

/** Turns the markup above into blocks the page and the PDF both draw. */
export function parseAgreement(body: string): AgreementBlock[] {
  const blocks: AgreementBlock[] = [];
  let seenHeading = false;
  for (const raw of body.replace(/\r\n/g, '\n').split('\n')) {
    const line = raw.trim();
    if (!line) continue;
    if (line.startsWith('## ')) {
      seenHeading = true;
      blocks.push({ type: 'heading', text: line.slice(3).trim() });
    } else if (line.startsWith('- ')) {
      blocks.push({ type: 'bullet', text: line.slice(2).trim() });
    } else {
      blocks.push({ type: seenHeading ? 'paragraph' : 'intro', text: line });
    }
  }
  return blocks;
}
