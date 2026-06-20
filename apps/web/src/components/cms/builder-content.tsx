import type { BuilderBlock, BuilderLayout } from '../../lib/public-cms';

export function BuilderContent({ layout }: { layout: BuilderLayout }) {
  return (
    <div>
      {layout.sections.map((section) => (
        <section
          key={section.id}
          style={{
            background: String(section.settings.background ?? 'transparent'),
            padding: String(section.settings.padding ?? '40px 24px'),
          }}
        >
          <div className={section.settings.layout === 'full' ? '' : 'mx-auto max-w-5xl'}>
            {section.blocks.map((block) => (
              <BuilderBlockView key={block.id} block={block} />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}

function BuilderBlockView({ block }: { block: BuilderBlock }) {
  if (block.type === 'heading') {
    return <h1 className="mb-4 text-4xl font-bold">{String(block.props.text ?? '')}</h1>;
  }
  if (block.type === 'text') {
    return <p className="mb-4 text-gray-700">{String(block.props.text ?? '')}</p>;
  }
  if (block.type === 'image') {
    const src = String(block.props.src ?? '');
    return src ? <img src={src} alt={String(block.props.alt ?? '')} className="mb-4 w-full rounded object-cover" /> : null;
  }
  if (block.type === 'button') {
    return (
      <a href={String(block.props.href ?? '#')} className="mb-4 inline-block rounded bg-indigo-600 px-4 py-2 text-white">
        {String(block.props.label ?? 'Learn More')}
      </a>
    );
  }
  if (block.type === 'columns') {
    return (
      <div className="mb-4 grid gap-4 md:grid-cols-2">
        {(block.children ?? []).map((child) => <BuilderBlockView key={child.id} block={child} />)}
      </div>
    );
  }
  return null;
}
