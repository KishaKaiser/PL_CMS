'use client';

import type { Dispatch, SetStateAction } from 'react';
import { Suspense, useEffect, useState, useCallback, useRef } from 'react';
import { useSearchParams } from 'next/navigation';
import Script from 'next/script';
import { getCart, clearCart, CartItem as StoredCartItem } from '../../../lib/cart';

declare global {
  interface Window {
    paypal?: PayPalNamespace;
    google?: GooglePayNamespace;
    ApplePaySession?: {
      new (version: number, request: Record<string, unknown>): {
        begin: () => void;
        onvalidatemerchant: ((event: { validationURL: string }) => void) | null;
        onpaymentauthorized: ((event: { payment: { token: unknown } }) => void) | null;
        completeMerchantValidation: (merchantSession: unknown) => void;
        completePayment: (status: number) => void;
      };
      canMakePayments: () => boolean;
      STATUS_SUCCESS: number;
      STATUS_FAILURE: number;
    };
  }
}

interface PayPalButtonConfig {
  fundingSource?: string;
  createOrder: () => Promise<string>;
  onApprove: (data: { orderID: string }) => Promise<void>;
  onError: (err: unknown) => void;
}

interface PayPalButton {
  isEligible?: () => boolean;
  render: (selector: string) => Promise<void> | void;
}

interface PayPalNamespace {
  Buttons: (config: PayPalButtonConfig) => PayPalButton;
  FUNDING?: {
    PAYPAL?: string;
    VENMO?: string;
    CARD?: string;
    PAYLATER?: string;
    CREDIT?: string;
  };
  Applepay?: () => {
    config: () => Promise<{
      isEligible: boolean;
      countryCode: string;
      currencyCode: string;
      merchantCapabilities: string[];
      supportedNetworks: string[];
    }>;
    validateMerchant: (event: { validationUrl: string; displayName?: string }) => Promise<{ merchantSession?: unknown }>;
    confirmOrder: (payload: { orderId: string; token: unknown }) => Promise<void>;
  };
  Googlepay?: () => {
    config: () => Promise<{
      isEligible: boolean;
      allowedPaymentMethods: unknown[];
      merchantInfo: Record<string, unknown>;
      apiVersion: number;
      apiVersionMinor: number;
    }>;
    confirmOrder: (payload: { orderId: string; paymentMethodData: unknown }) => Promise<{ status: string }>;
  };
}

interface GooglePayNamespace {
  payments?: {
    api?: {
      PaymentsClient: new (config: { environment: 'TEST' | 'PRODUCTION' }) => {
        isReadyToPay: (request: Record<string, unknown>) => Promise<{ result: boolean }>;
        createButton: (config: { onClick: () => void; buttonType?: string; buttonColor?: string }) => HTMLElement;
        loadPaymentData: (request: Record<string, unknown>) => Promise<{ paymentMethodData?: unknown }>;
      };
    };
  };
}

interface CartItem {
  product: {
    id: string;
    name: string;
    price: number;
    currency: string;
    minutesPack: number;
    type?: 'PHYSICAL' | 'DIGITAL' | 'MINUTE_PACK';
    digitalDelivery?: 'NONE' | 'ASTROLOGY_REPORT';
  };
  variantId?: string;
  variantColor?: string;
  quantity: number;
}

interface ShippingAddress {
  fullName: string;
  phone: string;
  line1: string;
  line2?: string;
  addressType?: 'commercial' | 'residential';
  city: string;
  state: string;
  postalCode: string;
  country: string;
  email: string;
}

interface ShippingRate {
  serviceName: string;
  serviceCode: string;
  carrierCode: string;
  shipmentCost: number;
  otherCost: number;
}

interface CouponValidation {
  valid: boolean;
  code: string;
  discountAmount: number;
  message: string;
}

interface FreeShippingSettings {
  enabled: boolean;
  minimumSubtotal: number;
  label: string;
}

interface AstrologyForm {
  productId: string;
  fullName: string;
  birthDate: string;
  birthTime: string;
  birthCity: string;
  birthState: string;
  birthCountry: string;
  timezone: string;
  notes: string;
}

interface EcommerceSettings {
  currency: string;
  taxEnabled: boolean;
  taxRatePercent: number;
  pricesIncludeTax: boolean;
  termsPageUrl: string;
  manualShippingEnabled?: boolean;
  manualShippingAmount?: number;
  manualShippingLabel?: string;
}

const emptyAddress: ShippingAddress = {
  fullName: '',
  phone: '',
  line1: '',
  line2: '',
  addressType: 'residential',
  city: '',
  state: '',
  postalCode: '',
  country: 'US',
  email: '',
};

/** Convert a stored cart item to the checkout CartItem shape */
function storedToCartItem(s: StoredCartItem): CartItem {
  return {
    product: {
      id: s.productId,
      name: s.productName,
      price: s.variantPrice ?? s.productPrice,
      currency: s.currency,
      minutesPack: 0,
      type: s.productType,
      digitalDelivery: s.digitalDelivery,
    },
    variantId: s.variantId,
    variantColor: s.variantColor,
    quantity: s.quantity,
  };
}

function createVirtualRate(): ShippingRate {
  return {
    carrierCode: 'virtual',
    serviceCode: 'digital_delivery',
    serviceName: 'Digital delivery',
    shipmentCost: 0,
    otherCost: 0,
  };
}

