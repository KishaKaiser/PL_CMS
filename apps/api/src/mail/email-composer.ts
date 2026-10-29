import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { renderEmail } from './email-layout';
import { EmailSettingsService, type EmailDesignOverrides } from './email-settings.service';
import { fillTemplate, loadEmailTemplates } from './email-templates';

export interface ComposeOptions {
  /** True for emails to customers: they get the sign-off and the footer line. Emails to the owner are plain. */
  customer: boolean;
  /** A button under the message. `label` defaults to the "Track your order" label chosen on the Email page. */
  button?: { url: string; label?: string } | null;
  /** The small line at the bottom of a customer email when the Email page has no footer of its own. */
  defaultFooter?: string;
  /** A bottom line that always wins, such as one holding an unsubscribe link. */
  fixedFooter?: string;
  /** Design changes that are not saved yet, for the preview. */
  design?: EmailDesignOverrides;
}

export interface ComposedEmail {
  subject: string;
  html: string;
  text: string;
  /** The template's own on/off switch (the owner alerts ignore it: they follow the Email page). */
  enabled: boolean;
}

/** Turns one of the editable templates, with an order's details filled in, into a finished email in the chosen design. */
@Injectable()
export class EmailComposer {
  constructor(
    private readonly prisma: PrismaService,
    private readonly settings: EmailSettingsService,
  ) {}

  async compose(templateKey: string, values: Record<string, string>, options: ComposeOptions): Promise<ComposedEmail | null> {
    const [templates, design] = await Promise.all([loadEmailTemplates(this.prisma), this.settings.design(options.design)]);
    const template = templates.find((entry) => entry.key === templateKey);
    if (!template) return null;

    const content = renderEmail({
      body: fillTemplate(template.body, values),
      button: options.button ? { url: options.button.url, label: options.button.label ?? design.trackButtonLabel } : null,
      signature: options.customer ? design.signature : undefined,
      footer: options.fixedFooter ?? (options.customer ? design.footerText || options.defaultFooter : undefined),
      siteName: design.siteName,
      logoUrl: design.logoUrl,
      accentColor: design.accentColor,
    });
    return { subject: fillTemplate(template.subject, values).replace(/[\r\n]+/g, ' ').trim(), enabled: template.enabled, ...content };
  }
}
