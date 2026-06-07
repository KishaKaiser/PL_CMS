'use client';

import { useEffect, useRef, useState } from 'react';

type Props = {
  value: string;
  onChange: (value: string) => void;
};

type ToolbarButton = {
  label: string;
  command?: string;
  value?: string;
  action?: () => void;
};

export function RichTextEditor({ value, onChange }: Props) {
  const editorRef = useRef<HTMLDivElement>(null);
  const [mode, setMode] = useState<'visual' | 'html'>('visual');

  useEffect(() => {
    if (editorRef.current && editorRef.current.innerHTML !== value) {
      editorRef.current.innerHTML = value;
    }
  }, [value]);

  function syncValue() {
    onChange(editorRef.current?.innerHTML ?? '');
  }

  function applyCommand(command: string, commandValue?: string) {
    editorRef.current?.focus();
    document.execCommand(command, false, commandValue);
    syncValue();
  }

  const buttons: ToolbarButton[] = [
    { label: 'Paragraph', command: 'formatBlock', value: 'p' },
    { label: 'Heading', command: 'formatBlock', value: 'h2' },
    { label: 'Bold', command: 'bold' },
    { label: 'Italic', command: 'italic' },
    { label: 'Quote', command: 'formatBlock', value: 'blockquote' },
    { label: 'Bullets', command: 'insertUnorderedList' },
    { label: 'Numbers', command: 'insertOrderedList' },
    {
      label: 'Link',
      action: () => {
        const url = window.prompt('Enter a URL');
        if (url) applyCommand('createLink', url);
      },
    },
    { label: 'Undo', command: 'undo' },
    { label: 'Redo', command: 'redo' },
  ];

  return (
    <div className="overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-200 bg-gray-50 px-3 py-2">
        <div className="flex flex-wrap gap-2">
          {buttons.map((button) => (
            <button
              key={button.label}
              type="button"
              onMouseDown={(event) => {
                event.preventDefault();
                if (button.action) {
                  button.action();
                  return;
                }
                if (button.command) applyCommand(button.command, button.value);
              }}
              className="rounded border border-gray-200 bg-white px-2.5 py-1 text-xs font-medium text-gray-700 hover:bg-gray-100"
            >
              {button.label}
            </button>
          ))}
        </div>

        <div className="flex rounded border border-gray-200 bg-white p-1 text-xs font-medium">
          <button
            type="button"
            onClick={() => setMode('visual')}
            className={`rounded px-2 py-1 ${mode === 'visual' ? 'bg-indigo-600 text-white' : 'text-gray-600'}`}
          >
            Visual
          </button>
          <button
            type="button"
            onClick={() => setMode('html')}
            className={`rounded px-2 py-1 ${mode === 'html' ? 'bg-indigo-600 text-white' : 'text-gray-600'}`}
          >
            HTML
          </button>
        </div>
      </div>

      {mode === 'visual' ? (
        <div
          ref={editorRef}
          contentEditable
          suppressContentEditableWarning
          onInput={syncValue}
          className="min-h-[320px] px-4 py-3 text-sm text-gray-800 outline-none [&_blockquote]:border-l-4 [&_blockquote]:border-gray-300 [&_blockquote]:pl-4 [&_blockquote]:italic [&_h2]:mb-3 [&_h2]:mt-4 [&_h2]:text-2xl [&_h2]:font-semibold [&_li]:ml-5 [&_ol]:list-decimal [&_p]:mb-3 [&_ul]:list-disc"
        />
      ) : (
        <textarea
          value={value}
          onChange={(event) => onChange(event.target.value)}
          rows={16}
          className="min-h-[320px] w-full resize-y border-0 px-4 py-3 font-mono text-sm text-gray-800 outline-none"
        />
      )}
    </div>
  );
}
