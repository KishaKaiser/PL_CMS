'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

interface Recording {
  fileName: string;
  format: string;
  sizeBytes: number;
  updatedAt: string;
  url: string;
}

interface Prompt {
  key: string;
  group: 'Calls' | 'Hotline';
  label: string;
  when: string;
  recordingText: string;
  note?: string;
  recording: Recording | null;
}

interface PromptList {
  audioAddressConfigured: boolean;
  addressProblem: string | null;
  note: string;
  prompts: Prompt[];
}

const MAX_BYTES = 5 * 1024 * 1024;

async function readMessage(res: Response, fallback: string): Promise<string> {
  const data = (await res.json().catch(() => ({}))) as { message?: string | string[] };
  if (Array.isArray(data.message)) return data.message.join(' ');
  return data.message ?? fallback;
}

function formatSize(bytes: number): string {
  return bytes >= 1024 * 1024 ? `${(bytes / (1024 * 1024)).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

export default function AdminPhonePromptsPage() {
  const [data, setData] = useState<PromptList | null>(null);
  const [loading, setLoading] = useState(true);
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const fileInputs = useRef<Record<string, HTMLInputElement | null>>({});

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/proxy/admin/phone-prompts');
      if (!res.ok) throw new Error(await readMessage(res, `Could not load the phone lines (HTTP ${res.status}).`));
      setData((await res.json()) as PromptList);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load the phone lines.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function upload(prompt: Prompt, file: File | undefined) {
    if (!file) return;
    setError('');
    setMessage('');
    if (file.size > MAX_BYTES) {
      setError('Recordings can be at most 5 MB.');
      return;
    }

    setBusyKey(prompt.key);
    try {
      const form = new FormData();
      form.append('file', file);
      const res = await fetch(`/api/proxy/admin/phone-prompts/${prompt.key}/audio`, { method: 'POST', body: form });
      if (!res.ok) throw new Error(await readMessage(res, 'Could not upload the recording.'));
      setMessage(`"${prompt.label}" now plays your recording.`);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not upload the recording.');
    } finally {
      setBusyKey(null);
      const input = fileInputs.current[prompt.key];
      if (input) input.value = '';
    }
  }

  async function remove(prompt: Prompt) {
    if (!window.confirm(`Remove the recording for "${prompt.label}"? The computer voice will read this line again.`)) return;
    setBusyKey(prompt.key);
    setError('');
    setMessage('');
    try {
      const res = await fetch(`/api/proxy/admin/phone-prompts/${prompt.key}/audio`, { method: 'DELETE' });
      if (!res.ok) throw new Error(await readMessage(res, 'Could not remove the recording.'));
      setMessage(`"${prompt.label}" goes back to the computer voice.`);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not remove the recording.');
    } finally {
      setBusyKey(null);
    }
  }

  const recorded = data?.prompts.filter((prompt) => prompt.recording).length ?? 0;
  const groups: Array<'Calls' | 'Hotline'> = ['Calls', 'Hotline'];

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="mx-auto max-w-4xl space-y-6">
        <header>
          <h1 className="text-3xl font-bold text-gray-950">Phone prompts</h1>
          <p className="mt-2 text-sm text-gray-600">
            Replace the computer voice with your own recordings. For each line below, record the words shown and upload the MP3 or WAV
            file. A line without a recording is read by the computer voice, so you can do them one at a time.
          </p>
          {data && (
            <p className="mt-2 text-sm text-gray-500">
              {recorded} of {data.prompts.length} lines recorded
            </p>
          )}
        </header>

        {data && data.audioAddressConfigured && data.addressProblem && (
          <div className="rounded border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-800">
            <p className="font-semibold">Recordings are switched off: the address Telnyx would use does not work.</p>
            <p className="mt-1">{data.addressProblem}</p>
            <p className="mt-1">Until it is fixed, callers hear the computer voice. Correct <code className="rounded bg-red-100 px-1">TELNYX_AUDIO_BASE_URL</code> in the API&apos;s environment and update.</p>
          </div>
        )}

        {data && !data.audioAddressConfigured && (
          <div className="rounded border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900">
            <p className="font-semibold">Recordings cannot be played on calls yet.</p>
            <p className="mt-1">
              Telnyx needs this server&apos;s public address to fetch them. Add the setting <code className="rounded bg-amber-100 px-1">TELNYX_AUDIO_BASE_URL</code> to the
              API&apos;s environment, set to the same public address Telnyx uses for the webhook (without the path), then update. You can upload
              recordings now; until then, callers still hear the computer voice.
            </p>
          </div>
        )}

        <div className="rounded border border-gray-200 bg-white px-4 py-3 text-sm text-gray-600">
          <p className="font-medium text-gray-800">Tips for a good recording</p>
          <ul className="mt-1 list-disc space-y-1 pl-5">
            <li>Record in a quiet room, speaking at a normal pace, and say the words exactly as shown so the lines fit together.</li>
            <li>Use MP3 or WAV, up to 5 MB. Short clips with no long silence at the start or end work best on the phone.</li>
            <li>Listen to the result below, then place a test call to hear it as callers do.</li>
            {data && <li>{data.note}</li>}
          </ul>
        </div>

        {error && <div className="rounded border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}
        {message && <div className="rounded border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">{message}</div>}

        {loading ? (
          <p className="text-sm text-gray-500">Loading...</p>
        ) : (
          data &&
          groups.map((group) => (
            <section key={group}>
              <h2 className="mb-3 text-lg font-semibold text-gray-950">{group === 'Calls' ? 'During calls' : 'Dial-in hotline'}</h2>
              <ul className="space-y-3">
                {data.prompts
                  .filter((prompt) => prompt.group === group)
                  .map((prompt) => (
                    <li key={prompt.key} className="rounded border border-gray-200 bg-white p-4">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <h3 className="font-medium text-gray-950">{prompt.label}</h3>
                            <span
                              className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                                prompt.recording ? 'bg-green-50 text-green-700' : 'bg-gray-100 text-gray-600'
                              }`}
                            >
                              {prompt.recording ? 'Your recording' : 'Computer voice'}
                            </span>
                          </div>
                          <p className="mt-1 text-xs text-gray-500">{prompt.when}</p>
                          <p className="mt-2 rounded bg-gray-50 px-3 py-2 text-sm italic text-gray-800">&ldquo;{prompt.recordingText}&rdquo;</p>
                          {prompt.note && <p className="mt-1 text-xs text-gray-500">{prompt.note}</p>}
                        </div>
                      </div>

                      <div className="mt-3 flex flex-wrap items-center gap-3">
                        {prompt.recording && (
                          <>
                            <audio controls preload="none" src={prompt.recording.url} className="h-9" />
                            <span className="text-xs text-gray-500">
                              {prompt.recording.fileName} · {formatSize(prompt.recording.sizeBytes)} · {new Date(prompt.recording.updatedAt).toLocaleDateString()}
                            </span>
                          </>
                        )}
                        <label
                          className={`cursor-pointer rounded border border-gray-300 px-3 py-1.5 text-xs font-medium hover:bg-gray-50 ${
                            busyKey === prompt.key ? 'pointer-events-none opacity-50' : ''
                          }`}
                        >
                          {busyKey === prompt.key ? 'Working...' : prompt.recording ? 'Replace recording' : 'Upload recording'}
                          <input
                            ref={(element) => {
                              fileInputs.current[prompt.key] = element;
                            }}
                            type="file"
                            accept=".mp3,.wav,audio/mpeg,audio/wav,audio/x-wav"
                            className="hidden"
                            onChange={(event) => void upload(prompt, event.target.files?.[0])}
                          />
                        </label>
                        {prompt.recording && (
                          <button
                            type="button"
                            disabled={busyKey === prompt.key}
                            onClick={() => void remove(prompt)}
                            className="rounded border border-red-300 px-3 py-1.5 text-xs font-medium text-red-700 hover:bg-red-50 disabled:opacity-50"
                          >
                            Remove
                          </button>
                        )}
                      </div>
                    </li>
                  ))}
              </ul>
            </section>
          ))
        )}
      </div>
    </div>
  );
}
