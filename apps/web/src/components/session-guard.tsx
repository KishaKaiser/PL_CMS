'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Keeps a signed-in person signed in while they are working, and asks before signing them out when they have gone quiet.
 *
 * The sign-in cookie only lasts 15 minutes, and nothing used to renew it, so anyone who stayed on a page (such as the page
 * editor) for a while was signed out in the background and found out only when a save failed. Now:
 *  - while the page is open the sign-in is renewed in the background, so it never runs out under you;
 *  - after IDLE_LIMIT_MS with no mouse, keyboard, scroll or touch activity (in any tab of this site) a pop-up asks whether to
 *    stay signed in; with no answer within WARNING_MS the person is signed out and taken to the sign-in page;
 *  - if the sign-in is lost anyway (for example it was ended elsewhere) a pop-up says so straight away, and lets them sign in
 *    again in a new tab without losing what is on this page.
 * It does nothing for a visitor who is not signed in.
 */

/** How long someone can go without touching the page before they are asked whether to stay signed in. */
const IDLE_LIMIT_MS = 60 * 60 * 1000;
/** How long they have to answer before they are signed out. */
const WARNING_MS = 2 * 60 * 1000;
/** How often the sign-in is renewed in the background (it lasts 15 minutes). */
const REFRESH_EVERY_MS = 8 * 60 * 1000;
/** How often to look again for a sign-in that was restored in another tab. */
const RECHECK_EVERY_MS = 10 * 1000;
const ACTIVITY_KEY = 'plcms:last-activity';
const ACTIVITY_EVENTS = ['mousemove', 'mousedown', 'keydown', 'scroll', 'touchstart', 'wheel'] as const;

type Phase = 'starting' | 'off' | 'on' | 'ended';
type RefreshResult = 'ok' | 'ended' | 'error';

async function refreshSession(): Promise<RefreshResult> {
  try {
    const res = await fetch('/api/auth/refresh', { method: 'POST' });
    if (res.ok) return 'ok';
    return res.status === 401 || res.status === 403 ? 'ended' : 'error';
  } catch {
    return 'error';
  }
}

function formatCountdown(seconds: number) {
  const minutes = Math.floor(seconds / 60);
  return `${minutes}:${String(seconds % 60).padStart(2, '0')}`;
}

