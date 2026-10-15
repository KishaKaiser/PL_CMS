'use client';

import { useEffect, useState } from 'react';

/** The advisor's own public profile link, with a copy button, shown in their dashboard. */
export function AdvisorPublicLink({ slug }: { slug: string | null }) {
  const [origin, setOrigin] = useState('');
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    setOrigin(window.location.origin);
  }, []);

  if (!slug) return null;

  const path = `/advisors/${slug}`;
  const url = `${origin}${path}`;

  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard access can be blocked; the link is still selectable in the box.
    }
  }

  return (
    <div className="max-w-2xl rounded-2xl bg-purple-50 p-5">
      <h3 className="font-semibold text-gray-950">Your public profile</h3>
      <p className="mt-1 text-sm text-gray-600">
        Clients see your photo, description, rate, weekly hours, and reviews here, and can call you or schedule a call. You appear
        on the readings page only while you are online, so share this link to let clients book you any time.
      </p>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <input
          readOnly
          value={url}
          onFocus={(event) => event.currentTarget.select()}
          className="min-w-0 flex-1 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm"
          aria-label="Your public profile link"
        />
        <button type="button" onClick={() => void copy()} className="rounded-lg border border-purple-500 px-4 py-2 text-sm font-semibold text-purple-700 hover:bg-purple-100">
          {copied ? 'Copied' : 'Copy link'}
        </button>
        <a href={path} target="_blank" rel="noopener" className="rounded-lg bg-purple-700 px-4 py-2 text-sm font-semibold text-white hover:bg-purple-800">
          View
        </a>
      </div>
    </div>
  );
}
