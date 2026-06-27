interface Props {
  html: string;
  className?: string;
}

export function RichContent({ html, className }: Props) {
  // CMS HTML is sanitized by sanitizeCmsHtml in the API layer before it is persisted and rendered here.
  return <div className={['cms-rich-content', className].filter(Boolean).join(' ')} dangerouslySetInnerHTML={{ __html: html }} />;
}