export function SessionGuard() {
  const [phase, setPhase] = useState<Phase>('starting');
  const [secondsLeft, setSecondsLeft] = useState<number | null>(null);
  // The last activity is kept in local storage so activity in one tab counts for every tab; the ref is the fallback when
  // storage is blocked.
  const activityRef = useRef(Date.now());
  const lastRefreshRef = useRef(0);
  const refreshingRef = useRef(false);
  const leavingRef = useRef(false);

  const readActivity = useCallback(() => {
    try {
      const stored = Number(window.localStorage.getItem(ACTIVITY_KEY));
      if (Number.isFinite(stored) && stored > 0) return Math.max(stored, activityRef.current);
    } catch {
      // storage blocked: use this tab's own record
    }
    return activityRef.current;
  }, []);

  const writeActivity = useCallback((at: number) => {
    activityRef.current = at;
    try {
      window.localStorage.setItem(ACTIVITY_KEY, String(at));
    } catch {
      // storage blocked: this tab's own record is enough
    }
  }, []);

  const leave = useCallback(async () => {
    if (leavingRef.current) return;
    leavingRef.current = true;
    setPhase('off');
    await fetch('/api/auth/logout', { method: 'POST' }).catch(() => null);
    const here = `${window.location.pathname}${window.location.search}`;
    window.location.href = `/login?expired=1&next=${encodeURIComponent(here)}`;
  }, []);

  /** Renews the sign-in. Returns false when it has ended. */
  const renew = useCallback(async () => {
    if (refreshingRef.current) return true;
    refreshingRef.current = true;
    try {
      const result = await refreshSession();
      if (result === 'ok') {
        lastRefreshRef.current = Date.now();
        return true;
      }
      if (result === 'ended') {
        setPhase('ended');
        return false;
      }
      return true; // a network hiccup: try again on the next round
    } finally {
      refreshingRef.current = false;
    }
  }, []);

  // Find out whether anyone is signed in at all. A visitor who is not gets nothing from this component.
  useEffect(() => {
    let cancelled = false;
    let retry: ReturnType<typeof setTimeout> | undefined;
    const check = async () => {
      const result = await refreshSession();
      if (cancelled) return;
      if (result === 'ok') {
        lastRefreshRef.current = Date.now();
        writeActivity(Date.now());
        setPhase('on');
      } else if (result === 'ended') {
        setPhase('off');
      } else {
        retry = setTimeout(check, 30_000); // the server did not answer: ask again shortly
      }
    };
    void check();
    return () => {
      cancelled = true;
      if (retry) clearTimeout(retry);
    };
  }, [writeActivity]);

  // Count mouse, keyboard, scroll and touch as activity. Once the "stay signed in" question is up, only the button answers it.
  useEffect(() => {
    if (phase !== 'on') return;
    let lastWrite = 0;
    const onActivity = () => {
      const now = Date.now();
      if (now - lastWrite < 3000) return;
      if (now - readActivity() >= IDLE_LIMIT_MS) return;
      lastWrite = now;
      writeActivity(now);
    };
    for (const name of ACTIVITY_EVENTS) window.addEventListener(name, onActivity, { passive: true });
    return () => {
      for (const name of ACTIVITY_EVENTS) window.removeEventListener(name, onActivity);
    };
  }, [phase, readActivity, writeActivity]);

  // Every second: ask or sign out when idle, otherwise keep the sign-in renewed.
  useEffect(() => {
    if (phase !== 'on') return;
    const tick = () => {
      const now = Date.now();
      const idle = now - readActivity();
      if (idle >= IDLE_LIMIT_MS + WARNING_MS) {
        void leave();
        return;
      }
      setSecondsLeft(idle >= IDLE_LIMIT_MS ? Math.max(1, Math.ceil((IDLE_LIMIT_MS + WARNING_MS - idle) / 1000)) : null);
      if (now - lastRefreshRef.current >= REFRESH_EVERY_MS) void renew();
    };
    const onWake = () => {
      if (document.visibilityState !== 'visible') return;
      // A laptop that slept or a tab that was in the background may have missed renewals: renew right away.
      if (Date.now() - lastRefreshRef.current > 60_000) void renew();
      tick();
    };
    tick();
    const timer = setInterval(tick, 1000);
    document.addEventListener('visibilitychange', onWake);
    window.addEventListener('focus', onWake);
    return () => {
      clearInterval(timer);
      document.removeEventListener('visibilitychange', onWake);
      window.removeEventListener('focus', onWake);
    };
  }, [phase, readActivity, leave, renew]);

  // Once the sign-in has ended, notice when the person signs in again (in another tab) and carry on.
  useEffect(() => {
    if (phase !== 'ended') return;
    const recheck = async () => {
      if (document.visibilityState !== 'visible') return;
      if ((await refreshSession()) === 'ok') {
        lastRefreshRef.current = Date.now();
        writeActivity(Date.now());
        setPhase('on');
      }
    };
    const timer = setInterval(recheck, RECHECK_EVERY_MS);
    window.addEventListener('focus', recheck);
    return () => {
      clearInterval(timer);
      window.removeEventListener('focus', recheck);
    };
  }, [phase, writeActivity]);

  async function staySignedIn() {
    writeActivity(Date.now());
    setSecondsLeft(null);
    await renew();
  }

  if (phase === 'on' && secondsLeft !== null) {
    return (
      <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/60 p-4">
        <div role="alertdialog" aria-modal="true" aria-labelledby="session-guard-title" aria-describedby="session-guard-text" className="w-full max-w-md rounded-2xl bg-white p-6 text-center shadow-2xl">
          <h2 id="session-guard-title" className="text-xl font-bold text-gray-900">Are you still there?</h2>
          <p id="session-guard-text" className="mt-3 text-sm text-gray-600">
            You have been inactive for a while. For your security you will be signed out in{' '}
            <strong className="tabular-nums text-gray-900">{formatCountdown(secondsLeft)}</strong> unless you stay signed in.
          </p>
          <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:justify-center">
            <button type="button" autoFocus onClick={() => void staySignedIn()} className="rounded-lg bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700">
              Stay signed in
            </button>
            <button type="button" onClick={() => void leave()} className="rounded-lg border border-gray-300 px-5 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50">
              Sign out now
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (phase === 'ended') {
    const here = `${typeof window === 'undefined' ? '' : window.location.pathname}${typeof window === 'undefined' ? '' : window.location.search}`;
    return (
      <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/60 p-4">
        <div role="alertdialog" aria-modal="true" aria-labelledby="session-ended-title" aria-describedby="session-ended-text" className="w-full max-w-md rounded-2xl bg-white p-6 text-center shadow-2xl">
          <h2 id="session-ended-title" className="text-xl font-bold text-gray-900">You have been signed out</h2>
          <p id="session-ended-text" className="mt-3 text-sm text-gray-600">
            Your session has ended, so changes cannot be saved right now. What is on this page has not been lost. Sign in again in a
            new tab, then come back here and carry on. This page will notice when you are signed in again.
          </p>
          <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:justify-center">
            <a href="/login" target="_blank" rel="noopener" className="rounded-lg bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700">
              Sign in (opens a new tab)
            </a>
            <a href={`/login?next=${encodeURIComponent(here)}`} className="rounded-lg border border-gray-300 px-5 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50">
              Sign in on this page
            </a>
          </div>
        </div>
      </div>
    );
  }

  return null;
}
