interface Props {
  html: string;
  className?: string;
}

export function RichContent({ html, className }: Props) {
  return <div className={className} dangerouslySetInnerHTML={{ __html: html }} />;
}
