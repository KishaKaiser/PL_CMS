'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { addToCart } from '../../lib/cart';

interface Product {
  id: string;
  name: string;
  shortDescription?: string | null;
  description?: string;
  imageUrl?: string | null;
  featuredMedia?: { url: string; altText?: string | null; title?: string | null } | null;
  price: string | number;
  currency: string;
  minutesPack: number;
}

interface Props {
  products: Array<Product & { imageSrc: string | null }>;
}

export function ProductGrid({ products }: Props) {
  const router = useRouter();
  const [addedProductId, setAddedProductId] = useState<string | null>(null);

  function showAddedMessage(productId: string) {
    setAddedProductId(productId);
    window.setTimeout(() => {
      setAddedProductId((current) => (current === productId ? null : current));
    }, 2500);
  }

  return (
    <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
      {products.map((product) => {
        const price = Number(product.price);

        return (
          <article
            key={product.id}
            role="link"
            tabIndex={0}
            onClick={() => router.push(`/shop/${product.id}`)}
            onKeyDown={(event) => {
              if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                router.push(`/shop/${product.id}`);
              }
            }}
            className="group flex h-full cursor-pointer flex-col overflow-hidden rounded-lg border bg-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-md focus:outline-none focus:ring-2 focus:ring-purple-500"
          >
            <div className="aspect-[4/3] bg-gray-100">
              {product.imageSrc ? (
                <img
                  src={product.imageSrc}
                  alt={product.featuredMedia?.altText || product.featuredMedia?.title || product.name}
                  className="h-full w-full object-cover transition group-hover:scale-[1.02]"
                />
              ) : (
                <div className="flex h-full items-center justify-center text-sm text-gray-400">
                  No image
                </div>
              )}
            </div>
            <div className="flex flex-1 flex-col p-5">
              <h2 className="text-lg font-semibold text-gray-950 group-hover:text-purple-700">
                {product.name}
              </h2>
              <div className="mt-3 flex items-baseline gap-1">
                <span className="text-2xl font-bold text-purple-700">
                  ${price.toFixed(2)}
                </span>
                <span className="text-sm text-gray-400">{product.currency}</span>
              </div>
              <button
                type="button"
                onClick={(event) => {
                  event.stopPropagation();
                  addToCart({
                    productId: product.id,
                    productName: product.name,
                    productPrice: price,
                    currency: product.currency,
                    quantity: 1,
                  });
                  showAddedMessage(product.id);
                }}
                className="mt-auto rounded bg-purple-600 px-4 py-2 text-sm font-medium text-white hover:bg-purple-700"
              >
                Add to Cart
              </button>
              {addedProductId === product.id && (
                <p className="mt-3 rounded bg-green-50 px-3 py-2 text-sm font-medium text-green-700" role="status">
                  Product was added to cart.
                </p>
              )}
            </div>
          </article>
        );
      })}
    </div>
  );
}
