import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

interface OllamaGenerateResponse {
  response?: string;
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

  private getBaseUrl() {
    return this.config.get<string>('OLLAMA_BASE_URL') || 'http://localhost:11434';
  }

  private getModel() {
    return this.config.get<string>('OLLAMA_MODEL')?.trim() || '';
  }
}
