'use client';

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { PDFDocumentProxy, RenderTask } from 'pdfjs-dist';

/**
 * Shows a PDF inside the page, page by page, the same way on phones and computers (a browser's own embedded PDF viewer is
 * unreliable on phones). Pages are drawn only while they are near the screen, so long documents stay light. The toolbar has
 * page buttons, zoom, download, open in a new tab and full screen.
 */

const PAGE_GAP = 12;
const SIDE_PADDING = 12;
const MIN_ZOOM = 0.5;
const MAX_ZOOM = 3;
const ZOOM_STEP = 0.25;

type PdfJs = typeof import('pdfjs-dist');
let pdfjsPromise: Promise<PdfJs> | null = null;

/** Loaded on first use only, so visitors to pages without a PDF never download it. The "legacy" build also runs on older phones. */
function loadPdfjs(): Promise<PdfJs> {
  if (!pdfjsPromise) {
    pdfjsPromise = import('pdfjs-dist/legacy/build/pdf.mjs').then((lib) => {
      lib.GlobalWorkerOptions.workerSrc = new URL('pdfjs-dist/legacy/build/pdf.worker.min.mjs', import.meta.url).toString();
      return lib as unknown as PdfJs;
    });
  }
  return pdfjsPromise;
}

function withQuery(url: string, query: string) {
  return `${url}${url.includes('?') ? '&' : '?'}${query}`;
}

interface PageSize {
  width: number;
  height: number;
}

function PdfPage({ doc, pageNumber, width, height, scroller }: { doc: PDFDocumentProxy; pageNumber: number; width: number; height: number; scroller: HTMLDivElement | null }) {
  const holderRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [near, setNear] = useState(pageNumber <= 2);

  // Only pages close to the visible area are drawn; the rest are emptied so a long document does not use a lot of memory.
  useEffect(() => {
    const holder = holderRef.current;
    if (!holder || !scroller || typeof IntersectionObserver === 'undefined') return;
    const observer = new IntersectionObserver((entries) => setNear(entries.some((entry) => entry.isIntersecting)), { root: scroller, rootMargin: '900px 0px' });
    observer.observe(holder);
    return () => observer.disconnect();
  }, [scroller]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    if (!near) {
      canvas.width = 0;
      canvas.height = 0;
      return;
    }
    let cancelled = false;
    let task: RenderTask | undefined;
    (async () => {
      const page = await doc.getPage(pageNumber);
      if (cancelled) return;
      const ratio = Math.min(window.devicePixelRatio || 1, 2);
      const natural = page.getViewport({ scale: 1 });
      const viewport = page.getViewport({ scale: (width / natural.width) * ratio });
      const context = canvas.getContext('2d');
      if (!context) return;
      canvas.width = Math.floor(viewport.width);
      canvas.height = Math.floor(viewport.height);
      task = page.render({ canvasContext: context, viewport });
      await task.promise;
    })().catch((error: unknown) => {
      if (!(error && typeof error === 'object' && 'name' in error && error.name === 'RenderingCancelledException')) console.error(error);
    });
    return () => {
      cancelled = true;
      task?.cancel();
    };
  }, [doc, pageNumber, width, near]);

  return (
    <div ref={holderRef} data-pdf-page={pageNumber} className="shrink-0 bg-white shadow" style={{ width, height }}>
      <canvas ref={canvasRef} aria-label={`Page ${pageNumber}`} style={{ width, height, display: 'block' }} />
    </div>
  );
}

