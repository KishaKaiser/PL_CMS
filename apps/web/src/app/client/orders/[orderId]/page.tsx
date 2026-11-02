import { redirect } from 'next/navigation';

/** Tracking now lives on its own page, found by order number; links to the old address (with the long order id) still work. */
export default async function OrderTrackingRedirect({ params }: { params: Promise<{ orderId: string }> }) {
  const { orderId } = await params;
  redirect(`/track-order?order=${encodeURIComponent(orderId)}`);
}
