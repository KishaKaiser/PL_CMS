'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { RevisionsPanel } from '../../../components/admin/revisions-panel';
import { EditorPreview } from '../../../components/admin/editor-preview';
import {
  MediaLibrary,
  type MediaAsset,
  buildMediaEmbedHtml,
} from '../../../components/admin/media-library';
import { RichTextEditor } from '../../../components/admin/rich-text-editor';
import {
  type EditorialStatus,
  fromDatetimeLocalValue,
  getEditorialStatus,
  getEditorialStatusBadgeClass,
  getEditorialStatusLabel,
  isValidSlug,
  slugify,
  toDatetimeLocalValue,
} from '../../../lib/cms';

interface Page {
  id: string;
  slug: string;
  title: string;
  metaTitle: string | null;
  metaDescription: string | null;
  content: string;
  featuredImageUrl: string | null;
  featuredMedia: MediaAsset | null;
  publishedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

interface PageForm {
  slug: string;
  title: string;
  metaTitle: string;
  metaDescription: string;
  content: string;
  featuredImageUrl: string;
  featuredMediaId: string | null;
  editorialStatus: EditorialStatus;
  scheduledAt: string;
  currentPublishedAt: string | null;
}

type StatusFilter = 'all' | 'published' | 'scheduled' | 'draft';
type AutosaveState = 'idle' | 'unsaved' | 'saving' | 'saved';
type EditorTab = 'content' | 'layout' | 'design' | 'preview';
type BuilderBlockType = 'heading' | 'text' | 'image' | 'button' | 'columns' | 'product-grid';

interface BuilderBlock {
  id: string;
  type: BuilderBlockType;
  props: Record<string, unknown>;
  children?: BuilderBlock[];
}

interface BuilderSection {
  id: string;
  type: 'section';
  settings: {
    layout?: string;
    background?: string;
    padding?: string;
  };
  blocks: BuilderBlock[];
}

interface BuilderLayout {
  version: number;
  type: string;
  settings: {
    layout?: string;
    breadcrumbs?: boolean;
    showTitle?: boolean;
    showHeader?: boolean;
    showFooter?: boolean;
  };
  sections: BuilderSection[];
}

const FILTER_OPTIONS: Array<{ value: StatusFilter; label: string }> = [
  { value: 'all', label: 'All' },
  { value: 'published', label: 'Published' },
  { value: 'scheduled', label: 'Scheduled' },
  { value: 'draft', label: 'Draft' },
];

const SCHEDULE_MIN_LEAD_MS = 60_000;
const AUTOSAVE_DELAY_MS = 30_000;
const PAGE_EDITOR_TABS: Array<{ value: EditorTab; label: string; description: string }> = [
  { value: 'content', label: 'Content', description: 'Title, body, SEO, and media' },
  { value: 'layout', label: 'Layout', description: 'Width, title, breadcrumbs, header, footer' },
  { value: 'design', label: 'Design', description: 'Visual sections and page blocks' },
  { value: 'preview', label: 'Preview', description: 'Review before publishing' },
];

const emptyBuilderLayout: BuilderLayout = {
  version: 1,
  type: 'page',
  settings: { layout: 'default', breadcrumbs: true, showTitle: true, showHeader: true, showFooter: true },
  sections: [
    {
      id: 'section-main',
      type: 'section',
      settings: { layout: 'contained', background: '#ffffff', padding: '48px 24px' },
      blocks: [
        { id: 'heading-main', type: 'heading', props: { text: 'Page heading', fontSize: 40, align: 'left' } },
        { id: 'text-main', type: 'text', props: { text: 'Add page content or visual blocks here.', fontSize: 16 } },
      ],
    },
  ],
};

const emptyForm: PageForm = {
  slug: '',
  title: '',
  metaTitle: '',
  metaDescription: '',
  content: '',
  featuredImageUrl: '',
  featuredMediaId: null,
  editorialStatus: 'draft',
  scheduledAt: '',
  currentPublishedAt: null,
};

function createId(prefix: string) {
  return `${prefix}-${Math.random().toString(36).slice(2, 9)}`;
}

function cloneDefaultBuilderLayout(): BuilderLayout {
  return {
    ...emptyBuilderLayout,
    settings: { ...emptyBuilderLayout.settings },
    sections: emptyBuilderLayout.sections.map((section) => ({
      ...section,
      settings: { ...section.settings },
      blocks: section.blocks.map((block) => ({ ...block, props: { ...block.props } })),
    })),
  };
}

function normalizeBuilderLayout(value: unknown): BuilderLayout {
  if (!value || typeof value !== 'object') return cloneDefaultBuilderLayout();

  const candidate = value as Partial<BuilderLayout>;
  const sections = Array.isArray(candidate.sections)
    ? candidate.sections.map((section, index) => ({
        id: typeof section?.id === 'string' ? section.id : createId(`section-${index + 1}`),
        type: 'section' as const,
        settings: {
          layout: section?.settings?.layout ?? 'contained',
          background: section?.settings?.background ?? '#ffffff',
          padding: section?.settings?.padding ?? '48px 24px',
        },
        blocks: Array.isArray(section?.blocks)
          ? section.blocks
              .filter((block): block is BuilderBlock => Boolean(block && typeof block.id === 'string' && typeof block.type === 'string'))
              .map((block) => ({
                ...block,
                props: block.props && typeof block.props === 'object' ? block.props : {},
                children: Array.isArray(block.children) ? block.children : undefined,
              }))
          : [],
      }))
    : cloneDefaultBuilderLayout().sections;

  return {
    version: typeof candidate.version === 'number' ? candidate.version : 1,
    type: typeof candidate.type === 'string' ? candidate.type : 'page',
    settings: {
      ...emptyBuilderLayout.settings,
      ...(candidate.settings && typeof candidate.settings === 'object' ? candidate.settings : {}),
    },
    sections,
  };
}

function createDesignBlock(type: BuilderBlockType, title: string, featuredImageUrl: string): BuilderBlock {
  const id = createId(type);
  switch (type) {
    case 'heading':
      return { id, type, props: { text: title || 'Page heading', fontSize: 40, align: 'left' } };
    case 'text':
      return { id, type, props: { text: 'Add your text here.', fontSize: 16 } };
    case 'image':
      return {
        id,
        type,
        props: { src: featuredImageUrl, alt: title, height: 320, objectFit: 'cover', borderRadius: 8 },
      };
    case 'button':
      return { id, type, props: { label: 'Learn More', href: '#', align: 'left' } };
    case 'columns':
      return { id, type, props: { columns: 2 }, children: [] };
    case 'product-grid':
      return { id, type, props: { limit: 3 } };
    default:
      return { id, type: 'text', props: { text: 'Add your text here.', fontSize: 16 } };
  }
}

function blockTypeLabel(type: BuilderBlockType) {
  switch (type) {
    case 'heading':
      return 'Heading';
    case 'text':
      return 'Text';
    case 'image':
      return 'Image';
    case 'button':
      return 'Button';
    case 'columns':
      return 'Columns';
    case 'product-grid':
      return 'Products';
    default:
      return 'Block';
  }
}

function pageShellClass(layout?: string) {
  switch (layout) {
    case 'full':
      return 'space-y-4';
    case 'sidebar-left':
      return 'grid gap-4 lg:grid-cols-[220px_minmax(0,1fr)]';
    case 'sidebar-right':
      return 'grid gap-4 lg:grid-cols-[minmax(0,1fr)_220px]';
    default:
      return 'mx-auto max-w-4xl space-y-4';
  }
}

function getPrimaryAction(status: EditorialStatus) {
  switch (status) {
    case 'published':
      return {
        action: 'unpublish',
        label: 'Move to draft',
        className: 'bg-yellow-100 text-yellow-700 hover:bg-yellow-200',
      };
    default:
      return {
        action: 'publish',
        label: 'Publish now',
        className: 'bg-green-100 text-green-700 hover:bg-green-200',
      };
  }
}

function getAutosaveBadgeClass(state: AutosaveState) {
  switch (state) {
    case 'saving':
      return 'bg-blue-100 text-blue-700';
    case 'saved':
      return 'bg-green-100 text-green-700';
    case 'unsaved':
      return 'bg-amber-100 text-amber-700';
    default:
      return 'bg-gray-100 text-gray-600';
  }
}

function getAutosaveLabel(state: AutosaveState) {
  switch (state) {
    case 'saving':
      return 'Saving…';
    case 'saved':
      return 'Saved';
    case 'unsaved':
      return 'Unsaved changes';
    default:
      return 'Autosave ready';
  }
}

export default function AdminPagesPage() {
  const [pages, setPages] = useState<Page[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [form, setForm] = useState<PageForm>(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showEditor, setShowEditor] = useState(false);
  const [saving, setSaving] = useState(false);
  const [bulkAction, setBulkAction] = useState<string | null>(null);
  const [slugTouched, setSlugTouched] = useState(false);
  const [featuredMedia, setFeaturedMedia] = useState<MediaAsset | null>(null);
  const [showMediaLibrary, setShowMediaLibrary] = useState(false);
  const [showRevisions, setShowRevisions] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [autosaveState, setAutosaveState] = useState<AutosaveState>('idle');
  const [revisionRefreshKey, setRevisionRefreshKey] = useState(0);
  const [editorTab, setEditorTab] = useState<EditorTab>('content');
  const [builderLayout, setBuilderLayout] = useState<BuilderLayout>(emptyBuilderLayout);
  const [selectedDesignBlockId, setSelectedDesignBlockId] = useState('');
  const [builderSaving, setBuilderSaving] = useState(false);
  const [builderStatus, setBuilderStatus] = useState('');
  const [builderError, setBuilderError] = useState('');
  const suppressAutosaveRef = useRef(true);

  const fetchPages = useCallback(async (nextStatus: StatusFilter) => {
    setLoading(true);
    setError('');
    try {
      const query = nextStatus === 'all' ? '' : `?status=${nextStatus}`;
      const res = await fetch(`/api/proxy/pages${query}`);
      if (!res.ok) throw new Error('Failed to load pages');
      setPages((await res.json()) as Page[]);
      setSelectedIds([]);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Error');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchPages(statusFilter);
  }, [fetchPages, statusFilter]);

  const slugError = useMemo(() => {
    if (!form.slug) return 'Slug is required.';
    if (!isValidSlug(form.slug)) return 'Use lowercase letters, numbers, and hyphens only.';
    return '';
  }, [form.slug]);

  const previewPublishedAt = useMemo(() => {
    if (form.editorialStatus === 'draft') return null;
    if (form.editorialStatus === 'scheduled') {
      return form.scheduledAt ? fromDatetimeLocalValue(form.scheduledAt) : null;
    }
    if (form.currentPublishedAt && getEditorialStatus(form.currentPublishedAt) === 'published') {
      return form.currentPublishedAt;
    }
    return new Date().toISOString();
  }, [form.currentPublishedAt, form.editorialStatus, form.scheduledAt]);

  useEffect(() => {
    if (!editingId) return;
    if (suppressAutosaveRef.current) {
      suppressAutosaveRef.current = false;
      return;
    }

    setAutosaveState('unsaved');
    const timer = window.setTimeout(async () => {
      setAutosaveState('saving');
      try {
        const res = await fetch(`/api/proxy/pages/${editingId}/autosave`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(buildAutosavePayload(form, previewPublishedAt)),
        });
        if (!res.ok) {
          const data = (await res.json().catch(() => ({}))) as { message?: string };
          throw new Error(data.message ?? 'Autosave failed');
        }
        setAutosaveState('saved');
        setRevisionRefreshKey((currentValue) => currentValue + 1);
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : 'Autosave failed');
        setAutosaveState('unsaved');
      }
    }, AUTOSAVE_DELAY_MS);

    return () => window.clearTimeout(timer);
  }, [editingId, form, previewPublishedAt]);

  function buildAutosavePayload(currentForm: PageForm, currentPublishedAt: string | null) {
    return {
      slug: currentForm.slug,
      title: currentForm.title,
      metaTitle: currentForm.metaTitle || null,
      metaDescription: currentForm.metaDescription || null,
      content: currentForm.content,
      featuredMediaId: currentForm.featuredMediaId,
      featuredImageUrl: currentForm.featuredMediaId ? null : currentForm.featuredImageUrl || null,
      publishedAt: currentPublishedAt,
    };
  }

  function applyPageToForm(page: Page) {
    suppressAutosaveRef.current = true;
    const editorialStatus = getEditorialStatus(page.publishedAt);
    setEditingId(page.id);
    setForm({
      slug: page.slug,
      title: page.title,
      metaTitle: page.metaTitle ?? '',
      metaDescription: page.metaDescription ?? '',
      content: page.content,
      featuredImageUrl: page.featuredImageUrl ?? '',
      featuredMediaId: page.featuredMedia?.id ?? null,
      editorialStatus,
      scheduledAt: editorialStatus === 'scheduled' ? toDatetimeLocalValue(page.publishedAt) : '',
      currentPublishedAt: page.publishedAt,
    });
    setFeaturedMedia(page.featuredMedia);
    setShowMediaLibrary(false);
    setSlugTouched(true);
    setAutosaveState('saved');
  }

  function updateForm(updater: (currentForm: PageForm) => PageForm) {
    setForm((currentForm) => updater(currentForm));
    if (editingId) setAutosaveState('unsaved');
  }

  async function refreshEditedPage(id: string) {
    const res = await fetch(`/api/proxy/pages/${id}`);
    if (!res.ok) throw new Error('Failed to refresh page');
    const page = (await res.json()) as Page;
    applyPageToForm(page);
    await fetchPages(statusFilter);
  }

  async function loadPageLayout(pageId: string) {
    setBuilderError('');
    setBuilderStatus('');
    try {
      const res = await fetch(`/api/proxy/admin/builder/layouts/page/${pageId}`);
      if (!res.ok) throw new Error('Could not load page design');
      const data = (await res.json()) as { draftJson?: unknown; publishedJson?: unknown; status?: string };
      const source = data.status === 'PUBLISHED' && data.publishedJson ? data.publishedJson : data.draftJson;
      setBuilderLayout(normalizeBuilderLayout(source));
      setSelectedDesignBlockId('');
    } catch (err: unknown) {
      setBuilderError(err instanceof Error ? err.message : 'Could not load page design');
      setBuilderLayout(cloneDefaultBuilderLayout());
    }
  }

  async function savePageLayout() {
    if (!editingId) {
      setBuilderError('Save the page before editing its visual design.');
      return;
    }

    setBuilderSaving(true);
    setBuilderError('');
    setBuilderStatus('');
    try {
      const saveRes = await fetch('/api/proxy/admin/builder/layouts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ entityType: 'page', entityId: editingId, layout: builderLayout }),
      });
      if (!saveRes.ok) throw new Error('Could not save page design');
      const publishRes = await fetch(`/api/proxy/admin/builder/layouts/page/${editingId}/publish`, { method: 'POST' });
      if (!publishRes.ok) throw new Error('Could not publish page design');
      setBuilderStatus('Page layout and design saved.');
    } catch (err: unknown) {
      setBuilderError(err instanceof Error ? err.message : 'Could not save page design');
    } finally {
      setBuilderSaving(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError('');

    try {
      if (slugError) throw new Error(slugError);

      const now = new Date();
      let publishedAt: string | null = null;
      if (form.editorialStatus === 'scheduled') {
        if (!form.scheduledAt) throw new Error('Choose a future publish date and time.');
        publishedAt = fromDatetimeLocalValue(form.scheduledAt);
        if (new Date(publishedAt).getTime() < now.getTime() + SCHEDULE_MIN_LEAD_MS) {
          throw new Error('Scheduled publish time must be at least one minute in the future.');
        }
      } else if (form.editorialStatus === 'published') {
        publishedAt =
          form.currentPublishedAt && getEditorialStatus(form.currentPublishedAt) === 'published'
            ? form.currentPublishedAt
            : now.toISOString();
      }

      const payload = {
        slug: form.slug,
        title: form.title,
        metaTitle: form.metaTitle || null,
        metaDescription: form.metaDescription || null,
        content: form.content,
        featuredMediaId: form.featuredMediaId,
        featuredImageUrl: form.featuredMediaId ? null : form.featuredImageUrl || null,
        publishedAt,
      };

      const url = editingId ? `/api/proxy/pages/${editingId}` : '/api/proxy/pages';
      const method = editingId ? 'PUT' : 'POST';
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { message?: string };
        throw new Error(data.message ?? 'Save failed');
      }

      await res.json();
      resetForm();
      await fetchPages(statusFilter);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Error');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('Delete this page?')) return;
    try {
      const res = await fetch(`/api/proxy/pages/${id}`, { method: 'DELETE' });
      if (!res.ok && res.status !== 204) throw new Error('Delete failed');
      if (editingId === id) resetForm();
      await fetchPages(statusFilter);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Error');
    }
  }

  async function handlePrimaryAction(page: Page) {
    const status = getEditorialStatus(page.publishedAt);
    const { action } = getPrimaryAction(status);

    try {
      const res = await fetch(`/api/proxy/pages/${page.id}/${action}`, { method: 'PATCH' });
      if (!res.ok) throw new Error('Action failed');
      await fetchPages(statusFilter);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Error');
    }
  }

  async function handleBulkAction(action: 'publish' | 'unpublish' | 'delete') {
    if (selectedIds.length === 0) return;
    if (action === 'delete' && !confirm('Delete all selected pages?')) return;

    setBulkAction(action);
    setError('');
    try {
      const res = await fetch('/api/proxy/pages/bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, ids: selectedIds }),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { message?: string };
        throw new Error(data.message ?? 'Bulk action failed');
      }
      await fetchPages(statusFilter);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Error');
    } finally {
      setBulkAction(null);
    }
  }

  function startEdit(page: Page) {
    setShowEditor(true);
    applyPageToForm(page);
    void loadPageLayout(page.id);
    setShowRevisions(false);
    setEditorTab('content');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function resetForm() {
    suppressAutosaveRef.current = true;
    setEditingId(null);
    setForm(emptyForm);
    setFeaturedMedia(null);
    setShowMediaLibrary(false);
    setSlugTouched(false);
    setError('');
    setShowRevisions(false);
    setAutosaveState('idle');
    setShowEditor(false);
    setEditorTab('content');
    setBuilderLayout(cloneDefaultBuilderLayout());
    setSelectedDesignBlockId('');
    setBuilderStatus('');
    setBuilderError('');
  }

  function toggleSelection(ids: string[], id: string) {
    return ids.includes(id) ? ids.filter((entry) => entry !== id) : [...ids, id];
  }

  function insertMediaIntoContent(asset: MediaAsset) {
    updateForm((currentForm) => ({
      ...currentForm,
      content: `${currentForm.content}${currentForm.content ? '\n' : ''}${buildMediaEmbedHtml(asset)}`,
    }));
  }

  function updateBuilderSettings(settings: Partial<BuilderLayout['settings']>) {
    setBuilderLayout((current) => ({
      ...current,
      settings: { ...current.settings, ...settings },
    }));
    setBuilderStatus('');
  }

  function addDesignBlock(type: BuilderBlockType) {
    const block = createDesignBlock(type, form.title || 'Page heading', featuredMedia?.url ?? form.featuredImageUrl);
    setBuilderLayout((current) => ({
      ...current,
      sections: current.sections.length > 0
        ? current.sections.map((section, index) => index === 0 ? { ...section, blocks: [...section.blocks, block] } : section)
        : [{ id: createId('section'), type: 'section', settings: { layout: 'contained', background: '#ffffff', padding: '48px 24px' }, blocks: [block] }],
    }));
    setSelectedDesignBlockId(block.id);
    setBuilderStatus('');
  }

  function updateDesignBlock(blockId: string, props: Record<string, unknown>) {
    setBuilderLayout((current) => ({
      ...current,
      sections: current.sections.map((section) => ({
        ...section,
        blocks: section.blocks.map((block) => block.id === blockId ? { ...block, props: { ...block.props, ...props } } : block),
      })),
    }));
    setBuilderStatus('');
  }

  function removeDesignBlock(blockId: string) {
    setBuilderLayout((current) => ({
      ...current,
      sections: current.sections.map((section) => ({
        ...section,
        blocks: section.blocks.filter((block) => block.id !== blockId),
      })),
    }));
    setSelectedDesignBlockId('');
    setBuilderStatus('');
  }

  function addDesignSection() {
    setBuilderLayout((current) => ({
      ...current,
      sections: [
        ...current.sections,
        { id: createId('section'), type: 'section', settings: { layout: 'contained', background: '#ffffff', padding: '48px 24px' }, blocks: [] },
      ],
    }));
  }

  return (
    <div className="mx-auto max-w-7xl p-8">
      <div className="mb-6 flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-3xl font-bold">Pages</h1>
          <p className="mt-1 text-sm text-gray-600">
            Review all pages, then create or edit content when needed.
          </p>
        </div>
        {showEditor ? (
          <button
            type="button"
            onClick={resetForm}
            className="rounded border border-gray-200 bg-white px-4 py-2 text-sm hover:bg-gray-50"
          >
            Back to All Pages
          </button>
        ) : (
          <button
            type="button"
            onClick={() => {
              resetForm();
              setShowEditor(true);
            }}
            className="rounded bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
          >
            Create New Page
          </button>
        )}
      </div>

      {showEditor && (
      <section className="mb-8 rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold">{editingId ? 'Edit Page' : 'Create Page'}</h2>
            <p className="text-sm text-gray-500">
              Use the visual editor and publishing sidebar for a smoother workflow.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {editingId && (
              <>
                <button
                  type="button"
                  onClick={() => setShowRevisions((currentValue) => !currentValue)}
                  className="rounded border border-gray-200 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50"
                >
                  {showRevisions ? 'Hide revisions' : 'Revisions'}
                </button>
                <span
                  role="status"
                  aria-live="polite"
                  className={`rounded-full px-3 py-1 text-xs font-medium ${getAutosaveBadgeClass(autosaveState)}`}
                >
                  {getAutosaveLabel(autosaveState)}
                </span>
              </>
            )}
            <span
              className={`rounded-full px-3 py-1 text-xs font-medium ${getEditorialStatusBadgeClass(form.editorialStatus)}`}
            >
              {getEditorialStatusLabel(form.editorialStatus)}
            </span>
          </div>
        </div>

        {error && (
          <p role="alert" aria-live="assertive" className="mb-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-600">
            {error}
          </p>
        )}

        <div className="mb-6 grid gap-2 rounded-lg bg-gray-50 p-2 md:grid-cols-4">
          {PAGE_EDITOR_TABS.map((tab) => (
            <button
              key={tab.value}
              type="button"
              onClick={() => setEditorTab(tab.value)}
              className={`rounded-lg px-3 py-2 text-left text-sm transition ${
                editorTab === tab.value ? 'bg-white text-indigo-700 shadow-sm' : 'text-gray-600 hover:bg-white'
              }`}
            >
              <span className="block font-semibold">{tab.label}</span>
              <span className="mt-0.5 block text-xs text-gray-500">{tab.description}</span>
            </button>
          ))}
        </div>

        <form onSubmit={handleSubmit} className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
          <div className="space-y-5">
            {editorTab === 'content' && (
              <>
            <div>
              <label className="block text-sm font-medium text-gray-700">Title *</label>
              <input
                required
                value={form.title}
                onChange={(event) => {
                  const title = event.target.value;
                  updateForm((currentForm) => ({
                    ...currentForm,
                    title,
                    slug: slugTouched ? currentForm.slug : slugify(title),
                  }));
                }}
                className="mt-1 w-full rounded-lg border border-gray-200 px-4 py-3 text-sm"
                placeholder="About Psychic Link"
              />
            </div>

            <div>
              <div className="flex items-center justify-between gap-3">
                <label className="block text-sm font-medium text-gray-700">Slug *</label>
                <button
                  type="button"
                  onClick={() => {
                    setSlugTouched(true);
                    updateForm((currentForm) => ({
                      ...currentForm,
                      slug: slugify(currentForm.title || currentForm.slug),
                    }));
                  }}
                  className="text-xs font-medium text-indigo-600 hover:underline"
                >
                  Regenerate from title
                </button>
              </div>
              <input
                required
                value={form.slug}
                onChange={(event) => {
                  setSlugTouched(true);
                  updateForm((currentForm) => ({
                    ...currentForm,
                    slug: slugify(event.target.value),
                  }));
                }}
                className="mt-1 w-full rounded-lg border border-gray-200 px-4 py-3 font-mono text-sm"
                placeholder="about-psychic-link"
              />
              <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-xs">
                <span className={slugError ? 'text-red-600' : 'text-gray-500'}>
                  {slugError || 'Lowercase letters, numbers, and hyphens only.'}
                </span>
                <span className="text-gray-500">Permalink: /{form.slug || 'your-page'}</span>
              </div>
            </div>

            <section className="rounded-lg border border-gray-200 bg-gray-50 p-4">
              <h3 className="text-sm font-semibold text-gray-900">SEO</h3>
              <p className="mt-1 text-xs text-gray-500">
                Optional fields for search results and social previews. Open Graph falls back to
                these values automatically.
              </p>

              <div className="mt-4 space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700">Meta title</label>
                  <input
                    value={form.metaTitle}
                    onChange={(event) =>
                      updateForm((currentForm) => ({
                        ...currentForm,
                        metaTitle: event.target.value,
                      }))
                    }
                    className="mt-1 w-full rounded-lg border border-gray-200 px-4 py-3 text-sm"
                    placeholder="About Psychic Link | Psychic Link CMS"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    Meta description
                  </label>
                  <textarea
                    value={form.metaDescription}
                    onChange={(event) =>
                      updateForm((currentForm) => ({
                        ...currentForm,
                        metaDescription: event.target.value,
                      }))
                    }
                    rows={3}
                    className="mt-1 w-full rounded-lg border border-gray-200 px-4 py-3 text-sm"
                    placeholder="A short description for search engines and social shares."
                  />
                </div>
              </div>
            </section>

            <div>
              <label className="mb-2 block text-sm font-medium text-gray-700">Page Content *</label>
              <RichTextEditor
                value={form.content}
                onChange={(content) => updateForm((currentForm) => ({ ...currentForm, content }))}
              />
            </div>
              </>
            )}

            {editorTab === 'layout' && (
              <PageLayoutPanel
                layout={builderLayout}
                saving={builderSaving}
                status={builderStatus}
                error={builderError}
                onChange={updateBuilderSettings}
                onSave={() => void savePageLayout()}
              />
            )}

            {editorTab === 'design' && (
              <PageDesignPanel
                layout={builderLayout}
                selectedBlockId={selectedDesignBlockId}
                featuredImageUrl={featuredMedia?.url ?? form.featuredImageUrl}
                builderSaving={builderSaving}
                builderStatus={builderStatus}
                builderError={builderError}
                onSelectBlock={setSelectedDesignBlockId}
                onAddBlock={addDesignBlock}
                onAddSection={addDesignSection}
                onUpdateBlock={updateDesignBlock}
                onRemoveBlock={removeDesignBlock}
                onSave={() => void savePageLayout()}
              />
            )}

            {editorTab === 'preview' && (
              <PageCombinedPreview
                title={form.title}
                content={form.content}
                featuredImageUrl={featuredMedia?.url ?? form.featuredImageUrl}
                permalink={`/${form.slug || 'your-page'}`}
                status={form.editorialStatus}
                publishedAt={previewPublishedAt}
                layout={builderLayout}
              />
            )}
          </div>

          <div className="space-y-5">
            <section className="rounded-lg border border-gray-200 bg-gray-50 p-4">
              <h3 className="text-sm font-semibold text-gray-900">Publishing</h3>
              <div className="mt-4 space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700">Status</label>
                  <select
                    value={form.editorialStatus}
                    onChange={(event) =>
                      updateForm((currentForm) => ({
                        ...currentForm,
                        editorialStatus: event.target.value as EditorialStatus,
                        scheduledAt:
                          event.target.value === 'scheduled'
                            ? currentForm.scheduledAt ||
                              toDatetimeLocalValue(currentForm.currentPublishedAt)
                            : currentForm.scheduledAt,
                      }))
                    }
                    className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
                  >
                    <option value="draft">Draft</option>
                    <option value="published">Publish now</option>
                    <option value="scheduled">Schedule</option>
                  </select>
                </div>

                {form.editorialStatus === 'scheduled' && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Publish on</label>
                    <input
                      type="datetime-local"
                      value={form.scheduledAt}
                      onChange={(event) =>
                        updateForm((currentForm) => ({
                          ...currentForm,
                          scheduledAt: event.target.value,
                        }))
                      }
                      className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
                    />
                  </div>
                )}
              </div>
            </section>

            <section className="rounded-lg border border-gray-200 bg-gray-50 p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="text-sm font-semibold text-gray-900">Featured Image</h3>
                  <p className="mt-1 text-xs text-gray-500">
                    Choose a library asset for reuse or paste an external image URL.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setShowMediaLibrary((currentValue) => !currentValue)}
                  className="rounded border border-gray-200 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50"
                >
                  {showMediaLibrary ? 'Hide library' : 'Open library'}
                </button>
              </div>

              {featuredMedia && (
                <div className="mt-3 rounded-lg border border-indigo-100 bg-indigo-50 px-3 py-2 text-xs text-indigo-700">
                  Selected from media library:{' '}
                  <span className="font-medium">{featuredMedia.title}</span>
                </div>
              )}

              <input
                type="url"
                value={form.featuredMediaId ? '' : form.featuredImageUrl}
                onChange={(event) => {
                  setFeaturedMedia(null);
                  updateForm((currentForm) => ({
                    ...currentForm,
                    featuredMediaId: null,
                    featuredImageUrl: event.target.value,
                  }));
                }}
                className="mt-3 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
                placeholder="https://example.com/page-image.jpg"
              />

              <div className="mt-2 flex flex-wrap gap-2">
                {featuredMedia && (
                  <button
                    type="button"
                    onClick={() => {
                      setFeaturedMedia(null);
                      updateForm((currentForm) => ({
                        ...currentForm,
                        featuredMediaId: null,
                        featuredImageUrl: '',
                      }));
                    }}
                    className="rounded border border-gray-200 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50"
                  >
                    Clear media selection
                  </button>
                )}
              </div>

              {form.featuredImageUrl && (
                <img
                  src={form.featuredImageUrl}
                  alt="Featured preview"
                  className="mt-3 h-36 w-full rounded-lg border border-gray-200 object-cover"
                />
              )}

              {showMediaLibrary && (
                <div className="mt-4">
                  <MediaLibrary
                    title="Select page media"
                    description="Upload new assets, reuse existing images as the featured image, or insert media into the page body."
                    selectedMediaId={form.featuredMediaId}
                    onlyImages
                    onSelect={(asset) => {
                      setFeaturedMedia(asset);
                      updateForm((currentForm) => ({
                        ...currentForm,
                        featuredMediaId: asset.id,
                        featuredImageUrl: asset.url,
                      }));
                    }}
                    onInsert={insertMediaIntoContent}
                  />
                </div>
              )}
            </section>

            {editingId && (
              <RevisionsPanel
                endpointBase={`/api/proxy/pages/${editingId}`}
                open={showRevisions}
                refreshKey={revisionRefreshKey}
                onRestored={() => refreshEditedPage(editingId)}
              />
            )}

            <EditorPreview
              title={form.title}
              content={form.content}
              featuredImageUrl={form.featuredImageUrl}
              permalink={`/${form.slug || 'your-page'}`}
              status={form.editorialStatus}
              publishedAt={previewPublishedAt}
            />

            <div className="flex flex-wrap gap-3">
              <button
                type="submit"
                disabled={saving}
                className="rounded bg-indigo-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
              >
                {saving ? 'Saving…' : editingId ? 'Update Page' : 'Create Page'}
              </button>
              {(editingId ||
                form.title ||
                form.slug ||
                form.metaTitle ||
                form.metaDescription ||
                form.content ||
                form.featuredImageUrl) && (
                <button
                  type="button"
                  onClick={resetForm}
                  className="rounded border border-gray-200 bg-white px-5 py-2.5 text-sm font-medium hover:bg-gray-50"
                >
                  Reset
                </button>
              )}
            </div>
          </div>
        </form>
      </section>
      )}

      <section>
        <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h2 className="text-lg font-semibold">All Pages</h2>
            <p className="text-sm text-gray-500">{pages.length} matching pages</p>
          </div>
          <div className="flex flex-wrap gap-2">
            {FILTER_OPTIONS.map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => setStatusFilter(option.value)}
                className={`rounded-full px-3 py-1.5 text-sm font-medium ${
                  statusFilter === option.value
                    ? 'bg-indigo-600 text-white'
                    : 'bg-white text-gray-700 border border-gray-200 hover:bg-gray-50'
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>

        {selectedIds.length > 0 && (
          <div className="mb-4 flex flex-wrap items-center gap-3 rounded-lg border border-indigo-200 bg-indigo-50 px-4 py-3">
            <p className="text-sm font-medium text-indigo-900">{selectedIds.length} selected</p>
            <button
              type="button"
              onClick={() => void handleBulkAction('publish')}
              disabled={bulkAction !== null}
              className="rounded bg-green-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-green-700 disabled:opacity-50"
            >
              {bulkAction === 'publish' ? 'Publishing…' : 'Publish'}
            </button>
            <button
              type="button"
              onClick={() => void handleBulkAction('unpublish')}
              disabled={bulkAction !== null}
              className="rounded bg-yellow-500 px-3 py-1.5 text-xs font-medium text-white hover:bg-yellow-600 disabled:opacity-50"
            >
              {bulkAction === 'unpublish' ? 'Updating…' : 'Unpublish'}
            </button>
            <button
              type="button"
              onClick={() => void handleBulkAction('delete')}
              disabled={bulkAction !== null}
              className="rounded bg-red-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-red-700 disabled:opacity-50"
            >
              {bulkAction === 'delete' ? 'Deleting…' : 'Delete'}
            </button>
          </div>
        )}

        {loading ? (
          <p className="text-gray-500">Loading…</p>
        ) : pages.length === 0 ? (
          <p className="text-gray-500">No pages found for this filter.</p>
        ) : (
          <div className="overflow-hidden rounded-lg border bg-white shadow-sm">
            <table className="w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600">
                    <input
                      type="checkbox"
                      checked={pages.length > 0 && selectedIds.length === pages.length}
                      onChange={(event) =>
                        setSelectedIds(event.target.checked ? pages.map((page) => page.id) : [])
                      }
                    />
                  </th>
                  {['Title', 'Slug', 'Status', 'Updated', ''].map((heading) => (
                    <th
                      key={heading}
                      className="px-4 py-3 text-left text-xs font-semibold text-gray-600"
                    >
                      {heading}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {pages.map((page) => {
                  const status = getEditorialStatus(page.publishedAt);
                  const primaryAction = getPrimaryAction(status);

                  return (
                    <tr key={page.id} className="border-t align-top hover:bg-gray-50">
                      <td className="px-4 py-3">
                        <input
                          type="checkbox"
                          checked={selectedIds.includes(page.id)}
                          onChange={() => setSelectedIds((ids) => toggleSelection(ids, page.id))}
                        />
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-start gap-3">
                          {page.featuredImageUrl && (
                            <img
                              src={page.featuredImageUrl}
                              alt={page.title}
                              className="h-12 w-12 rounded object-cover"
                            />
                          )}
                          <div>
                            <p className="font-medium text-gray-900">{page.title}</p>
                            <p className="text-xs text-gray-500">
                              Created {new Date(page.createdAt).toLocaleDateString()}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 font-mono text-xs">/{page.slug}</td>
                      <td className="px-4 py-3">
                        <span
                          className={`rounded-full px-2 py-0.5 text-xs font-medium ${getEditorialStatusBadgeClass(status)}`}
                        >
                          {getEditorialStatusLabel(status)}
                        </span>
                        {page.publishedAt && (
                          <p className="mt-2 text-xs text-gray-500">
                            {new Date(page.publishedAt).toLocaleString()}
                          </p>
                        )}
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-500">
                        {new Date(page.updatedAt).toLocaleString()}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap gap-2">
                          <button
                            type="button"
                            onClick={() => startEdit(page)}
                            className="rounded bg-gray-100 px-2 py-1 text-xs hover:bg-gray-200"
                          >
                            Edit
                          </button>
                          <button
                            type="button"
                            onClick={() => void handlePrimaryAction(page)}
                            className={`rounded px-2 py-1 text-xs ${primaryAction.className}`}
                          >
                            {primaryAction.label}
                          </button>
                          <button
                            type="button"
                            onClick={() => void handleDelete(page.id)}
                            className="rounded bg-red-100 px-2 py-1 text-xs text-red-700 hover:bg-red-200"
                          >
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

function PageLayoutPanel({
  layout,
  saving,
  status,
  error,
  onChange,
  onSave,
}: {
  layout: BuilderLayout;
  saving: boolean;
  status: string;
  error: string;
  onChange: (settings: Partial<BuilderLayout['settings']>) => void;
  onSave: () => void;
}) {
  return (
    <section className="rounded-lg border border-gray-200 bg-gray-50 p-5">
      <h3 className="text-lg font-semibold text-gray-900">Page Layout</h3>
      <p className="mt-1 text-sm text-gray-500">These options control this page only.</p>

      <div className="mt-5 grid gap-4 md:grid-cols-2">
        <label className="block text-sm font-medium text-gray-700">
          Page width
          <select
            value={layout.settings.layout ?? 'default'}
            onChange={(event) => onChange({ layout: event.target.value })}
            className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
          >
            <option value="default">Default width</option>
            <option value="full">Full width</option>
            <option value="sidebar-left">Sidebar left</option>
            <option value="sidebar-right">Sidebar right</option>
          </select>
        </label>

        {[
          ['showTitle', 'Show page title'],
          ['breadcrumbs', 'Show breadcrumbs'],
          ['showHeader', 'Show site header'],
          ['showFooter', 'Show site footer'],
        ].map(([key, label]) => (
          <label key={key} className="flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700">
            <input
              type="checkbox"
              checked={layout.settings[key as keyof BuilderLayout['settings']] !== false}
              onChange={(event) => onChange({ [key]: event.target.checked } as Partial<BuilderLayout['settings']>)}
            />
            {label}
          </label>
        ))}
      </div>

      <SaveDesignFooter saving={saving} status={status} error={error} onSave={onSave} />
    </section>
  );
}

function PageDesignPanel({
  layout,
  selectedBlockId,
  featuredImageUrl,
  builderSaving,
  builderStatus,
  builderError,
  onSelectBlock,
  onAddBlock,
  onAddSection,
  onUpdateBlock,
  onRemoveBlock,
  onSave,
}: {
  layout: BuilderLayout;
  selectedBlockId: string;
  featuredImageUrl: string;
  builderSaving: boolean;
  builderStatus: string;
  builderError: string;
  onSelectBlock: (id: string) => void;
  onAddBlock: (type: BuilderBlockType) => void;
  onAddSection: () => void;
  onUpdateBlock: (id: string, props: Record<string, unknown>) => void;
  onRemoveBlock: (id: string) => void;
  onSave: () => void;
}) {
  const selectedBlock = layout.sections.flatMap((section) => section.blocks).find((block) => block.id === selectedBlockId);

  return (
    <section className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_300px]">
      <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-lg font-semibold text-gray-900">Visual Design</h3>
            <p className="text-sm text-gray-500">Add simple page sections and blocks without leaving Pages.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            {(['heading', 'text', 'image', 'button', 'columns', 'product-grid'] as BuilderBlockType[]).map((type) => (
              <button key={type} type="button" onClick={() => onAddBlock(type)} className="rounded border bg-white px-3 py-1.5 text-xs font-medium hover:bg-indigo-50">
                {blockTypeLabel(type)}
              </button>
            ))}
            <button type="button" onClick={onAddSection} className="rounded bg-gray-900 px-3 py-1.5 text-xs font-medium text-white">
              Add section
            </button>
          </div>
        </div>

        <div className={pageShellClass(layout.settings.layout)}>
          {layout.settings.layout === 'sidebar-left' && <DesignSidebar />}
          <div className="space-y-4">
            {layout.sections.map((section) => (
              <section key={section.id} className="rounded-lg border border-dashed border-gray-300 bg-white p-4" style={{ background: section.settings.background }}>
                <div className="space-y-3">
                  {section.blocks.length === 0 ? (
                    <p className="rounded border border-dashed p-8 text-center text-sm text-gray-500">Add a block to this section.</p>
                  ) : (
                    section.blocks.map((block) => (
                      <button
                        key={block.id}
                        type="button"
                        onClick={() => onSelectBlock(block.id)}
                        className={`block w-full rounded border p-3 text-left ${selectedBlockId === block.id ? 'border-indigo-500 ring-2 ring-indigo-100' : 'border-gray-200 hover:border-indigo-300'}`}
                      >
                        <DesignBlockView block={block} featuredImageUrl={featuredImageUrl} />
                      </button>
                    ))
                  )}
                </div>
              </section>
            ))}
          </div>
          {layout.settings.layout === 'sidebar-right' && <DesignSidebar />}
        </div>
      </div>

      <aside className="rounded-lg border border-gray-200 bg-white p-4">
        <h3 className="text-sm font-semibold text-gray-900">Selected Block</h3>
        {selectedBlock ? (
          <BlockOptionsPanel
            block={selectedBlock}
            featuredImageUrl={featuredImageUrl}
            onUpdate={(props) => onUpdateBlock(selectedBlock.id, props)}
            onRemove={() => onRemoveBlock(selectedBlock.id)}
          />
        ) : (
          <p className="mt-3 text-sm text-gray-500">Select a block to edit it.</p>
        )}
        <SaveDesignFooter saving={builderSaving} status={builderStatus} error={builderError} onSave={onSave} />
      </aside>
    </section>
  );
}

function BlockOptionsPanel({
  block,
  featuredImageUrl,
  onUpdate,
  onRemove,
}: {
  block: BuilderBlock;
  featuredImageUrl: string;
  onUpdate: (props: Record<string, unknown>) => void;
  onRemove: () => void;
}) {
  return (
    <div className="mt-3 space-y-3">
      <p className="rounded bg-gray-50 px-3 py-2 text-xs text-gray-500">{blockTypeLabel(block.type)}</p>
      {['heading', 'text'].includes(block.type) && (
        <>
          <label className="block text-sm font-medium text-gray-700">Text<textarea value={String(block.props.text ?? '')} rows={4} onChange={(event) => onUpdate({ text: event.target.value })} className="mt-1 w-full rounded border px-3 py-2 text-sm" /></label>
          <label className="block text-sm font-medium text-gray-700">Font size<input type="number" value={Number(block.props.fontSize ?? (block.type === 'heading' ? 40 : 16))} onChange={(event) => onUpdate({ fontSize: Number(event.target.value) })} className="mt-1 w-full rounded border px-3 py-2 text-sm" /></label>
        </>
      )}
      {block.type === 'image' && (
        <>
          <label className="block text-sm font-medium text-gray-700">Image URL<input value={String(block.props.src ?? '')} onChange={(event) => onUpdate({ src: event.target.value })} className="mt-1 w-full rounded border px-3 py-2 text-sm" /></label>
          {featuredImageUrl && <button type="button" onClick={() => onUpdate({ src: featuredImageUrl })} className="rounded border px-3 py-1.5 text-xs hover:bg-gray-50">Use featured image</button>}
          <label className="block text-sm font-medium text-gray-700">Height<input type="number" value={Number(block.props.height ?? 320)} onChange={(event) => onUpdate({ height: Number(event.target.value) })} className="mt-1 w-full rounded border px-3 py-2 text-sm" /></label>
        </>
      )}
      {block.type === 'button' && (
        <>
          <label className="block text-sm font-medium text-gray-700">Label<input value={String(block.props.label ?? '')} onChange={(event) => onUpdate({ label: event.target.value })} className="mt-1 w-full rounded border px-3 py-2 text-sm" /></label>
          <label className="block text-sm font-medium text-gray-700">Link<input value={String(block.props.href ?? '')} onChange={(event) => onUpdate({ href: event.target.value })} className="mt-1 w-full rounded border px-3 py-2 text-sm" /></label>
        </>
      )}
      {block.type === 'columns' && (
        <label className="block text-sm font-medium text-gray-700">Columns<input type="number" min="2" max="4" value={Number(block.props.columns ?? 2)} onChange={(event) => onUpdate({ columns: Number(event.target.value) })} className="mt-1 w-full rounded border px-3 py-2 text-sm" /></label>
      )}
      {block.type === 'product-grid' && (
        <label className="block text-sm font-medium text-gray-700">Products to show<input type="number" min="1" max="12" value={Number(block.props.limit ?? 3)} onChange={(event) => onUpdate({ limit: Number(event.target.value) })} className="mt-1 w-full rounded border px-3 py-2 text-sm" /></label>
      )}
      <button type="button" onClick={onRemove} className="w-full rounded border border-red-200 bg-red-50 px-3 py-2 text-sm font-medium text-red-700 hover:bg-red-100">Delete block</button>
    </div>
  );
}

function PageCombinedPreview({
  title,
  content,
  featuredImageUrl,
  permalink,
  status,
  publishedAt,
  layout,
}: {
  title: string;
  content: string;
  featuredImageUrl: string;
  permalink: string;
  status: EditorialStatus;
  publishedAt: string | null;
  layout: BuilderLayout;
}) {
  return (
    <div className="grid gap-4 xl:grid-cols-2">
      <EditorPreview title={title} content={content} featuredImageUrl={featuredImageUrl} permalink={permalink} status={status} publishedAt={publishedAt} />
      <section className="rounded-lg border bg-white p-4">
        <h3 className="text-sm font-semibold text-gray-900">Layout preview</h3>
        <div className="mt-4 rounded border bg-gray-50 p-4">
          {layout.sections.map((section) => (
            <div key={section.id} className="mb-4 rounded bg-white p-4 last:mb-0">
              {section.blocks.map((block) => <DesignBlockView key={block.id} block={block} featuredImageUrl={featuredImageUrl} />)}
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

function DesignSidebar() {
  return (
    <aside className="rounded-lg border border-dashed border-gray-300 bg-gray-50 p-4 text-sm text-gray-500">
      Sidebar widgets
    </aside>
  );
}

function DesignBlockView({ block, featuredImageUrl }: { block: BuilderBlock; featuredImageUrl: string }) {
  const text = String(block.props.text ?? '');
  const fontSize = Number(block.props.fontSize ?? (block.type === 'heading' ? 40 : 16));

  if (block.type === 'heading') {
    return (
      <h2 className="font-semibold leading-tight text-gray-950" style={{ fontSize }}>
        {text || 'Page heading'}
      </h2>
    );
  }

  if (block.type === 'text') {
    return (
      <p className="leading-7 text-gray-700" style={{ fontSize }}>
        {text || 'Add your text here.'}
      </p>
    );
  }

  if (block.type === 'image') {
    const src = String(block.props.src ?? featuredImageUrl);
    const height = Number(block.props.height ?? 320);
    const borderRadius = Number(block.props.borderRadius ?? 8);
    return src ? (
      <img
        src={src}
        alt={String(block.props.alt ?? '')}
        className="w-full object-cover"
        style={{ height, borderRadius }}
      />
    ) : (
      <div className="flex h-48 items-center justify-center rounded-lg border border-dashed border-gray-300 bg-gray-50 text-sm text-gray-500">
        Choose an image
      </div>
    );
  }

  if (block.type === 'button') {
    return (
      <span className="inline-flex rounded bg-indigo-600 px-5 py-2.5 text-sm font-medium text-white">
        {String(block.props.label ?? 'Learn More')}
      </span>
    );
  }

  if (block.type === 'columns') {
    const columns = Math.min(4, Math.max(2, Number(block.props.columns ?? 2)));
    return (
      <div className="grid gap-3" style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}>
        {Array.from({ length: columns }).map((_, index) => (
          <div key={index} className="rounded border border-dashed border-gray-300 bg-gray-50 p-4 text-center text-sm text-gray-500">
            Column {index + 1}
          </div>
        ))}
      </div>
    );
  }

  if (block.type === 'product-grid') {
    const limit = Math.min(12, Math.max(1, Number(block.props.limit ?? 3)));
    return (
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: Math.min(limit, 3) }).map((_, index) => (
          <div key={index} className="rounded-lg border border-gray-200 bg-white p-3">
            <div className="mb-3 aspect-square rounded bg-gray-100" />
            <p className="text-sm font-medium text-gray-900">Product preview</p>
            <p className="text-xs text-gray-500">Store item</p>
          </div>
        ))}
      </div>
    );
  }

  return <p className="text-sm text-gray-500">Unsupported block</p>;
}

function SaveDesignFooter({ saving, status, error, onSave }: { saving: boolean; status: string; error: string; onSave: () => void }) {
  return (
    <div className="mt-5 space-y-2">
      {status && <p className="rounded bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{status}</p>}
      {error && <p className="rounded bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>}
      <button type="button" onClick={onSave} disabled={saving} className="rounded bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50">
        {saving ? 'Saving design...' : 'Save page layout/design'}
      </button>
    </div>
  );
}
