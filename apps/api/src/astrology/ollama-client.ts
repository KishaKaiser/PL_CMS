import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

interface OllamaGenerateResponse {
  response?: string;
}

interface OllamaTagsResponse {
  models?: Array<{ name: string }>;
}

export interface OllamaTestResult {
  ok: boolean;
  message: string;
  models?: string[];
}

@Injectable()
export class OllamaClient {
  private readonly logger = new Logger(OllamaClient.name);

  constructor(private readonly config: ConfigService) {}

  isConfigured() {
    return Boolean(this.getModel());
  }

  async generate(
    prompt: string,
    settings?: { baseUrl?: string | null; model?: string | null },
    options?: { json?: boolean },
  ): Promise<string | null> {
    const model = settings?.model?.trim() || this.getModel();
    if (!model) return null;

    const baseUrl = settings?.baseUrl?.trim() || this.getBaseUrl();
    const timeoutMs = Number(this.config.get<string>('OLLAMA_TIMEOUT_MS') || 120_000);
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), Number.isFinite(timeoutMs) ? timeoutMs : 120_000);

    try {
      const response = await fetch(`${baseUrl.replace(/\/+$/, '')}/api/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model,
          prompt,
          stream: false,
          ...(options?.json ? { format: 'json' } : {}),
        }),
        signal: controller.signal,
      });

      if (!response.ok) {
        const text = await response.text().catch(() => '');
        throw new Error(`Ollama returned ${response.status}${text ? `: ${text.slice(0, 300)}` : ''}`);
      }

      const payload = (await response.json()) as OllamaGenerateResponse;
      return payload.response?.trim() || null;
    } catch (error) {
      this.logger.warn(`Ollama generation unavailable: ${error instanceof Error ? error.message : 'Unknown error'}`);
      return null;
    } finally {
      clearTimeout(timeout);
    }
  }

  /**
   * Cheaply checks whether Ollama is reachable and the configured model is
   * installed, without running a full generation. Meant for an admin "Test
   * Connection" action so a bad URL/model doesn't have to be discovered by
   * generating a whole report and reading container logs.
   */
  async testConnection(settings?: { baseUrl?: string | null; model?: string | null }): Promise<OllamaTestResult> {
    const baseUrl = settings?.baseUrl?.trim() || this.getBaseUrl();
    const model = settings?.model?.trim() || this.getModel();
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8_000);

    try {
      const response = await fetch(`${baseUrl.replace(/\/+$/, '')}/api/tags`, { signal: controller.signal });
      if (!response.ok) {
        return {
          ok: false,
          message: `Ollama responded with HTTP ${response.status} at ${baseUrl}. Check the URL and that the server is reachable from this container.`,
        };
      }

      const payload = (await response.json()) as OllamaTagsResponse;
      const models = (payload.models ?? []).map((entry) => entry.name);

      if (!model) {
        return {
          ok: true,
          models,
          message: `Connected to Ollama at ${baseUrl}, but no model is configured yet. Available models: ${models.join(', ') || 'none installed'}.`,
        };
      }

      const hasModel = models.some((name) => name === model || name.startsWith(`${model}:`));
      if (!hasModel) {
        return {
          ok: false,
          models,
          message: `Connected to Ollama at ${baseUrl}, but model "${model}" was not found. Available models: ${models.join(', ') || 'none installed'}. Run "ollama pull ${model}" on the Ollama server.`,
        };
      }

      return { ok: true, models, message: `Connected to Ollama at ${baseUrl}. Model "${model}" is available.` };
    } catch (error) {
      const reason = error instanceof Error ? error.message : 'Unknown error';
      return {
        ok: false,
        message: `Could not reach Ollama at ${baseUrl}: ${reason}. If Ollama runs in a separate container, make sure it's attached to the same Docker network as the PL_CMS api container and use its container/service name in the URL (e.g. http://ollama:11434) instead of localhost.`,
      };
    } finally {
      clearTimeout(timeout);
    }
  }

  private getBaseUrl() {
    return this.config.get<string>('OLLAMA_BASE_URL') || 'http://localhost:11434';
  }

  private getModel() {
    return this.config.get<string>('OLLAMA_MODEL')?.trim() || '';
  }
}
