'use client';

import { useState } from 'react';
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
  type?: 'PHYSICAL' | 'DIGITAL' | 'MINUTE_PACK';
  digitalDelivery?: 'NONE' | 'ASTROLOGY_REPORT';
  shortDescription?: string | null;
  price: string | number;
  currency: string;
  minutesPack: number;
  stockQuantity?: number | null;
  stockStatus?: string | null;
  trackStock?: boolean | null;
}

interface Props {
  product: Product;
  variants: ProductVariant[];
  productImage: string;
  productImageAlt: string;
}

export default function ProductDetailClient({ product, variants, productImage, productImageAlt }: Props) {
  const [selectedVariantId, setSelectedVariantId] = useState<string>(variants[0]?.id ?? '');
  const [addedToCart, setAddedToCart] = useState(false);

  const hasVariants = variants.length > 0;
  const selected = variants.find((v) => v.id === selectedVariantId) ?? variants[0];
  const selectedSwatch = selected ? parseVariantColor(selected.color) : null;
  const displayPrice = Number(selected?.priceOverride ?? product.price);
  const selectedImage = selected?.imageUrl || productImage;
  const variantStock = hasVariants ? (selected?.inventory?.onHand ?? 0) - (selected?.inventory?.reserved ?? 0) : null;
  const productStock = product.stockQuantity ?? null;
  const outOfStock = hasVariants
    ? (variantStock ?? 0) <= 0
    : product.stockStatus === 'OUT_OF_STOCK' || (product.trackStock === true && (productStock ?? 0) <= 0);

  const handleAddToCart = () => {
    if (outOfStock) return;

    addToCart({
      productId: product.id,
      productName: product.name,
      productPrice: Number(product.price),
      productType: product.type,
      digitalDelivery: product.digitalDelivery,
      currency: product.currency,
      variantId: selected?.id,
      variantColor: selectedSwatch?.label,
      variantPrice: selected?.priceOverride != null ? Number(selected.priceOverride) : undefined,
      quantity: 1,
    });
    setAddedToCart(true);
  };

  return (
    <section className="grid gap-8 lg:grid-cols-[minmax(0,460px)_minmax(0,1fr)]">
      <div className="overflow-hidden rounded-lg border bg-white shadow-sm">
        {selectedImage ? (
          <img
            src={selectedImage}
            alt={selectedSwatch ? `${product.name} - ${selectedSwatch.label}` : productImageAlt}
            className="aspect-square w-full object-cover"
          />
        ) : (
          <div className="flex aspect-square w-full items-center justify-center bg-gray-100 text-sm text-gray-500">
            Product image
          </div>
        )}
      </div>

      <section className="rounded-lg border bg-white shadow-sm">
        <div className="border-b border-gray-100 p-6">
          <h1 className="text-4xl font-bold text-gray-950">{product.name}</h1>
        </div>

        {product.shortDescription && (
          <div className="border-b border-gray-100 p-6">
            <div className="cms-rich-content prose max-w-none text-lg leading-8 text-gray-600" dangerouslySetInnerHTML={{ __html: product.shortDescription }} />
          </div>
        )}

        <div className="space-y-6 p-6">
          <div className="border-y border-gray-100 py-5">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">Price</p>
            <div className="flex items-baseline gap-2">
              <span className="text-4xl font-bold text-purple-700">
              ${Number(displayPrice).toFixed(2)}
              </span>
              <span className="text-lg text-gray-400">{product.currency}</span>
            </div>
          </div>

          {product.minutesPack > 0 && (
            <p className="rounded-lg bg-green-50 px-4 py-3 text-base font-medium text-green-700">
              Includes {product.minutesPack} minutes of advisor call time
            </p>
          )}

          {hasVariants && (
            <div>
              <p className="mb-2 text-sm font-medium text-gray-700">
                Color: <span className="font-semibold">{selectedSwatch?.label}</span>
              </p>
              <div className="flex flex-wrap gap-2">
                {variants.map((v) => {
                  const stock = (v.inventory?.onHand ?? 0) - (v.inventory?.reserved ?? 0);
                  const unavailable = stock <= 0;
                  return (
                    <button
                      key={v.id}
                      title={`${parseVariantColor(v.color).label}${unavailable ? ' (out of stock)' : ''}`}
                      onClick={() => {
                        setSelectedVariantId(v.id);
                        setAddedToCart(false);
                      }}
                      className={`flex h-9 w-9 items-center justify-center rounded-full border-2 transition ${
                        selectedVariantId === v.id
                          ? 'border-purple-600 ring-2 ring-purple-300'
                          : 'border-gray-300 hover:border-gray-400'
                      } ${unavailable ? 'opacity-40' : ''}`}
                      style={{ background: variantSwatchBackground(v.color) }}
                    >
                      {unavailable && (
                        <span className="text-[8px] font-bold text-white drop-shadow">x</span>
                      )}
                    </button>
                  );
                })}
              </div>
              <p className="mt-2 text-xs text-gray-500">SKU: {selected?.sku}</p>
            </div>
          )}

          <p className={`text-sm font-medium ${outOfStock ? 'text-red-600' : 'text-green-700'}`}>
            {outOfStock
              ? 'Out of stock'
              : hasVariants
                ? `In stock (${variantStock} available)`
                : productStock != null
                  ? `In stock (${productStock} available)`
                  : 'In stock'}
          </p>

          <button
            disabled={outOfStock}
            onClick={handleAddToCart}
            className={`w-full rounded-lg px-8 py-4 text-base font-semibold transition ${
              outOfStock
                ? 'cursor-not-allowed bg-gray-300 text-gray-500'
                : 'bg-purple-700 text-white hover:bg-purple-800'
            }`}
          >
            {outOfStock ? 'Out of Stock' : addedToCart ? 'Added to Cart' : 'Add to Cart'}
          </button>

          {addedToCart && (
            <p className="rounded border border-green-200 bg-green-50 p-3 text-sm text-green-700">
              Added to your cart.
            </p>
          )}
        </div>
      </section>
    </section>
  );
}

function parseVariantColor(value: string) {
  const [label = value, topColor = value, bottomColor = ''] = value.split('|').map((part) => part.trim());
  return {
    label: label || value,
    topColor: /^#[0-9a-f]{6}$/i.test(topColor) ? topColor : value,
    bottomColor: /^#[0-9a-f]{6}$/i.test(bottomColor) ? bottomColor : '',
  };
}

function variantSwatchBackground(value: string) {
  const swatch = parseVariantColor(value);
  return swatch.bottomColor
    ? `linear-gradient(to bottom, ${swatch.topColor} 0 50%, ${swatch.bottomColor} 50% 100%)`
    : swatch.topColor;
}

