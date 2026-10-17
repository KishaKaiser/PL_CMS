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

interface VoiceInfo {
  voice: string;
  source: 'admin' | 'environment' | 'default';
  chosen: string | null;
  fellBack: boolean;
}

interface PromptList {
  voice: VoiceInfo;
  audioAddressConfigured: boolean;
  addressProblem: string | null;
  addressNote: string | null;
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
  const [voiceInput, setVoiceInput] = useState('');
  const [testPhone, setTestPhone] = useState('');
  const [voiceBusy, setVoiceBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/proxy/admin/phone-prompts');
      if (!res.ok) throw new Error(await readMessage(res, `Could not load the phone lines (HTTP ${res.status}).`));
      const next = (await res.json()) as PromptList;
      setData(next);
      setVoiceInput((current) => (current === '' ? next.voice.chosen ?? '' : current));
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

  async function saveVoice(voice: string) {
    setVoiceBusy(true);
    setError('');
    setMessage('');
    try {
      const res = await fetch('/api/proxy/admin/phone-prompts/voice', {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ voice }),
      });
      if (!res.ok) throw new Error(await readMessage(res, 'Could not save the voice.'));
      setMessage(voice.trim() ? 'The computer voice was saved. New calls use it.' : 'Back to the default computer voice.');
      if (!voice.trim()) setVoiceInput('');
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save the voice.');
    } finally {
      setVoiceBusy(false);
    }
  }

  async function testVoice() {
    setVoiceBusy(true);
    setError('');
    setMessage('');
    try {
      const res = await fetch('/api/proxy/admin/phone-prompts/voice/test', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ phoneNumber: testPhone, voice: voiceInput }),
      });
      if (!res.ok) throw new Error(await readMessage(res, 'Could not place the test call.'));
      setMessage('Calling you now. Answer to hear a sample in this voice.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not place the test call.');
    } finally {
      setVoiceBusy(false);
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

        {data && data.audioAddressConfigured && !data.addressProblem && data.addressNote && (
          <div className="rounded border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-900">{data.addressNote}</div>
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

        {data && (
          <section className="rounded border border-gray-200 bg-white p-4">
            <h2 className="text-lg font-semibold text-gray-950">Computer voice</h2>
            <p className="mt-1 text-sm text-gray-600">
              Reads every line that has no recording, including the lines with an advisor&apos;s name, a price or your place in line. Clone
              your own voice and these lines can sound like your recordings.
            </p>
            <p className="mt-2 text-sm text-gray-700">
              Now using: <span className="font-mono text-xs">{data.voice.voice}</span>{' '}
              <span className="text-gray-500">
                ({data.voice.source === 'admin' ? 'chosen here' : data.voice.source === 'environment' ? 'from the server settings' : 'the default'})
              </span>
            </p>
            {data.voice.fellBack && (
              <p className="mt-2 rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
                Telnyx refused the voice <span className="font-mono text-xs">{data.voice.chosen}</span>, so calls are using the default voice
                for now. Check the voice ID, then save it again.
              </p>
            )}

            <label className="mt-3 block text-sm font-medium text-gray-700">
              Voice ID
              <input
                value={voiceInput}
                onChange={(event) => setVoiceInput(event.target.value)}
                placeholder="Telnyx.Qwen3TTS.33226e69-3abd-429b-b64a-86775c9b5850"
                className="mt-1 block w-full rounded border border-gray-300 px-3 py-2 font-mono text-sm"
              />
            </label>
            <div className="mt-3 flex flex-wrap items-end gap-3">
              <button
                type="button"
                disabled={voiceBusy || voiceInput.trim() === ''}
                onClick={() => void saveVoice(voiceInput)}
                className="rounded bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
              >
                Save voice
              </button>
              <button
                type="button"
                disabled={voiceBusy || !data.voice.chosen}
                onClick={() => void saveVoice('')}
                className="rounded border border-gray-300 px-4 py-2 text-sm font-medium hover:bg-gray-50 disabled:opacity-50"
              >
                Use the default
              </button>
              <label className="text-sm font-medium text-gray-700">
                Your phone number
                <input
                  value={testPhone}
                  onChange={(event) => setTestPhone(event.target.value)}
                  type="tel"
                  placeholder="(555) 123-4567"
                  className="mt-1 block rounded border border-gray-300 px-3 py-2 text-sm"
                />
              </label>
              <button
                type="button"
                disabled={voiceBusy || testPhone.trim() === ''}
                onClick={() => void testVoice()}
                className="rounded border border-indigo-300 px-4 py-2 text-sm font-medium text-indigo-700 hover:bg-indigo-50 disabled:opacity-50"
              >
                Call me to hear it
              </button>
            </div>
            <p className="mt-1 text-xs text-gray-500">The test uses the voice in the box above, even before you save it.</p>

            <details className="mt-3 text-sm text-gray-600">
              <summary className="cursor-pointer font-medium text-gray-800">How to clone your voice</summary>
              <ol className="mt-2 list-decimal space-y-1 pl-5">
                <li>Sign in to the Telnyx portal and open <span className="font-medium">Voice Design Lab</span>.</li>
                <li>Create a voice by cloning: record yourself in the browser or upload a clean recording of you speaking naturally. A short clip of about 10 to 15 seconds, in a quiet room, works for the Telnyx voice.</li>
                <li>Save it, then open the saved voice and copy its voice ID. It looks like <span className="font-mono text-xs">Telnyx.Qwen3TTS.33226e69-…</span>.</li>
                <li>Paste the ID above, press <span className="font-medium">Call me to hear it</span>, and listen. Save it when you like it.</li>
              </ol>
              <p className="mt-2">If Telnyx ever refuses the voice, calls use the default voice instead of going quiet, and this page tells you.</p>
            </details>
          </section>
        )}

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
