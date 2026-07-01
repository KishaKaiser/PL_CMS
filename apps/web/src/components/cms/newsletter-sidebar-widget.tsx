import type { SiteSidebarWidget } from '@pl-cms/shared';
import { NewsletterSubscribeForm } from './newsletter-subscribe-form';

export function NewsletterSidebarWidget({ widget }: { widget: SiteSidebarWidget }) {
  const settings = widget.settings ?? {};
  const description = readString(settings.description, 'Get updates in your inbox.');
  const layout = readString(settings.layout, 'vertical') === 'horizontal' ? 'horizontal' : 'vertical';
  const placeholder = readString(settings.placeholder, 'Email address');
  const buttonLabel = readString(settings.buttonLabel, 'Subscribe');

  return (
    <NewsletterSubscribeForm
      title={widget.title}
      description={description}
      layout={layout}
      placeholder={placeholder}
      buttonLabel={buttonLabel}
      collectName={settings.collectName === true}
    />
  );
}

function readString(value: unknown, fallback: string) {
  return typeof value === 'string' && value.trim() ? value : fallback;
}
