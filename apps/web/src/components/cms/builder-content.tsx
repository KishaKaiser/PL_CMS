import Link from 'next/link';
import type { BuilderBlock, BuilderLayout } from '../../lib/public-cms';
import { getCategories, getTags } from '../../lib/public-cms';

interface Product {
  id: string;
  name: string;
  description?: string;
  price: string | number;
  currency?: string;
}

type StoreData = {
  products: Product[];
  categories: Array<{ id: string; slug: string; name: string }>;
  tags: Array<{ id: string; slug: string; name: string }>;
};

async function getProducts(): Promise<Product[]> {
  const apiBase = process.env.API_BASE_URL ?? 'http://localhost:3001/api';
  try {
    const res = await fetch(`${apiBase}/products`, { next: { revalidate: 60 } });
    if (!res.ok) return [];
    return res.json() as Promise<Product[]>;
  } catch {
    return [];
  }
}

export async function BuilderContent({ layout }: { layout: BuilderLayout }) {
  const [products, categories, tags] = await Promise.all([getProducts(), getCategories(), getTags()]);
  const storeData = { products, categories, tags };

  return (
    <div>
      {layout.settings?.breadcrumbs !== false && (
        <nav className="border-b bg-gray-50 px-8 py-3 text-sm text-gray-500">
          <Link href="/">Home</Link>
          <span className="mx-2">/</span>
          <span>Page</span>
        </nav>
      )}
      <div className={pageShellClass(layout.settings?.layout)}>
        {layout.settings?.layout === 'sidebar-left' && <DefaultSidebar />}
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
                  <BuilderBlockView key={block.id} block={block} storeData={storeData} />
                ))}
              </div>
            </section>
          ))}
        </div>
        {layout.settings?.layout === 'sidebar-right' && <DefaultSidebar />}
      </div>
    </div>
  );
}

function BuilderBlockView({ block, storeData }: { block: BuilderBlock; storeData: StoreData }) {
  if (block.type === 'heading') {
    return <h1 className="mb-4 font-bold" style={textStyle(block, 40)}>{String(block.props.text ?? '')}</h1>;
  }
  if (block.type === 'text') {
    return <p className="mb-4 leading-7" style={textStyle(block, 16)}>{String(block.props.text ?? '')}</p>;
  }
  if (block.type === 'image') {
    const src = String(block.props.src ?? '');
    if (!src) return null;
    return (
      <div className="mb-4 flex" style={{ justifyContent: imageAlign(block.props.align) }}>
        <img
          src={src}
          alt={String(block.props.alt ?? '')}
          style={{
            width: `${Number(block.props.width ?? 100)}%`,
            height: `${Number(block.props.height ?? 320)}px`,
            objectFit: String(block.props.objectFit ?? 'cover') as 'cover',
            borderRadius: Number(block.props.borderRadius ?? 8),
          }}
        />
      </div>
    );
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
        {(block.children ?? []).map((child) => <BuilderBlockView key={child.id} block={child} storeData={storeData} />)}
      </div>
    );
  }
  if (block.type === 'product-grid') {
    const products = storeData.products.slice(0, Number(block.props.limit ?? 3));
    return (
      <div className="mb-6 grid gap-4 md:grid-cols-3">
        {products.map((product) => (
          <Link key={product.id} href={`/shop/${product.id}`} className="rounded border bg-white p-4 shadow-sm hover:shadow">
            <h3 className="font-semibold">{product.name}</h3>
            {product.description && <p className="mt-1 text-sm text-gray-500">{product.description}</p>}
            <p className="mt-3 text-xl font-bold text-indigo-700">${Number(product.price).toFixed(2)}</p>
          </Link>
        ))}
      </div>
    );
  }
  if (block.type === 'product-categories') {
    return (
      <div className="mb-6 flex flex-wrap gap-2">
        {storeData.categories.map((category) => <span key={category.id} className="rounded-full border px-3 py-1 text-sm">{category.name}</span>)}
      </div>
    );
  }
  if (block.type === 'product-tags') {
    return (
      <div className="mb-6 flex flex-wrap gap-2">
        {storeData.tags.map((tag) => <span key={tag.id} className="rounded bg-gray-100 px-3 py-1 text-sm">#{tag.name}</span>)}
      </div>
    );
  }
  return null;
}

function textStyle(block: BuilderBlock, fallbackSize: number) {
  return {
    color: typeof block.props.color === 'string' ? block.props.color : undefined,
    fontFamily: typeof block.props.fontFamily === 'string' ? block.props.fontFamily : undefined,
    fontSize: `${Number(block.props.fontSize ?? fallbackSize)}px`,
    textAlign: String(block.props.align ?? 'left') as 'left',
  };
}

function imageAlign(value: unknown) {
  if (value === 'left') return 'flex-start';
  if (value === 'right') return 'flex-end';
  return 'center';
}

function pageShellClass(layout?: string) {
  if (layout === 'full') return '';
  if (layout === 'sidebar-left') return 'mx-auto grid max-w-6xl gap-6 p-6 lg:grid-cols-[260px_minmax(0,1fr)]';
  if (layout === 'sidebar-right') return 'mx-auto grid max-w-6xl gap-6 p-6 lg:grid-cols-[minmax(0,1fr)_260px]';
  return '';
}

function DefaultSidebar() {
  return (
    <aside className="rounded border bg-gray-50 p-4 text-sm text-gray-600">
      <h2 className="font-semibold text-gray-900">Sidebar</h2>
      <p className="mt-2">Add sidebar widgets from the theme builder.</p>
    </aside>
  );
}