export function PdfViewer({ src, title, height = 720, showDownload = true }: { src: string; title?: string; height?: number; showDownload?: boolean }) {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const [scroller, setScroller] = useState<HTMLDivElement | null>(null);
  const [doc, setDoc] = useState<PDFDocumentProxy | null>(null);
  const [sizes, setSizes] = useState<PageSize[]>([]);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [availableWidth, setAvailableWidth] = useState(0);
  const [zoom, setZoom] = useState(1);
  const [current, setCurrent] = useState(1);
  const [fullscreen, setFullscreen] = useState(false);
  // Known only in the browser (not when the page is first drawn on the server), so it is set after loading.
  const [canFullscreen, setCanFullscreen] = useState(false);
  const scrollRatioRef = useRef<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    let destroy: (() => void) | undefined;
    setStatus('loading');
    setDoc(null);
    setSizes([]);
    setCurrent(1);
    (async () => {
      const lib = await loadPdfjs();
      const task = lib.getDocument({ url: src });
      destroy = () => void task.destroy();
      const pdf = await task.promise;
      if (cancelled) return;
      const pageSizes = await Promise.all(
        Array.from({ length: pdf.numPages }, async (_, index) => {
          const viewport = (await pdf.getPage(index + 1)).getViewport({ scale: 1 });
          return { width: viewport.width, height: viewport.height };
        }),
      );
      if (cancelled) return;
      setDoc(pdf);
      setSizes(pageSizes);
      setStatus('ready');
    })().catch(() => {
      if (!cancelled) setStatus('error');
    });
    return () => {
      cancelled = true;
      destroy?.();
    };
  }, [src]);

  useEffect(() => {
    if (!scroller || typeof ResizeObserver === 'undefined') return;
    const measure = () => setAvailableWidth(scroller.clientWidth);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(scroller);
    return () => observer.disconnect();
  }, [scroller]);

  useEffect(() => {
    setCanFullscreen(document.fullscreenEnabled === true);
    const onChange = () => setFullscreen(document.fullscreenElement === wrapperRef.current);
    document.addEventListener('fullscreenchange', onChange);
    return () => document.removeEventListener('fullscreenchange', onChange);
  }, []);

  // Keep the reader at the same place in the document when the zoom changes.
  useLayoutEffect(() => {
    if (scroller && scrollRatioRef.current !== null) {
      scroller.scrollTop = scrollRatioRef.current * scroller.scrollHeight;
      scrollRatioRef.current = null;
    }
  }, [zoom, scroller]);

  const handleScroll = useCallback(() => {
    if (!scroller) return;
    const marker = scroller.scrollTop + scroller.clientHeight / 3;
    let page = 1;
    scroller.querySelectorAll<HTMLElement>('[data-pdf-page]').forEach((element) => {
      if (element.offsetTop <= marker) page = Number(element.dataset.pdfPage);
    });
    setCurrent(page);
  }, [scroller]);

  const goToPage = (page: number) => {
    if (!scroller) return;
    const target = scroller.querySelector<HTMLElement>(`[data-pdf-page="${page}"]`);
    if (target) scroller.scrollTo({ top: target.offsetTop - PAGE_GAP, behavior: 'smooth' });
  };

  const changeZoom = (next: number) => {
    const clamped = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, next));
    if (scroller) scrollRatioRef.current = scroller.scrollTop / Math.max(1, scroller.scrollHeight);
    setZoom(clamped);
  };

  const toggleFullscreen = () => {
    const wrapper = wrapperRef.current;
    if (!wrapper) return;
    if (document.fullscreenElement) void document.exitFullscreen();
    else void wrapper.requestFullscreen?.();
  };

  const pageCount = sizes.length;
  const baseWidth = Math.max(160, availableWidth - SIDE_PADDING * 2);
  const button = 'rounded border border-gray-300 bg-white px-2.5 py-1 text-xs font-medium text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40';

  return (
    <div ref={wrapperRef} className="mb-6 flex flex-col overflow-hidden rounded-lg border border-gray-200 bg-gray-100" style={fullscreen ? { height: '100vh' } : undefined}>
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-gray-200 bg-white px-3 py-2">
        <div className="flex items-center gap-1.5">
          <button type="button" className={button} onClick={() => goToPage(current - 1)} disabled={status !== 'ready' || current <= 1} aria-label="Previous page">
            ◀
          </button>
          <span className="min-w-[88px] text-center text-xs tabular-nums text-gray-600" aria-live="polite">
            {status === 'ready' ? `Page ${current} of ${pageCount}` : status === 'loading' ? 'Loading…' : 'Unavailable'}
          </span>
          <button type="button" className={button} onClick={() => goToPage(current + 1)} disabled={status !== 'ready' || current >= pageCount} aria-label="Next page">
            ▶
          </button>
        </div>
        <div className="flex items-center gap-1.5">
          <button type="button" className={button} onClick={() => changeZoom(zoom - ZOOM_STEP)} disabled={status !== 'ready' || zoom <= MIN_ZOOM} aria-label="Zoom out">
            −
          </button>
          <button type="button" className={`${button} min-w-[52px] tabular-nums`} onClick={() => changeZoom(1)} disabled={status !== 'ready'} aria-label="Fit to width">
            {Math.round(zoom * 100)}%
          </button>
          <button type="button" className={button} onClick={() => changeZoom(zoom + ZOOM_STEP)} disabled={status !== 'ready' || zoom >= MAX_ZOOM} aria-label="Zoom in">
            +
          </button>
        </div>
        <div className="flex items-center gap-1.5">
          {canFullscreen && (
            <button type="button" className={`${button} hidden sm:inline-block`} onClick={toggleFullscreen} disabled={status !== 'ready'}>
              {fullscreen ? 'Exit full screen' : 'Full screen'}
            </button>
          )}
          <a href={src} target="_blank" rel="noopener noreferrer" className={button}>
            Open
          </a>
          {showDownload && (
            <a href={withQuery(src, 'download=1')} download className={button}>
              Download
            </a>
          )}
        </div>
      </div>

      <div
        ref={setScroller}
        onScroll={handleScroll}
        role="region"
        aria-label={title ? `PDF: ${title}` : 'PDF document'}
        tabIndex={0}
        className={`relative min-h-0 overflow-auto ${fullscreen ? 'flex-1' : ''}`}
        style={fullscreen ? undefined : { height }}
      >
        {status === 'loading' && <p className="p-8 text-center text-sm text-gray-500">Loading the document…</p>}
        {status === 'error' && (
          <div className="p-8 text-center text-sm text-gray-600">
            <p>This document could not be shown here.</p>
            <p className="mt-2">
              <a href={withQuery(src, 'download=1')} download className="font-medium text-indigo-600 underline">
                Download it instead
              </a>
            </p>
          </div>
        )}
        {status === 'ready' && doc && (
          <div className="flex flex-col items-center" style={{ gap: PAGE_GAP, padding: `${PAGE_GAP}px ${SIDE_PADDING}px`, minWidth: '100%', width: 'max-content' }}>
            {sizes.map((size, index) => {
              const width = Math.round(baseWidth * zoom);
              return <PdfPage key={index} doc={doc} pageNumber={index + 1} width={width} height={Math.round((width * size.height) / size.width)} scroller={scroller} />;
            })}
          </div>
        )}
      </div>
    </div>
  );
}
