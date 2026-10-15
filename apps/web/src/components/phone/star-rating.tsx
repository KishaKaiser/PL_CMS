/** Five stars with the first `value` (rounded to the nearest whole star) filled in. */
export function StarRating({ value, className = 'text-xl' }: { value: number; className?: string }) {
  const filled = Math.round(value);
  return (
    <span className={`inline-flex gap-0.5 ${className}`} role="img" aria-label={`${value} out of 5 stars`}>
      {[1, 2, 3, 4, 5].map((star) => (
        <span key={star} className={star <= filled ? 'text-amber-500' : 'text-gray-300'} aria-hidden="true">
          ★
        </span>
      ))}
    </span>
  );
}
