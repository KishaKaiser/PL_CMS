'use client';

import { useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { addToCart } from '../../../lib/cart';

interface Inventory {
  onHand: number;
  reserved: number;
}

interface ProductVariant {
  id: string;
  color: string;
  sku: string;
  priceOverride?: number | null;
  imageUrl?: string | null;
  isActive: boolean;
  inventory?: Inventory | null;
}

interface Product {
  id: string;
  name: string;
  price: string | number;
  currency: string;
  minutesPack: number;
}

interface Props {
  product: Product;
  variants: ProductVariant[];
}

export default function ProductDetailClient({ product, variants }: Props) {
  const [selectedVariantId, setSelectedVariantId] = useState<string>(variants[0]?.id ?? '');
  const [addedToCart, setAddedToCart] = useState(false);

  const selected = variants.find((v) => v.id === selectedVariantId) ?? variants[0];
  const displayPrice = selected?.priceOverride ?? Number(product.price);
  const inStock = (selected?.inventory?.onHand ?? 0) - (selected?.inventory?.reserved ?? 0);
  const outOfStock = inStock <= 0;

  const handleAddToCart = () => {
    addToCart({
      productId: product.id,
      productName: product.name,
      productPrice: Number(product.price),
      currency: product.currency,
      variantId: selected?.id,
      variantColor: selected?.color,
      variantPrice: selected?.priceOverride != null ? Number(selected.priceOverride) : undefined,
      quantity: 1,
    });
    setAddedToCart(true);
  };

  return (
    <>
      {/* Variant image */}
      {selected?.imageUrl && (
        <div className="mb-6 overflow-hidden rounded-lg border">
          <Image
            src={selected.imageUrl}
            alt={`${product.name} – ${selected.color}`}
            width={600}
            height={400}
            className="w-full object-cover"
            unoptimized
          />
        </div>
      )}

      {/* Price */}
      <div className="mb-4 flex items-baseline gap-2">
        <span className="text-4xl font-bold text-purple-700">
          ${Number(displayPrice).toFixed(2)}
        </span>
        <span className="text-lg text-gray-400">{product.currency}</span>
      </div>

      {product.minutesPack > 0 && (
        <p className="mb-4 text-base font-medium text-green-700">
          Includes {product.minutesPack} minutes of advisor call time
        </p>
      )}

      {/* Color picker */}
      <div className="mb-6">
        <p className="mb-2 text-sm font-medium text-gray-700">
          Color: <span className="font-semibold">{selected?.color}</span>
        </p>
        <div className="flex flex-wrap gap-2">
          {variants.map((v) => {
            const stock = (v.inventory?.onHand ?? 0) - (v.inventory?.reserved ?? 0);
            const unavailable = stock <= 0;
            return (
              <button
                key={v.id}
                title={`${v.color}${unavailable ? ' (out of stock)' : ''}`}
                onClick={() => {
                  setSelectedVariantId(v.id);
                  setAddedToCart(false);
                }}
                className={`flex h-9 w-9 items-center justify-center rounded-full border-2 transition ${
                  selectedVariantId === v.id
                    ? 'border-purple-600 ring-2 ring-purple-300'
                    : 'border-gray-300 hover:border-gray-400'
                } ${unavailable ? 'opacity-40' : ''}`}
                style={{ backgroundColor: v.color }}
              >
                {unavailable && (
                  <span className="text-[8px] font-bold text-white drop-shadow">✕</span>
                )}
              </button>
            );
          })}
        </div>
        <p className="mt-2 text-xs text-gray-500">SKU: {selected?.sku}</p>
      </div>

      {/* Stock indicator */}
      <p
        className={`mb-6 text-sm font-medium ${
          outOfStock ? 'text-red-600' : 'text-green-700'
        }`}
      >
        {outOfStock ? 'Out of stock' : `In stock (${inStock} available)`}
      </p>

      {/* Add to Cart / Buy buttons */}
      {outOfStock ? (
        <button
          disabled
          className="inline-block cursor-not-allowed rounded bg-gray-300 px-8 py-3 text-gray-500"
        >
          Out of Stock
        </button>
      ) : (
        <div className="flex flex-wrap items-center gap-3">
          <button
            onClick={handleAddToCart}
            className="rounded border border-purple-600 px-8 py-3 text-purple-600 hover:bg-purple-50"
          >
            {addedToCart ? '✓ Added to Cart' : 'Add to Cart'}
          </button>
          <Link
            href={`/shop/checkout?productId=${product.id}&variantId=${selected?.id}`}
            className="inline-block rounded bg-purple-600 px-8 py-3 text-white hover:bg-purple-700"
          >
            Buy Now – ${Number(displayPrice).toFixed(2)}
          </Link>
        </div>
      )}

      {addedToCart && (
        <div className="mt-4 flex items-center gap-4 rounded border border-green-200 bg-green-50 p-3 text-sm">
          <span className="text-green-700">Added to your cart!</span>
          <Link href="/shop/cart" className="font-medium text-purple-600 hover:underline">
            View Cart →
          </Link>
        </div>
      )}
    </>
  );
}

