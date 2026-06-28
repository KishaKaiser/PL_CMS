'use client';

import Link from 'next/link';
import { addToCart } from '../../lib/cart';

export interface ProductWidgetItem {
  id: string;
  name: string;
  price: string | number;
  currency?: string;
  imageSrc?: string | null;
  imageAlt?: string | null;
}

interface Props {
  products: ProductWidgetItem[];
  primaryColor?: string;
}

export function ProductWidgetGrid({ products, primaryColor = '#6f21b6' }: Props) {
  return (
    <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
      {products.map((product) => {
        const price = Number(product.price);
        const displayPrice = Number.isFinite(price) ? price : 0;
        const currency = product.currency || 'USD';

        return (
          <article
            key={product.id}
            className="group flex h-full flex-col overflow-hidden rounded-lg border bg-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
          >
            <Link href={`/shop/${product.id}`} className="block aspect-[4/3] bg-gray-100">
              {product.imageSrc ? (
                <img
                  src={product.imageSrc}
                  alt={product.imageAlt || product.name}
                  className="h-full w-full object-cover transition group-hover:scale-[1.02]"
                />
              ) : (
                <div className="flex h-full items-center justify-center text-sm text-gray-400">No image</div>
              )}
            </Link>
            <div className="flex flex-1 flex-col p-5">
              <Link href={`/shop/${product.id}`} className="text-lg font-semibold text-gray-950 hover:underline" style={{ textDecorationColor: primaryColor }}>
                {product.name}
              </Link>
              <div className="mt-3 flex items-baseline gap-1">
                <span className="text-2xl font-bold" style={{ color: primaryColor }}>
                  ${displayPrice.toFixed(2)}
                </span>
                <span className="text-sm text-gray-400">{currency}</span>
              </div>
              <button
                type="button"
                onClick={() =>
                  addToCart({
                    productId: product.id,
                    productName: product.name,
                    productPrice: displayPrice,
                    currency,
                    quantity: 1,
                  })
                }
                className="mt-auto rounded px-4 py-2 text-sm font-medium text-white transition hover:opacity-90"
                style={{ backgroundColor: primaryColor }}
              >
                Add to Cart
              </button>
            </div>
          </article>
        );
      })}
    </div>
  );
}