function getEffectiveShippingCost(rate: ShippingRate, subtotal: number, freeShipping: FreeShippingSettings) {
  if (freeShipping.enabled && subtotal >= Number(freeShipping.minimumSubtotal ?? 0)) return 0;
  return rate.shipmentCost + rate.otherCost;
}

function createFreeShippingRate(label: string): ShippingRate {
  return {
    carrierCode: 'free_shipping',
    serviceCode: 'free_shipping',
    serviceName: label || 'Free shipping',
    shipmentCost: 0,
    otherCost: 0,
  };
}

function createManualShippingRate(settings: EcommerceSettings): ShippingRate | null {
  if (!settings.manualShippingEnabled) return null;
  return {
    carrierCode: 'manual',
    serviceCode: 'manual_shipping',
    serviceName: settings.manualShippingLabel || 'Standard shipping',
    shipmentCost: Number(settings.manualShippingAmount ?? 0),
    otherCost: 0,
  };
}

function formatLiveRateFailureMessage(message?: string, fallbackLabel = 'manual fallback shipping') {
  const detail = message?.trim() || 'ShipStation did not return live rates for this address.';
  return `${detail} Showing ${fallbackLabel}. Admins can run Admin → Settings → Shipping → Test Live ShipStation Quote for carrier details.`;
}

const defaultEcommerceSettings: EcommerceSettings = {
  currency: 'USD',
  taxEnabled: false,
  taxRatePercent: 0,
  pricesIncludeTax: false,
  termsPageUrl: '/terms',
  manualShippingEnabled: false,
  manualShippingAmount: 8.95,
  manualShippingLabel: 'Standard shipping',
};

const paypalFundingButtons = [
  { key: 'paypal', label: 'PayPal', fundingKey: 'PAYPAL' },
  { key: 'card', label: 'Debit or credit card', fundingKey: 'CARD' },
  { key: 'venmo', label: 'Venmo', fundingKey: 'VENMO' },
  { key: 'paylater', label: 'Pay Later', fundingKey: 'PAYLATER' },
] as const;

function createPaypalSdkUrl(clientId: string) {
  const params = new URLSearchParams({
    'client-id': clientId,
    currency: 'USD',
    intent: 'capture',
    components: 'buttons,applepay,googlepay',
    'enable-funding': 'venmo,paylater,card,credit',
  });
  return `https://www.paypal.com/sdk/js?${params.toString()}`;
}

function clearPaymentButtonContainers() {
  [
    'paypal-button-paypal',
    'paypal-button-card',
    'paypal-button-venmo',
    'paypal-button-paylater',
    'paypal-apple-pay-container',
    'paypal-google-pay-container',
  ].forEach((id) => {
    const container = document.getElementById(id);
    if (container) container.replaceChildren();
  });
}

