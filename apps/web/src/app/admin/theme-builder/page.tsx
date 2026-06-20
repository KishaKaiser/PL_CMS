'use client';

import type { ReactNode } from 'react';
import { ChangeEvent, FormEvent, useCallback, useEffect, useMemo, useState } from 'react';

type BuilderBlockType = 'heading' | 'text' | 'image' | 'button' | 'columns' | 'global';
type ResponsiveMode = 'desktop' | 'tablet' | 'mobile';

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
  sections: BuilderSection[];
}

interface PageOption {
  id: string;
  title: string;
  slug: string;
}

interface BuilderTemplate {
  id: string;
  name: string;
  description?: string | null;
  category: string;
  schemaJson: BuilderLayout;
  assignmentRules?: Record<string, unknown>;
}

interface GlobalComponent {
  id: string;
  name: string;
  componentType: string;
  schemaJson: BuilderBlock;
}

interface CmsTheme {
  id: string;
  name: string;
  slug: string;
  version: string;
  description?: string | null;
  isActive: boolean;
  globalStyles: Record<string, unknown>;
  templates: Record<string, unknown>;
  components: Record<string, unknown>;
  widgetRegistry: string[];
  schemaJson: Record<string, unknown>;
  assets: Array<{ id: string; assetType: string; path: string; content?: string | null }>;
}

const emptyLayout: BuilderLayout = {
  version: 1,
  type: 'page',
  sections: [
    {
      id: 'section-hero',
      type: 'section',
      settings: { layout: 'contained', background: '#ffffff', padding: '48px 24px' },
      blocks: [
        { id: 'heading-1', type: 'heading', props: { text: 'Design visually', level: 1, align: 'left' } },
        { id: 'text-1', type: 'text', props: { text: 'Drag blocks, edit settings, and save reusable templates.' } },
      ],
    },
  ],
};

interface BuilderWidget {
  id?: string;
  type: BuilderBlockType;
  label: string;
  category?: string | null;
  pluginName?: string | null;
  defaultJson?: BuilderBlock;
  enabled: boolean;
}

const fallbackWidgets: BuilderWidget[] = [
  { type: 'heading', label: 'Heading', category: 'content', enabled: true },
  { type: 'text', label: 'Text', category: 'content', enabled: true },
  { type: 'image', label: 'Image', category: 'media', enabled: true },
  { type: 'button', label: 'Button', category: 'content', enabled: true },
  { type: 'columns', label: 'Columns', category: 'layout', enabled: true },
];