function CheckoutContent() {
  const searchParams = useSearchParams();
  const productId = searchParams.get('productId');
  const variantId = searchParams.get('variantId');
  const successParam = searchParams.get('success');
  const cancelledParam = searchParams.get('cancelled');

  const [cart, setCart] = useState<CartItem[]>([]);
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [message, setMessage] = useState('');
  const [paypalLoaded, setPaypalLoaded] = useState(false);
  const [paypalClientId, setPaypalClientId] = useState('');
  const [paypalEnvironment, setPaypalEnvironment] = useState<'sandbox' | 'live'>('sandbox');
  const [paypalRendered, setPaypalRendered] = useState(false);
  const [googlePayLoaded, setGooglePayLoaded] = useState(false);
  const renderedWallets = useRef(new Set<string>());

  // Shipping state
  const [shippingAddress, setShippingAddress] = useState<ShippingAddress>(emptyAddress);
  const [addressSubmitted, setAddressSubmitted] = useState(false);
  const [shippingRates, setShippingRates] = useState<ShippingRate[]>([]);
  const [selectedRate, setSelectedRate] = useState<ShippingRate | null>(null);
  const [ratesLoading, setRatesLoading] = useState(false);
  const [ratesError, setRatesError] = useState('');
  const [couponCode, setCouponCode] = useState('');
  const [coupon, setCoupon] = useState<CouponValidation | null>(null);
  const [couponMessage, setCouponMessage] = useState('');
  const [freeShipping, setFreeShipping] = useState<FreeShippingSettings>({ enabled: false, minimumSubtotal: 0, label: 'Free shipping' });
  const [ecommerce, setEcommerce] = useState<EcommerceSettings>(defaultEcommerceSettings);
  const [astrologyForms, setAstrologyForms] = useState<Record<string, AstrologyForm>>({});

  // Load cart: from localStorage first, then fall back to URL params
  useEffect(() => {
    const stored = getCart();
    if (stored.length > 0) {
      setCart(stored.map(storedToCartItem));
      return;
    }

    if (!productId) return;
    fetch(`/api/proxy/products/${productId}`)
      .then((r) => r.json())
      .then((p: { id: string; name: string; price: number; currency: string; minutesPack: number; variants?: Array<{ id: string; color: string; priceOverride?: number | null }> }) => {
        const variant = variantId
          ? p.variants?.find((v) => v.id === variantId)
          : undefined;
        const effectivePrice = variant?.priceOverride ?? p.price;
        setCart([{
          product: { ...p, price: Number(effectivePrice) },
          variantId: variant?.id,
          variantColor: variant?.color,
          quantity: 1,
        }]);
      })
      .catch(() => setMessage('Failed to load product.'));
  }, [productId, variantId]);

  // Fetch PayPal client ID
  useEffect(() => {
    fetch('/api/proxy/payments/paypal-client-id')
      .then((r) => r.json())
      .then((data: { clientId?: string; environment?: 'sandbox' | 'live' }) => {
        if (data.clientId) setPaypalClientId(data.clientId);
        if (data.environment === 'live' || data.environment === 'sandbox') setPaypalEnvironment(data.environment);
      })
      .catch(() => {
        // Silently fail; user will see "not configured" message
      });
  }, []);

  useEffect(() => {
    Promise.all([
      fetch('/api/proxy/store/free-shipping'),
      fetch('/api/proxy/store/ecommerce'),
    ])
      .then(async ([freeRes, ecommerceRes]) => {
        if (freeRes.ok) setFreeShipping((await freeRes.json()) as FreeShippingSettings);
        if (ecommerceRes.ok) setEcommerce({ ...defaultEcommerceSettings, ...((await ecommerceRes.json()) as Partial<EcommerceSettings>) });
      })
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    if (cart.length === 0) return;
    const subtotal = cart.reduce((sum, item) => sum + Number(item.product.price) * item.quantity, 0);
    if (!Number.isFinite(subtotal)) return;
    void fetch('/api/proxy/store/cart-recovery/track', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: shippingAddress.email || undefined,
        subtotal,
        items: cart,
      }),
    }).catch(() => undefined);
  }, [cart, shippingAddress.email]);

  const itemsTotal = cart.reduce(
    (sum, item) => sum + Number(item.product.price) * item.quantity,
    0,
  );
  const shippingCost = selectedRate
    ? getEffectiveShippingCost(selectedRate, itemsTotal, freeShipping)
    : 0;
  const discountAmount = coupon?.valid ? coupon.discountAmount : 0;
  const taxableSubtotal = Math.max(0, itemsTotal - discountAmount);
  const taxAmount = ecommerce.taxEnabled && !ecommerce.pricesIncludeTax ? taxableSubtotal * (Number(ecommerce.taxRatePercent) / 100) : 0;
  const grandTotal = Math.max(0, taxableSubtotal + taxAmount + shippingCost);
  const astrologyItems = cart.filter((item) => item.product.digitalDelivery === 'ASTROLOGY_REPORT');
  const requiresShipping = cart.some((item) => item.product.type === 'PHYSICAL' || !item.product.type);
  const canPay = requiresShipping ? Boolean(selectedRate) : astrologyItems.every((item) => isAstrologyFormComplete(astrologyForms[item.product.id]));

  useEffect(() => {
    if (!requiresShipping && cart.length > 0 && !selectedRate) {
      setSelectedRate(createVirtualRate());
      setAddressSubmitted(true);
    }
  }, [cart.length, requiresShipping, selectedRate]);

  const applyCoupon = async (event: React.FormEvent) => {
    event.preventDefault();
    setCouponMessage('');
    setCoupon(null);
    if (!couponCode.trim()) return;
    try {
      const res = await fetch('/api/proxy/store/coupons/validate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: couponCode, subtotal: itemsTotal }),
      });
      const data = (await res.json()) as CouponValidation;
      setCouponMessage(data.message);
      if (data.valid) setCoupon(data);
      setPaypalRendered(false);
    } catch {
      setCouponMessage('Could not apply coupon.');
    }
  };

  const handleAddressSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setRatesError('');
    setRatesLoading(true);
    setShippingRates([]);
    setSelectedRate(null);
    setPaypalRendered(false);
    try {
      const res = await fetch('/api/proxy/shipping/quote', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          address: shippingAddress,
          items: cart.map((item) => ({
            productId: item.product.id,
            quantity: item.quantity,
          })),
        }),
      });
      if (!res.ok) {
        const err = await readErrorResponse(res);
        if (freeShipping.enabled && itemsTotal >= Number(freeShipping.minimumSubtotal ?? 0)) {
          const freeRate = createFreeShippingRate(freeShipping.label);
          setShippingRates([freeRate]);
          setSelectedRate(freeRate);
          setAddressSubmitted(true);
          return;
        }
        const manualRate = createManualShippingRate(ecommerce);
        if (manualRate) {
          setShippingRates([manualRate]);
          setSelectedRate(manualRate);
          setAddressSubmitted(true);
          setRatesError(formatLiveRateFailureMessage(err.message));
          return;
        }
        throw new Error(err.message ?? 'Failed to get shipping rates');
      }
      const rates = (await res.json()) as ShippingRate[];
      if (rates.length === 0) {
        if (freeShipping.enabled && itemsTotal >= Number(freeShipping.minimumSubtotal ?? 0)) {
          const freeRate = createFreeShippingRate(freeShipping.label);
          setShippingRates([freeRate]);
          setSelectedRate(freeRate);
          setAddressSubmitted(true);
        } else if (createManualShippingRate(ecommerce)) {
          const manualRate = createManualShippingRate(ecommerce)!;
          setShippingRates([manualRate]);
          setSelectedRate(manualRate);
          setAddressSubmitted(true);
          setRatesError(formatLiveRateFailureMessage('ShipStation returned no live rates for this address.'));
        } else {
          setRatesError('ShipStation returned no live rates for this address. Enable manual shipping fallback in Admin → Store Settings, or run Admin → Settings → Shipping → Test Live ShipStation Quote to review carrier details.');
        }
      } else {
        setShippingRates(rates);
        setAddressSubmitted(true);
      }
    } catch (err: unknown) {
      setRatesError(err instanceof Error ? err.message : 'Failed to fetch shipping rates');
    } finally {
      setRatesLoading(false);
    }
  };

  const createPaypalOrder = useCallback(async () => {
    setStatus('loading');
    const res = await fetch('/api/proxy/checkout/paypal-order', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        items: cart.map((item) => ({
          productId: item.product.id,
          variantId: item.variantId,
          quantity: item.quantity,
        })),
        shippingAddress,
        shippingCarrier: selectedRate?.carrierCode,
        shippingService: selectedRate?.serviceCode,
        shippingAmount: shippingCost,
        couponCode: coupon?.valid ? coupon.code : undefined,
        astrologyForms: astrologyItems.map((item) => astrologyForms[item.product.id]).filter(Boolean),
      }),
    });
    if (!res.ok) {
      const err = (await res.json().catch(() => ({}))) as { message?: string };
      setStatus('error');
      setMessage(err.message ?? 'Failed to create order');
      throw new Error(err.message ?? 'Failed to create order');
    }
    const data = (await res.json()) as { paypalOrderId: string };
    return data.paypalOrderId;
  }, [astrologyForms, astrologyItems, cart, coupon, selectedRate, shippingAddress, shippingCost]);

  const capturePaypalOrder = useCallback(async (paypalOrderId: string) => {
    const res = await fetch(
      `/api/proxy/checkout/paypal-capture/${paypalOrderId}`,
      { method: 'POST' },
    );
    if (!res.ok) {
      setStatus('error');
      setMessage('Payment capture failed. Please contact support.');
      return;
    }
    clearCart();
    setStatus('success');
    setMessage('Payment successful! Your order has been confirmed.');
    setCart([]);
  }, []);

  const handlePaypalError = useCallback((err: unknown) => {
    setStatus('error');
    setMessage((currentMessage) => currentMessage || 'PayPal encountered an error. Check that the saved PayPal client ID, secret, and environment match your PayPal account.');
    console.error('PayPal error:', err);
  }, []);

  const renderPaypalButtons = useCallback(() => {
    if (!window.paypal || cart.length === 0 || paypalRendered || !selectedRate || !canPay) return;

    setPaypalRendered(true);
    const paypal = window.paypal;
    const renderButtons = async () => {
      let renderedAnyButton = false;
      for (const option of paypalFundingButtons) {
        const fundingSource = paypal.FUNDING?.[option.fundingKey];
        if (!fundingSource || renderedWallets.current.has(option.key)) continue;
        renderedWallets.current.add(option.key);
        const button = paypal.Buttons({
          fundingSource,
          createOrder: createPaypalOrder,
          onApprove: async (data) => capturePaypalOrder(data.orderID),
          onError: handlePaypalError,
        });
        if (button.isEligible && !button.isEligible()) continue;
        try {
          await Promise.resolve(button.render(`#paypal-button-${option.key}`));
          renderedAnyButton = true;
        } catch (err) {
          renderedWallets.current.delete(option.key);
          console.warn(`${option.label} button could not render`, err);
        }
      }
      if (!renderedAnyButton) {
        setStatus('error');
        setMessage('No PayPal payment methods are available for this browser or account.');
      }
    };
    void renderButtons();
  }, [canPay, capturePaypalOrder, cart.length, createPaypalOrder, handlePaypalError, paypalRendered, selectedRate]);

  const renderApplePay = useCallback(() => {
    const paypal = window.paypal;
    const ApplePaySession = window.ApplePaySession;
    const container = document.getElementById('paypal-apple-pay-container');
    if (!paypal?.Applepay || !ApplePaySession?.canMakePayments() || !container || container.childElementCount > 0 || renderedWallets.current.has('applepay') || !selectedRate || !canPay) return;

    renderedWallets.current.add('applepay');
    const applePay = paypal.Applepay();
    void applePay.config().then((config) => {
      if (!config.isEligible) {
        renderedWallets.current.delete('applepay');
        return;
      }
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'w-full rounded-lg bg-black px-4 py-3 text-sm font-semibold text-white hover:bg-gray-900';
      button.textContent = 'Pay with Apple Pay';
      button.onclick = async () => {
        try {
          const orderId = await createPaypalOrder();
          const session = new ApplePaySession(4, {
            countryCode: config.countryCode,
            currencyCode: config.currencyCode,
            merchantCapabilities: config.merchantCapabilities,
            supportedNetworks: config.supportedNetworks,
            total: { label: 'The Psychic Link', amount: grandTotal.toFixed(2), type: 'final' },
          });
          session.onvalidatemerchant = async (event) => {
            const validation = await applePay.validateMerchant({
              validationUrl: event.validationURL,
              displayName: 'The Psychic Link',
            });
            session.completeMerchantValidation(validation.merchantSession ?? validation);
          };
          session.onpaymentauthorized = async (event) => {
            try {
              await applePay.confirmOrder({ orderId, token: event.payment.token });
              await capturePaypalOrder(orderId);
              session.completePayment(ApplePaySession.STATUS_SUCCESS);
            } catch (err) {
              handlePaypalError(err);
              session.completePayment(ApplePaySession.STATUS_FAILURE);
            }
          };
          session.begin();
        } catch (err) {
          handlePaypalError(err);
        }
      };
      container.appendChild(button);
    }).catch((err) => {
      renderedWallets.current.delete('applepay');
      console.warn('Apple Pay is not available', err);
    });
  }, [canPay, capturePaypalOrder, createPaypalOrder, grandTotal, handlePaypalError, selectedRate]);

  const renderGooglePay = useCallback(() => {
    const paypal = window.paypal;
    const googlePay = window.google?.payments?.api;
    const container = document.getElementById('paypal-google-pay-container');
    if (!paypal?.Googlepay || !googlePay || !container || container.childElementCount > 0 || renderedWallets.current.has('googlepay') || !selectedRate || !canPay) return;

    renderedWallets.current.add('googlepay');
    const paymentsClient = new googlePay.PaymentsClient({ environment: paypalEnvironment === 'live' ? 'PRODUCTION' : 'TEST' });
    const paypalGooglePay = paypal.Googlepay();
    void paypalGooglePay.config().then(async (config) => {
      if (!config.isEligible) {
        renderedWallets.current.delete('googlepay');
        return;
      }
      const ready = await paymentsClient.isReadyToPay({
        apiVersion: config.apiVersion,
        apiVersionMinor: config.apiVersionMinor,
        allowedPaymentMethods: config.allowedPaymentMethods,
      });
      if (!ready.result) {
        renderedWallets.current.delete('googlepay');
        return;
      }
      const button = paymentsClient.createButton({
        buttonType: 'pay',
        buttonColor: 'black',
        onClick: async () => {
          try {
            const orderId = await createPaypalOrder();
            const paymentData = await paymentsClient.loadPaymentData({
              apiVersion: config.apiVersion,
              apiVersionMinor: config.apiVersionMinor,
              allowedPaymentMethods: config.allowedPaymentMethods,
              merchantInfo: config.merchantInfo,
              transactionInfo: {
                countryCode: 'US',
                currencyCode: ecommerce.currency || 'USD',
                totalPriceStatus: 'FINAL',
                totalPrice: grandTotal.toFixed(2),
              },
            });
            await paypalGooglePay.confirmOrder({ orderId, paymentMethodData: paymentData.paymentMethodData });
            await capturePaypalOrder(orderId);
          } catch (err) {
            handlePaypalError(err);
          }
        },
      });
      container.appendChild(button);
    }).catch((err) => {
      renderedWallets.current.delete('googlepay');
      console.warn('Google Pay is not available', err);
    });
  }, [canPay, capturePaypalOrder, createPaypalOrder, ecommerce.currency, grandTotal, handlePaypalError, paypalEnvironment, selectedRate]);

  useEffect(() => {
    if (paypalLoaded && cart.length > 0 && selectedRate && canPay) {
      renderPaypalButtons();
      renderApplePay();
      if (googlePayLoaded) renderGooglePay();
    }
  }, [paypalLoaded, googlePayLoaded, canPay, cart, selectedRate, renderPaypalButtons, renderApplePay, renderGooglePay]);

  useEffect(() => {
    if (!paypalRendered) {
      renderedWallets.current.clear();
      clearPaymentButtonContainers();
    }
  }, [paypalRendered]);

  if (successParam) {
    return (
      <div className="rounded-lg border border-green-200 bg-green-50 p-8 text-center">
        <h1 className="mb-3 text-2xl font-bold text-green-700">Payment Successful!</h1>
        <p className="text-gray-600">Your order has been confirmed. Enjoy your minutes!</p>
        <a href="/client" className="mt-6 inline-block text-purple-600 hover:underline">
          Go to Client Portal →
        </a>
      </div>
    );
  }

  if (cancelledParam) {
    return (
      <div className="rounded-lg border border-yellow-200 bg-yellow-50 p-8 text-center">
        <h1 className="mb-3 text-2xl font-bold text-yellow-700">Payment Cancelled</h1>
        <p className="text-gray-600">Your payment was cancelled. No charges were made.</p>
        <a href="/shop" className="mt-6 inline-block text-purple-600 hover:underline">
          ← Back to Shop
        </a>
      </div>
    );
  }

  return (
    <>
      {paypalClientId && (
        <Script
          src={createPaypalSdkUrl(paypalClientId)}
          onLoad={() => setPaypalLoaded(true)}
          onError={() => {
            setStatus('error');
            setMessage('PayPal checkout could not load. Check the PayPal client ID and browser connection.');
          }}
        />
      )}
      {paypalClientId && (
        <Script
          src="https://applepay.cdn-apple.com/jsapi/1.latest/apple-pay-sdk.js"
        />
      )}
      {paypalClientId && (
        <Script
          src="https://pay.google.com/gp/p/js/pay.js"
          onLoad={() => setGooglePayLoaded(true)}
        />
      )}

      <header className="mb-8 rounded-2xl border bg-white p-6 shadow-sm">
        <p className="text-sm font-semibold uppercase tracking-wide text-purple-700">Secure checkout</p>
        <h1 className="mt-2 text-4xl font-bold text-gray-950">Checkout</h1>
        <p className="mt-2 max-w-2xl text-gray-600">
          Review your order, enter shipping details, and complete payment.
        </p>
      </header>

      {status === 'success' && (
        <div className="mb-6 rounded-xl border border-green-200 bg-green-50 p-4 text-green-700">
          {message}
        </div>
      )}
      {status === 'error' && (
        <div className="mb-6 rounded-xl border border-red-200 bg-red-50 p-4 text-red-700">
          {message}
        </div>
      )}

      {cart.length === 0 && status !== 'success' ? (
        <div className="rounded-2xl border bg-white p-8 shadow-sm">
          <p className="text-gray-500">Your cart is empty.</p>
          <a href="/shop" className="mt-4 inline-block text-purple-600 hover:underline">
            ← Browse Shop
          </a>
        </div>
      ) : (
        <>
          {/* Order summary */}
          <div className="mb-6 rounded-2xl border bg-white p-6 shadow-sm">
            <h2 className="mb-4 text-lg font-semibold">Order Summary</h2>
            {cart.map((item) => (
              <div key={`${item.product.id}-${item.variantId ?? ''}`} className="flex justify-between py-2 text-sm">
                <span>
                  {item.product.name}
                  {item.variantColor && (
                    <span className="ml-1 text-gray-500">({item.variantColor})</span>
                  )}{' '}
                  <span className="text-gray-400">× {item.quantity}</span>
                </span>
                <span className="font-medium">
                  ${(Number(item.product.price) * item.quantity).toFixed(2)}
                </span>
              </div>
            ))}
            {selectedRate && (
              <div className="flex justify-between py-2 text-sm text-gray-600">
                <span>Shipping ({selectedRate.serviceName})</span>
                <span>${shippingCost.toFixed(2)}</span>
              </div>
            )}
            {coupon?.valid && (
              <div className="flex justify-between py-2 text-sm text-emerald-700">
                <span>Coupon ({coupon.code})</span>
                <span>-${discountAmount.toFixed(2)}</span>
              </div>
            )}
            {ecommerce.taxEnabled && (
              <div className="flex justify-between py-2 text-sm text-gray-600">
                <span>Tax{ecommerce.pricesIncludeTax ? ' included' : ` (${Number(ecommerce.taxRatePercent).toFixed(2)}%)`}</span>
                <span>{ecommerce.pricesIncludeTax ? 'Included' : `$${taxAmount.toFixed(2)}`}</span>
              </div>
            )}
            <div className="mt-4 flex justify-between border-t pt-4 text-lg font-bold">
              <span>Total</span>
              <span>${grandTotal.toFixed(2)} {ecommerce.currency || 'USD'}</span>
            </div>
            <form onSubmit={applyCoupon} className="mt-5 flex gap-2">
              <input value={couponCode} onChange={(event) => setCouponCode(event.target.value)} placeholder="Coupon code" className="flex-1 rounded-lg border px-3 py-2 text-sm" />
              <button type="submit" className="rounded-lg border border-purple-200 px-4 py-2 text-sm font-medium text-purple-700 hover:bg-purple-50">Apply</button>
            </form>
            {couponMessage && <p className={`mt-2 text-sm ${coupon?.valid ? 'text-emerald-700' : 'text-red-600'}`}>{couponMessage}</p>}
            {freeShipping.enabled && (
              <p className="mt-2 text-xs text-gray-500">
                {itemsTotal >= freeShipping.minimumSubtotal ? freeShipping.label : `Free shipping at $${freeShipping.minimumSubtotal.toFixed(2)} subtotal.`}
              </p>
            )}
          </div>

          {astrologyItems.length > 0 && (
            <div className="mb-6 rounded-2xl border bg-white p-6 shadow-sm">
              <h2 className="mb-4 text-lg font-semibold">Astrology Chart Details</h2>
              <p className="mb-4 text-sm text-gray-500">
                Enter the birth details for the astrology report. After payment, the report will appear in your dashboard Downloads menu.
              </p>
              <div className="space-y-6">
                {astrologyItems.map((item) => {
                  const value = astrologyForms[item.product.id] ?? createEmptyAstrologyForm(item.product.id);
                  return (
                    <div key={item.product.id} className="rounded-xl border border-purple-100 bg-purple-50/40 p-4">
                      <h3 className="mb-3 font-semibold text-gray-950">{item.product.name}</h3>
                      <div className="grid gap-4 md:grid-cols-2">
                        <CheckoutInput label="Full name" value={value.fullName} required onChange={(fullName) => updateAstrologyForm(setAstrologyForms, item.product.id, { fullName })} />
                        <CheckoutInput label="Birth date" type="date" value={value.birthDate} required onChange={(birthDate) => updateAstrologyForm(setAstrologyForms, item.product.id, { birthDate })} />
                        <CheckoutInput label="Birth time" type="time" value={value.birthTime} required onChange={(birthTime) => updateAstrologyForm(setAstrologyForms, item.product.id, { birthTime })} />
                        <CheckoutInput label="Birth city" value={value.birthCity} required onChange={(birthCity) => updateAstrologyForm(setAstrologyForms, item.product.id, { birthCity })} />
                        <CheckoutInput label="Birth state / province" value={value.birthState} required onChange={(birthState) => updateAstrologyForm(setAstrologyForms, item.product.id, { birthState })} />
                        <CheckoutInput label="Birth country" value={value.birthCountry} required onChange={(birthCountry) => updateAstrologyForm(setAstrologyForms, item.product.id, { birthCountry })} />
                        <CheckoutInput label="Timezone" value={value.timezone} onChange={(timezone) => updateAstrologyForm(setAstrologyForms, item.product.id, { timezone })} />
                        <CheckoutInput label="Notes" value={value.notes} onChange={(notes) => updateAstrologyForm(setAstrologyForms, item.product.id, { notes })} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Step 1: Shipping address form */}
          {requiresShipping && !addressSubmitted && (
            <div className="mb-6 rounded-2xl border bg-white p-6 shadow-sm">
              <h2 className="mb-4 text-lg font-semibold">1. Shipping Address</h2>
              {ratesError && (
                <div className="mb-4 rounded border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                  {ratesError}
                </div>
              )}
              <form onSubmit={handleAddressSubmit} className="grid gap-4 md:grid-cols-2">
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700">Full Name *</label>
                  <input required value={shippingAddress.fullName}
                    onChange={(e) => setShippingAddress({ ...shippingAddress, fullName: e.target.value })}
                    className="mt-1 w-full rounded-lg border px-3 py-2 text-sm" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Email *</label>
                  <input required type="email" value={shippingAddress.email}
                    onChange={(e) => setShippingAddress({ ...shippingAddress, email: e.target.value })}
                    className="mt-1 w-full rounded-lg border px-3 py-2 text-sm" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Phone *</label>
                  <input required value={shippingAddress.phone}
                    onChange={(e) => setShippingAddress({ ...shippingAddress, phone: e.target.value })}
                    className="mt-1 w-full rounded-lg border px-3 py-2 text-sm" />
                </div>
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700">Address Line 1 *</label>
                  <input required value={shippingAddress.line1}
                    onChange={(e) => setShippingAddress({ ...shippingAddress, line1: e.target.value })}
                    placeholder="Street address, P.O. box"
                    className="mt-1 w-full rounded-lg border px-3 py-2 text-sm" />
                </div>
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700">Address Line 2</label>
                  <input value={shippingAddress.line2}
                    onChange={(e) => setShippingAddress({ ...shippingAddress, line2: e.target.value })}
                    placeholder="Apartment, suite, unit, etc."
                    className="mt-1 w-full rounded-lg border px-3 py-2 text-sm" />
                </div>
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700">Address Type</label>
                  <select value={shippingAddress.addressType ?? 'residential'}
                    onChange={(e) => setShippingAddress({ ...shippingAddress, addressType: e.target.value as ShippingAddress['addressType'] })}
                    className="mt-1 w-full rounded-lg border px-3 py-2 text-sm">
                    <option value="commercial">Commercial</option>
                    <option value="residential">Residential</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">City *</label>
                  <input required value={shippingAddress.city}
                    onChange={(e) => setShippingAddress({ ...shippingAddress, city: e.target.value })}
                    className="mt-1 w-full rounded-lg border px-3 py-2 text-sm" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">State (2-letter) *</label>
                  <input required value={shippingAddress.state} maxLength={2}
                    onChange={(e) => setShippingAddress({ ...shippingAddress, state: e.target.value.toUpperCase() })}
                    placeholder="e.g. TX"
                    className="mt-1 w-full rounded-lg border px-3 py-2 text-sm" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">ZIP Code *</label>
                  <input required value={shippingAddress.postalCode}
                    onChange={(e) => setShippingAddress({ ...shippingAddress, postalCode: e.target.value })}
                    placeholder="e.g. 78701"
                    className="mt-1 w-full rounded-lg border px-3 py-2 text-sm" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Country *</label>
                  <select value={shippingAddress.country}
                    onChange={(e) => setShippingAddress({ ...shippingAddress, country: e.target.value })}
                    className="mt-1 w-full rounded-lg border px-3 py-2 text-sm">
                    <option value="US">United States</option>
                  </select>
                </div>
                <div className="md:col-span-2">
                  <button type="submit" disabled={ratesLoading}
                    className="rounded-lg bg-purple-700 px-6 py-3 text-sm font-semibold text-white hover:bg-purple-800 disabled:opacity-50">
                    {ratesLoading ? 'Getting rates…' : 'Get Shipping Rates →'}
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* Step 2: Select a shipping rate */}
          {requiresShipping && addressSubmitted && shippingRates.length > 0 && !selectedRate && (
            <div className="mb-6 rounded-2xl border bg-white p-6 shadow-sm">
              <h2 className="mb-4 text-lg font-semibold">2. Select Shipping Method</h2>
              <p className="mb-3 text-sm text-gray-500">
                Shipping to {shippingAddress.city}, {shippingAddress.state} {shippingAddress.postalCode}
                {' '}
                <button onClick={() => { setAddressSubmitted(false); setShippingRates([]); }}
                  className="text-purple-600 hover:underline">
                  (change)
                </button>
              </p>
              <div className="space-y-2">
                {shippingRates.map((rate) => {
                  const total = getEffectiveShippingCost(rate, itemsTotal, freeShipping);
                  return (
                    <button
                      key={`${rate.carrierCode}-${rate.serviceCode}`}
                      onClick={() => setSelectedRate(rate)}
                      className="flex w-full items-center justify-between rounded-xl border px-4 py-3 text-left text-sm hover:border-purple-400 hover:bg-purple-50"
                    >
                      <span className="font-medium">{rate.serviceName}</span>
                      <span className="font-semibold text-purple-700">${total.toFixed(2)}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Step 3: Payment */}
          {selectedRate && (
            <div className="mb-6 rounded-2xl border bg-white p-6 shadow-sm">
              <h2 className="mb-4 text-lg font-semibold">3. Payment</h2>
              {requiresShipping ? (
                <div className="mb-4 rounded bg-gray-50 p-3 text-sm">
                  <p className="text-gray-600">
                    <span className="font-medium">Shipping to:</span>{' '}
                    {shippingAddress.fullName}, {shippingAddress.line1}
                    {shippingAddress.line2 ? `, ${shippingAddress.line2}` : ''},{' '}
                    {shippingAddress.city}, {shippingAddress.state} {shippingAddress.postalCode}
                    {' '}
                    <button onClick={() => { setAddressSubmitted(false); setShippingRates([]); setSelectedRate(null); setPaypalRendered(false); }}
                      className="text-purple-600 hover:underline">
                      (change)
                    </button>
                  </p>
                  <p className="mt-1 text-gray-600">
                    <span className="font-medium">Shipping method:</span>{' '}
                    {selectedRate.serviceName} - ${shippingCost.toFixed(2)}
                    {' '}
                    <button onClick={() => { setSelectedRate(null); setPaypalRendered(false); }}
                      className="text-purple-600 hover:underline">
                      (change)
                    </button>
                  </p>
                </div>
              ) : (
                <div className="mb-4 rounded bg-purple-50 p-3 text-sm text-purple-800">
                  This is a virtual order. No shipping address is required.
                </div>
              )}

              {!paypalClientId ? (
                <div className="rounded border border-yellow-200 bg-yellow-50 p-4 text-sm text-yellow-800">
                  PayPal checkout is not configured. Add the PayPal client ID and secret in Admin Settings → API settings → Billing.
                </div>
              ) : !canPay ? (
                <div className="rounded border border-yellow-200 bg-yellow-50 p-4 text-sm text-yellow-800">
                  Complete the astrology chart details above to continue.
                </div>
              ) : (
                <div className="space-y-3">
                  <div id="paypal-button-paypal" className="min-h-12" />
                  <div id="paypal-button-card" className="min-h-12" />
                  <div id="paypal-button-venmo" className="min-h-12" />
                  <div id="paypal-button-paylater" className="min-h-12" />
                  <div id="paypal-apple-pay-container" />
                  <div id="paypal-google-pay-container" />
                  <p className="text-xs text-gray-500">
                    Apple Pay, Google Pay, and Venmo appear only when PayPal marks them eligible for this browser, device, and PayPal account.
                  </p>
                </div>
              )}
            </div>
          )}
        </>
      )}

      <div className="mt-8">
        <a href="/shop/cart" className="text-sm text-purple-600 hover:underline">
          ← Back to Cart
        </a>
      </div>
    </>
  );
}

export default function CheckoutPage() {
  return (
    <main className="mx-auto w-full max-w-7xl p-8">
      <Suspense fallback={<p className="text-gray-500">Loading checkout…</p>}>
        <CheckoutContent />
      </Suspense>
    </main>
  );
}

async function readErrorResponse(res: Response) {
  const contentType = res.headers.get('content-type') ?? '';
  if (contentType.includes('application/json')) {
    return (await res.json().catch(() => ({}))) as { message?: string };
  }
  const text = await res.text().catch(() => '');
  return { message: text || `Request failed with status ${res.status}` };
}

function createEmptyAstrologyForm(productId: string): AstrologyForm {
  return {
    productId,
    fullName: '',
    birthDate: '',
    birthTime: '',
    birthCity: '',
    birthState: '',
    birthCountry: 'United States',
    timezone: '',
    notes: '',
  };
}

function updateAstrologyForm(
  setForms: Dispatch<SetStateAction<Record<string, AstrologyForm>>>,
  productId: string,
  patch: Partial<AstrologyForm>,
) {
  setForms((current) => ({
    ...current,
    [productId]: {
      ...(current[productId] ?? createEmptyAstrologyForm(productId)),
      ...patch,
    },
  }));
}

function isAstrologyFormComplete(form: AstrologyForm | undefined) {
  return Boolean(
    form?.fullName.trim() &&
      form.birthDate &&
      form.birthTime &&
      form.birthCity.trim() &&
      form.birthState.trim() &&
      form.birthCountry.trim(),
  );
}

function CheckoutInput({
  label,
  value,
  onChange,
  required,
  type = 'text',
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  required?: boolean;
  type?: string;
}) {
  return (
    <label className="block text-sm font-medium text-gray-700">
      {label}{required ? ' *' : ''}
      <input
        type={type}
        value={value}
        required={required}
        onChange={(event) => onChange(event.target.value)}
        className="mt-1 w-full rounded-lg border px-3 py-2 text-sm"
      />
    </label>
  );
}