export default function ThemeBuilderPage() {
  const [pages, setPages] = useState<PageOption[]>([]);
  const [templates, setTemplates] = useState<BuilderTemplate[]>([]);
  const [components, setComponents] = useState<GlobalComponent[]>([]);
  const [themes, setThemes] = useState<CmsTheme[]>([]);
  const [widgets, setWidgets] = useState<BuilderWidget[]>(fallbackWidgets);
  const [selectedPageId, setSelectedPageId] = useState('');
  const [layout, setLayout] = useState<BuilderLayout>(emptyLayout);
  const [selectedBlockId, setSelectedBlockId] = useState('');
  const [templateName, setTemplateName] = useState('');
  const [templateRules, setTemplateRules] = useState('{"pageType":"page"}');
  const [componentName, setComponentName] = useState('');
  const [responsiveMode, setResponsiveMode] = useState<ResponsiveMode>('desktop');
  const [themeForm, setThemeForm] = useState({
    name: '',
    slug: '',
    version: '1.0.0',
    primaryColor: '#4f46e5',
    accentColor: '#0f766e',
    fontFamily: 'Inter, sans-serif',
  });
  const [assetForm, setAssetForm] = useState({ themeId: '', path: 'theme.css', content: '' });
  const [dragBlockId, setDragBlockId] = useState('');
  const [error, setError] = useState('');
  const [status, setStatus] = useState('');

  const selectedBlock = useMemo(
    () => layout.sections.flatMap((section) => section.blocks).find((block) => block.id === selectedBlockId),
    [layout, selectedBlockId],
  );
  const enabledWidgets = useMemo(() => widgets.filter((widget) => widget.enabled), [widgets]);
  const activeTheme = useMemo(() => themes.find((theme) => theme.isActive) ?? null, [themes]);
  const previewTheme = useMemo(() => getThemePreviewStyles(activeTheme, themeForm), [activeTheme, themeForm]);

  const fetchResources = useCallback(async () => {
    setError('');
    try {
      const [pagesRes, templatesRes, componentsRes, themesRes, widgetsRes] = await Promise.all([
        fetch('/api/proxy/pages'),
        fetch('/api/proxy/admin/builder/templates'),
        fetch('/api/proxy/admin/builder/components'),
        fetch('/api/proxy/admin/builder/themes'),
        fetch('/api/proxy/admin/builder/widgets'),
      ]);
      if (!pagesRes.ok) throw new Error('Unable to load pages');
      if (!templatesRes.ok) throw new Error('Unable to load templates');
      if (!componentsRes.ok) throw new Error('Unable to load global components');
      if (!themesRes.ok) throw new Error('Unable to load themes');
      if (!widgetsRes.ok) throw new Error('Unable to load widget registry');
      const nextPages = (await pagesRes.json()) as PageOption[];
      const nextWidgets = (await widgetsRes.json()) as BuilderWidget[];
      setPages(nextPages);
      setTemplates((await templatesRes.json()) as BuilderTemplate[]);
      setComponents((await componentsRes.json()) as GlobalComponent[]);
      setThemes((await themesRes.json()) as CmsTheme[]);
      setWidgets(nextWidgets.length > 0 ? nextWidgets : fallbackWidgets);
      if (!selectedPageId && nextPages[0]) setSelectedPageId(nextPages[0].id);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Error loading builder');
    }
  }, [selectedPageId]);

  const fetchLayout = useCallback(async (pageId: string) => {
    if (!pageId) return;
    setError('');
    try {
      const res = await fetch(`/api/proxy/admin/builder/layouts/page/${pageId}`);
      if (!res.ok) throw new Error('Unable to load builder layout');
      const data = (await res.json()) as { draftJson?: BuilderLayout };
      setLayout(normalizeLayout(data.draftJson));
      setSelectedBlockId('');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Error loading layout');
    }
  }, []);

  useEffect(() => {
    void fetchResources();
  }, [fetchResources]);

  useEffect(() => {
    void fetchLayout(selectedPageId);
  }, [fetchLayout, selectedPageId]);

  async function saveLayout(publish = false) {
    if (!selectedPageId) {
      setError('Choose a page first.');
      return;
    }
    setError('');
    setStatus('');
    try {
      const res = await fetch('/api/proxy/admin/builder/layouts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ entityType: 'page', entityId: selectedPageId, layout }),
      });
      if (!res.ok) throw new Error('Unable to save layout');
      if (publish) {
        const publishRes = await fetch(`/api/proxy/admin/builder/layouts/page/${selectedPageId}/publish`, {
          method: 'POST',
        });
        if (!publishRes.ok) throw new Error('Unable to publish layout');
      }
      setStatus(publish ? 'Layout published.' : 'Draft layout saved.');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Error saving layout');
    }
  }

  function addSection() {
    setLayout((current) => ({
      ...current,
      sections: [
        ...current.sections,
        {
          id: createId('section'),
          type: 'section',
          settings: { layout: 'contained', background: '#ffffff', padding: '40px 24px' },
          blocks: [],
        },
      ],
    }));
  }

  function addBlock(type: BuilderBlockType, sectionId: string) {
    const block = createBlock(type, widgets.find((widget) => widget.type === type));
    setLayout((current) => ({
      ...current,
      sections: current.sections.map((section) =>
        section.id === sectionId ? { ...section, blocks: [...section.blocks, block] } : section,
      ),
    }));
    setSelectedBlockId(block.id);
  }

  function updateBlock(blockId: string, props: Record<string, unknown>) {
    setLayout((current) => ({
      ...current,
      sections: current.sections.map((section) => ({
        ...section,
        blocks: section.blocks.map((block) =>
          block.id === blockId ? { ...block, props: { ...block.props, ...props } } : block,
        ),
      })),
    }));
  }

  function removeBlock(blockId: string) {
    setLayout((current) => ({
      ...current,
      sections: current.sections.map((section) => ({
        ...section,
        blocks: section.blocks.filter((block) => block.id !== blockId),
      })),
    }));
    setSelectedBlockId('');
  }

  function moveBlock(targetSectionId: string, targetIndex: number) {
    if (!dragBlockId) return;
    const dragged = layout.sections.flatMap((section) => section.blocks).find((block) => block.id === dragBlockId);
    if (!dragged) return;
    setLayout((current) => ({
      ...current,
      sections: current.sections.map((section) => {
        const withoutDragged = section.blocks.filter((block) => block.id !== dragBlockId);
        if (section.id !== targetSectionId) return { ...section, blocks: withoutDragged };
        const nextBlocks = [...withoutDragged];
        nextBlocks.splice(targetIndex, 0, dragged);
        return { ...section, blocks: nextBlocks };
      }),
    }));
    setDragBlockId('');
  }

  async function saveTemplate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!templateName.trim()) return;
    await postBuilder('templates', {
      name: templateName,
      category: 'page',
      schemaJson: layout,
      assignmentRules: parseJsonObject(templateRules),
    }, 'Template saved.');
    setTemplateName('');
  }

  async function saveGlobalComponent(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!componentName.trim() || !selectedBlock) return;
    await postBuilder('components', {
      name: componentName,
      componentType: selectedBlock.type,
      schemaJson: selectedBlock,
    }, 'Global component saved.');
    setComponentName('');
  }

  async function createTheme(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await postBuilder('themes', {
      name: themeForm.name,
      slug: themeForm.slug,
      version: themeForm.version,
      globalStyles: {
        primaryColor: themeForm.primaryColor,
        accentColor: themeForm.accentColor,
        fontFamily: themeForm.fontFamily,
      },
      templates: {
        header: layout.sections[0] ?? null,
        footer: null,
        pageTypes: { page: layout },
      },
      components: { widgets: widgets.map((widget) => widget.type) },
      widgetRegistry: widgets.filter((widget) => widget.enabled).map((widget) => widget.type),
      schemaJson: { builderVersion: 1, supports: ['sections', 'blocks', 'nested-components'] },
    }, 'Theme created and activated.');
    setThemeForm({ name: '', slug: '', version: '1.0.0', primaryColor: '#4f46e5', accentColor: '#0f766e', fontFamily: 'Inter, sans-serif' });
  }

  async function saveThemeAsset(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const theme = themes.find((item) => item.id === assetForm.themeId);
    if (!theme) return;
    await postBuilder(`themes/${theme.id}/assets`, {
      assets: [
        ...theme.assets.map((asset) => ({
          assetType: asset.assetType,
          path: asset.path,
          content: asset.content ?? '',
        })),
        {
          assetType: assetForm.path.endsWith('.js') ? 'js' : assetForm.path.endsWith('.css') ? 'css' : 'asset',
          path: assetForm.path,
          content: assetForm.content,
        },
      ],
    }, 'Theme asset saved.');
    setAssetForm({ themeId: assetForm.themeId, path: 'theme.css', content: '' });
  }

  async function postBuilder(path: string, body: unknown, successMessage: string) {
    setError('');
    setStatus('');
    try {
      const res = await fetch(`/api/proxy/admin/builder/${path}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error(successMessage.replace(' saved.', ' could not be saved.'));
      setStatus(successMessage);
      await fetchResources();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Save failed');
    }
  }

  function exportLayoutJson() {
    downloadFile('builder-layout.json', JSON.stringify(layout, null, 2), 'application/json');
  }

  async function exportTemplate(id: string) {
    const res = await fetch(`/api/proxy/admin/builder/templates/${id}/export`);
    downloadFile('builder-template.json', JSON.stringify(await res.json(), null, 2), 'application/json');
  }

  async function exportTheme(id: string) {
    const res = await fetch(`/api/proxy/admin/builder/themes/${id}/export`);
    const blob = await res.blob();
    downloadBlob('theme.zip', blob);
  }

  async function importTemplate(event: ChangeEvent<HTMLInputElement>) {
    await uploadFile(event, '/api/proxy/admin/builder/templates/import', 'Template imported.');
  }

  async function importTheme(event: ChangeEvent<HTMLInputElement>) {
    await uploadFile(event, '/api/proxy/admin/builder/themes/import', 'Theme imported.');
  }

  async function importLayout(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    setLayout(normalizeLayout(JSON.parse(await file.text())));
    setStatus('Layout JSON loaded into the canvas.');
    event.target.value = '';
  }

  async function assignSelectedTemplate(templateId: string) {
    if (!selectedPageId) {
      setError('Choose a page first.');
      return;
    }
    await postBuilder(`pages/${selectedPageId}/design`, { builderTemplateId: templateId }, 'Template assigned to page.');
  }

  async function uploadFile(event: ChangeEvent<HTMLInputElement>, path: string, successMessage: string) {
    const file = event.target.files?.[0];
    if (!file) return;
    const body = new FormData();
    body.append('file', file);
    setError('');
    try {
      const res = await fetch(path, { method: 'POST', body });
      if (!res.ok) throw new Error('Import failed');
      setStatus(successMessage);
      await fetchResources();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Import failed');
    } finally {
      event.target.value = '';
    }
  }

  return (
    <main className="p-6">
      <div className="mb-6 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-3xl font-bold">Theme Builder</h1>
          <p className="mt-1 text-sm text-gray-600">
            Build site-wide themes, visual page layouts, reusable templates, global components, and packaged theme ZIPs.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {(['desktop', 'tablet', 'mobile'] as ResponsiveMode[]).map((mode) => (
            <button
              key={mode}
              type="button"
              onClick={() => setResponsiveMode(mode)}
              className={`rounded border px-3 py-2 text-sm capitalize hover:bg-gray-50 ${
                responsiveMode === mode ? 'border-indigo-500 bg-indigo-50 text-indigo-700' : ''
              }`}
            >
              {mode}
            </button>
          ))}
          <button onClick={() => void saveLayout(false)} className="rounded border px-3 py-2 text-sm hover:bg-gray-50">
            Save Draft
          </button>
          <button onClick={() => void saveLayout(true)} className="rounded bg-indigo-600 px-3 py-2 text-sm text-white hover:bg-indigo-700">
            Publish Layout
          </button>
          <button onClick={exportLayoutJson} className="rounded border px-3 py-2 text-sm hover:bg-gray-50">
            Export JSON
          </button>
          <label className="cursor-pointer rounded border px-3 py-2 text-sm hover:bg-gray-50">
            Import JSON
            <input type="file" accept="application/json,.json" onChange={importLayout} className="hidden" />
          </label>
        </div>
      </div>

      {error && <p className="mb-4 rounded bg-red-50 px-4 py-3 text-sm text-red-600">{error}</p>}
      {status && <p className="mb-4 rounded bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{status}</p>}

      <div className="grid gap-5 xl:grid-cols-[260px_minmax(720px,1fr)_320px]">
        <aside className="space-y-4">
          <Panel title="Active Theme">
            {activeTheme ? (
              <div className="space-y-2 text-sm">
                <div className="font-medium">{activeTheme.name}</div>
                <div className="text-xs text-gray-500">{activeTheme.slug} · {activeTheme.version}</div>
                <div className="flex gap-2">
                  <span className="h-6 w-6 rounded border" style={{ backgroundColor: previewTheme.primaryColor }} />
                  <span className="h-6 w-6 rounded border" style={{ backgroundColor: previewTheme.accentColor }} />
                </div>
              </div>
            ) : (
              <p className="text-sm text-gray-500">No active theme yet. Create one or run migrations to install the default theme.</p>
            )}
          </Panel>

          <Panel title="Page">
            <select
              value={selectedPageId}
              onChange={(event) => setSelectedPageId(event.target.value)}
              className="w-full rounded border px-3 py-2 text-sm"
            >
              {pages.map((page) => (
                <option key={page.id} value={page.id}>{page.title}</option>
              ))}
            </select>
          </Panel>

          <Panel title="Widgets">
            <div className="space-y-2">
              {enabledWidgets.map((widget) => (
                <button
                  key={widget.type}
                  type="button"
                  onClick={() => addBlock(widget.type, layout.sections[0]?.id ?? '')}
                  className="block w-full rounded border px-3 py-2 text-left text-sm hover:bg-gray-50"
                  disabled={layout.sections.length === 0}
                >
                  <span className="block font-medium">{widget.label}</span>
                  <span className="block text-xs text-gray-500">{widget.pluginName ?? widget.category ?? 'core'}</span>
                </button>
              ))}
            </div>
            <button onClick={addSection} className="mt-3 w-full rounded bg-gray-900 px-3 py-2 text-sm text-white">
              Add Section
            </button>
          </Panel>

          <Panel title="Templates">
            <form onSubmit={saveTemplate} className="space-y-2">
              <input
                value={templateName}
                onChange={(event) => setTemplateName(event.target.value)}
                placeholder="Template name"
                className="w-full rounded border px-3 py-2 text-sm"
              />
              <textarea
                value={templateRules}
                onChange={(event) => setTemplateRules(event.target.value)}
                rows={3}
                className="w-full rounded border px-3 py-2 font-mono text-xs"
              />
              <button className="rounded bg-indigo-600 px-3 py-2 text-sm text-white">Save Template</button>
            </form>
            <label className="mt-3 block cursor-pointer rounded border px-3 py-2 text-sm hover:bg-gray-50">
              Import Template JSON
              <input type="file" accept=".json,application/json" onChange={importTemplate} className="hidden" />
            </label>
            <div className="mt-3 space-y-2">
              {templates.map((template) => (
                <div key={template.id} className="rounded border p-2 text-sm">
                  <div className="font-medium">{template.name}</div>
                  <div className="mt-2 flex gap-2">
                    <button onClick={() => setLayout(normalizeLayout(template.schemaJson))} className="text-indigo-600 hover:underline">
                      Load
                    </button>
                    <button onClick={() => void exportTemplate(template.id)} className="text-indigo-600 hover:underline">
                      Export
                    </button>
                    <button onClick={() => void assignSelectedTemplate(template.id)} className="text-indigo-600 hover:underline">
                      Assign
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </Panel>
        </aside>

        <section className="space-y-4">
          <Panel title="Canvas">
            <div className="space-y-4">
              {layout.sections.map((section) => (
                <div
                  key={section.id}
                  className="rounded border border-dashed bg-gray-50 p-4"
                  onDragOver={(event) => event.preventDefault()}
                  onDrop={() => moveBlock(section.id, section.blocks.length)}
                >
                  <div className="mb-3 flex items-center justify-between">
                    <span className="text-xs font-semibold uppercase text-gray-500">{section.id}</span>
                    <div className="flex gap-2">
                      {enabledWidgets.map((widget) => (
                        <button key={widget.type} onClick={() => addBlock(widget.type, section.id)} className="rounded border px-2 py-1 text-xs">
                          + {widget.label}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="space-y-2">
                    {section.blocks.map((block, index) => (
                      <div
                        key={block.id}
                        draggable
                        onDragStart={() => setDragBlockId(block.id)}
                        onDragOver={(event) => event.preventDefault()}
                        onDrop={(event) => {
                          event.preventDefault();
                          moveBlock(section.id, index);
                        }}
                        onClick={() => setSelectedBlockId(block.id)}
                        className={`cursor-move rounded border bg-white p-3 text-sm shadow-sm ${
                          selectedBlockId === block.id ? 'border-indigo-500 ring-2 ring-indigo-100' : ''
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-medium">{block.type}</span>
                          <button onClick={(event) => { event.stopPropagation(); removeBlock(block.id); }} className="text-xs text-red-600">
                            Remove
                          </button>
                        </div>
                        <div className="mt-1 text-xs text-gray-500">{block.id}</div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </Panel>

          <Panel title="Live Preview">
            <div className="mx-auto transition-all" style={{ maxWidth: responsiveWidth(responsiveMode) }}>
              <BuilderPreview layout={layout} components={components} theme={previewTheme} />
            </div>
          </Panel>
        </section>

        <aside className="space-y-4">
          <Panel title="Block Settings">
            {selectedBlock ? (
              <BlockEditor block={selectedBlock} onChange={(props) => updateBlock(selectedBlock.id, props)} />
            ) : (
              <p className="text-sm text-gray-500">Select a block on the canvas.</p>
            )}
            <form onSubmit={saveGlobalComponent} className="mt-4 space-y-2 border-t pt-4">
              <input
                value={componentName}
                onChange={(event) => setComponentName(event.target.value)}
                placeholder="Reusable block name"
                className="w-full rounded border px-3 py-2 text-sm"
              />
              <button disabled={!selectedBlock} className="rounded bg-indigo-600 px-3 py-2 text-sm text-white disabled:opacity-50">
                Save Global Block
              </button>
            </form>
          </Panel>

          <Panel title="Theme Builder">
            <form onSubmit={createTheme} className="space-y-2">
              <input value={themeForm.name} onChange={(event) => setThemeForm((current) => ({ ...current, name: event.target.value }))} placeholder="Theme name" className="w-full rounded border px-3 py-2 text-sm" />
              <input value={themeForm.slug} onChange={(event) => setThemeForm((current) => ({ ...current, slug: event.target.value }))} placeholder="theme-slug" className="w-full rounded border px-3 py-2 text-sm" />
              <input value={themeForm.version} onChange={(event) => setThemeForm((current) => ({ ...current, version: event.target.value }))} placeholder="1.0.0" className="w-full rounded border px-3 py-2 text-sm" />
              <div className="grid grid-cols-2 gap-2">
                <label className="text-xs font-medium text-gray-600">
                  Primary
                  <input type="color" value={themeForm.primaryColor} onChange={(event) => setThemeForm((current) => ({ ...current, primaryColor: event.target.value }))} className="mt-1 h-10 w-full rounded border" />
                </label>
                <label className="text-xs font-medium text-gray-600">
                  Accent
                  <input type="color" value={themeForm.accentColor} onChange={(event) => setThemeForm((current) => ({ ...current, accentColor: event.target.value }))} className="mt-1 h-10 w-full rounded border" />
                </label>
              </div>
              <input value={themeForm.fontFamily} onChange={(event) => setThemeForm((current) => ({ ...current, fontFamily: event.target.value }))} placeholder="Font family" className="w-full rounded border px-3 py-2 text-sm" />
              <button className="rounded bg-gray-900 px-3 py-2 text-sm text-white">Create & Activate Theme</button>
            </form>
            <label className="mt-3 block cursor-pointer rounded border px-3 py-2 text-sm hover:bg-gray-50">
              Import Theme ZIP
              <input type="file" accept=".zip,application/zip" onChange={importTheme} className="hidden" />
            </label>
          </Panel>

          <Panel title="Site Themes & Assets">
            <div className="space-y-2">
              {themes.map((theme) => (
                <div key={theme.id} className="rounded border p-2 text-sm">
                  <div className="flex items-center justify-between gap-2">
                    <div>
                      <div className="font-medium">{theme.name}</div>
                      <div className="text-xs text-gray-500">{theme.slug} · {theme.version}</div>
                    </div>
                    {theme.isActive && <span className="rounded-full bg-emerald-50 px-2 py-1 text-xs text-emerald-700">Active</span>}
                  </div>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {!theme.isActive && (
                      <button onClick={() => void postBuilder(`themes/${theme.id}/activate`, {}, 'Theme activated for the site.')} className="text-indigo-600 hover:underline">
                        Activate Site Theme
                      </button>
                    )}
                    <button onClick={() => void exportTheme(theme.id)} className="text-indigo-600 hover:underline">
                      Export ZIP
                    </button>
                    <button onClick={() => setAssetForm((current) => ({ ...current, themeId: theme.id }))} className="text-indigo-600 hover:underline">
                      Add Asset
                    </button>
                  </div>
                  {(theme.widgetRegistry ?? []).length > 0 && (
                    <div className="mt-2 text-xs text-gray-500">
                      Widgets: {(theme.widgetRegistry ?? []).join(', ')}
                    </div>
                  )}
                  {theme.assets.length > 0 && (
                    <div className="mt-2 text-xs text-gray-500">
                      {theme.assets.map((asset) => asset.path).join(', ')}
                    </div>
                  )}
                </div>
              ))}
            </div>
            <form onSubmit={saveThemeAsset} className="mt-4 space-y-2 border-t pt-4">
              <select value={assetForm.themeId} onChange={(event) => setAssetForm((current) => ({ ...current, themeId: event.target.value }))} className="w-full rounded border px-3 py-2 text-sm">
                <option value="">Choose theme</option>
                {themes.map((theme) => <option key={theme.id} value={theme.id}>{theme.name}</option>)}
              </select>
              <input value={assetForm.path} onChange={(event) => setAssetForm((current) => ({ ...current, path: event.target.value }))} className="w-full rounded border px-3 py-2 text-sm" />
              <textarea value={assetForm.content} onChange={(event) => setAssetForm((current) => ({ ...current, content: event.target.value }))} rows={5} className="w-full rounded border px-3 py-2 font-mono text-xs" />
              <button disabled={!assetForm.themeId} className="rounded bg-indigo-600 px-3 py-2 text-sm text-white disabled:opacity-50">
                Save Asset
              </button>
            </form>
          </Panel>
        </aside>
      </div>
    </main>
  );
}

function Panel({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="rounded-lg border bg-white p-4 shadow-sm">
      <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-gray-600">{title}</h2>
      {children}
    </section>
  );
}

function BlockEditor({ block, onChange }: { block: BuilderBlock; onChange: (props: Record<string, unknown>) => void }) {
  const text = String(block.props.text ?? block.props.label ?? '');
  const href = String(block.props.href ?? '');
  const imageUrl = String(block.props.src ?? '');
  return (
    <div className="space-y-3">
      <div className="rounded bg-gray-50 px-3 py-2 text-xs text-gray-500">{block.type}</div>
      {['heading', 'text', 'button'].includes(block.type) && (
        <label className="block text-sm font-medium text-gray-700">
          Text
          <textarea
            value={text}
            rows={3}
            onChange={(event) => onChange(block.type === 'button' ? { label: event.target.value } : { text: event.target.value })}
            className="mt-1 w-full rounded border px-3 py-2 text-sm"
          />
        </label>
      )}
      {block.type === 'image' && (
        <label className="block text-sm font-medium text-gray-700">
          Image URL
          <input value={imageUrl} onChange={(event) => onChange({ src: event.target.value })} className="mt-1 w-full rounded border px-3 py-2 text-sm" />
        </label>
      )}
      {block.type === 'button' && (
        <label className="block text-sm font-medium text-gray-700">
          Link
          <input value={href} onChange={(event) => onChange({ href: event.target.value })} className="mt-1 w-full rounded border px-3 py-2 text-sm" />
        </label>
      )}
    </div>
  );
}

type ThemePreviewStyles = {
  primaryColor: string;
  accentColor: string;
  fontFamily: string;
};

function BuilderPreview({ layout, components, theme }: { layout: BuilderLayout; components: GlobalComponent[]; theme: ThemePreviewStyles }) {
  return (
    <div className="min-h-[560px] overflow-hidden rounded border bg-white shadow-sm" style={{ fontFamily: theme.fontFamily }}>
      {layout.sections.map((section) => (
        <section key={section.id} style={{ background: section.settings.background, padding: section.settings.padding }}>
          <div className={section.settings.layout === 'full' ? '' : 'mx-auto max-w-4xl'}>
            {section.blocks.map((block) => (
              <PreviewBlock key={block.id} block={block} components={components} theme={theme} />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}

function PreviewBlock({ block, components, theme }: { block: BuilderBlock; components: GlobalComponent[]; theme: ThemePreviewStyles }) {
  if (block.type === 'heading') {
    return <h1 className="mb-3 text-4xl font-bold" style={{ color: theme.primaryColor }}>{String(block.props.text ?? 'Heading')}</h1>;
  }
  if (block.type === 'text') {
    return <p className="mb-4 text-gray-700">{String(block.props.text ?? 'Text block')}</p>;
  }
  if (block.type === 'image') {
    const src = String(block.props.src ?? '');
    return src ? <img src={src} alt="" className="mb-4 max-h-80 w-full rounded object-cover" /> : <div className="mb-4 rounded bg-gray-100 p-8 text-center text-sm text-gray-500">Image</div>;
  }
  if (block.type === 'button') {
    return <a href={String(block.props.href ?? '#')} className="mb-4 inline-block rounded px-4 py-2 text-white" style={{ backgroundColor: theme.primaryColor }}>{String(block.props.label ?? 'Button')}</a>;
  }
  if (block.type === 'global') {
    const component = components.find((item) => item.id === block.props.componentId);
    return component ? <PreviewBlock block={component.schemaJson} components={components} theme={theme} /> : <div className="rounded border p-3 text-sm text-gray-500">Global component</div>;
  }
  return <div className="mb-4 grid gap-3 md:grid-cols-2"><div className="rounded bg-gray-100 p-4">Column</div><div className="rounded bg-gray-100 p-4">Column</div></div>;
}

function createBlock(type: BuilderBlockType, widget?: BuilderWidget): BuilderBlock {
  const id = createId(type);
  if (widget?.defaultJson) {
    return { ...JSON.parse(JSON.stringify(widget.defaultJson)), id, type };
  }
  if (type === 'heading') return { id, type, props: { text: 'New Heading', level: 2 } };
  if (type === 'text') return { id, type, props: { text: 'New text block.' } };
  if (type === 'image') return { id, type, props: { src: '', alt: '' } };
  if (type === 'button') return { id, type, props: { label: 'Learn More', href: '#' } };
  if (type === 'columns') return { id, type, props: { columns: 2 }, children: [] };
  return { id, type: 'global', props: {} };
}

function normalizeLayout(value: unknown): BuilderLayout {
  if (!value || typeof value !== 'object') return emptyLayout;
  const candidate = value as Partial<BuilderLayout>;
  return {
    version: candidate.version ?? 1,
    type: candidate.type ?? 'page',
    sections: Array.isArray(candidate.sections) ? candidate.sections : emptyLayout.sections,
  };
}

function createId(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function responsiveWidth(mode: ResponsiveMode) {
  if (mode === 'mobile') return '390px';
  if (mode === 'tablet') return '768px';
  return '100%';
}

function getThemePreviewStyles(
  activeTheme: CmsTheme | null,
  themeForm: { primaryColor: string; accentColor: string; fontFamily: string },
): ThemePreviewStyles {
  const globalStyles = activeTheme?.globalStyles ?? {};
  return {
    primaryColor: getStringStyle(globalStyles.primaryColor, themeForm.primaryColor),
    accentColor: getStringStyle(globalStyles.accentColor, themeForm.accentColor),
    fontFamily: getStringStyle(globalStyles.fontFamily, themeForm.fontFamily),
  };
}

function getStringStyle(value: unknown, fallback: string) {
  return typeof value === 'string' && value.trim() ? value : fallback;
}

function parseJsonObject(value: string) {
  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

function downloadFile(filename: string, content: string, type: string) {
  downloadBlob(filename, new Blob([content], { type }));
}

function downloadBlob(filename: string, blob: Blob) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}
