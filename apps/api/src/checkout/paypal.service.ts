import { HttpException, Injectable, Logger, InternalServerErrorException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';

interface PaypalAccessTokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
}

interface PaypalClientTokenResponse {
  client_token: string;
  expires_in: number;
}

interface PaypalOrderUnit {
  reference_id: string;
  amount: { currency_code: string; value: string };
}

interface PaypalCreateOrderResponse {
  id: string;
  status: string;
  links: Array<{ href: string; rel: string; method: string }>;
}

interface PaypalOrderCapture {
  id: string;
  status: string;
}

interface PaypalCaptureResponse {
  id: string;
  status: string;
  payer?: { email_address?: string };
  purchase_units?: Array<{
    payments?: { captures?: PaypalOrderCapture[] };
  }>;
}

interface PaypalWebhookVerifyResponse {
  verification_status: string;
}

interface PaypalErrorDetail {
  issue?: string;
  description?: string;
  field?: string;
}

/** PayPal's explanation of a refusal, including the detail that says what was actually wrong. */
export function describeFailure(body: { name?: string; message?: string; details?: PaypalErrorDetail[]; debug_id?: string }): string {
  const details = (body.details ?? [])
    .map((detail) => [detail.issue, detail.field ? `(${detail.field})` : '', detail.description].filter(Boolean).join(' '))
    .join('; ');
  return [body.name, body.message, details ? `details: ${details}` : '', body.debug_id ? `debug_id ${body.debug_id}` : '']
    .filter(Boolean)
    .join(' | ');
}

/** "fetch failed" on its own says nothing; the cause (a name that did not resolve, a reset connection) does. */
export function describeNetworkError(error: unknown): string {
  if (!(error instanceof Error)) return 'Unknown error';
  const cause = (error as { cause?: { code?: string; message?: string } }).cause;
  return cause ? `${error.message} (${cause.code ?? ''} ${cause.message ?? ''})`.replace(/\s+\)/, ')') : error.message;
}

/** The result of charging a saved PayPal wallet. */
export type PaypalChargeResult =
  | { ok: true; orderId: string; captureId: string }
  | { ok: false; reason: 'declined' | 'pending' | 'error'; detail: string };

/** What PayPal said when asked whether this app may save customers' PayPal wallets. */
export interface PaypalWalletCheck {
  environment: 'sandbox' | 'live';
  /**
   * allowed: PayPal accepted the request. not-enabled: the keys work but wallet saving is not switched on.
   * bad-credentials / no-credentials: the saved keys are wrong or missing. inconclusive: PayPal objected to the
   * request itself. error: PayPal could not be reached.
   */
  outcome: 'allowed' | 'not-enabled' | 'bad-credentials' | 'no-credentials' | 'inconclusive' | 'error';
  allowed: boolean;
  paypal: { name: string | null; message: string | null; debugId: string | null; status: number } | null;
}

@Injectable()
export class PaypalService {
  private readonly logger = new Logger(PaypalService.name);

  constructor(
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
  ) {}

  async getPublicClientId(): Promise<string> {
    const settings = await this.getSavedBillingSettings();
    return settings.paypalClientId || this.config.get<string>('PAYPAL_CLIENT_ID') || '';
  }

  async getPublicConfig(): Promise<{ clientId: string; environment: 'sandbox' | 'live' }> {
    const credentials = await this.getCredentials();
    return {
      clientId: credentials.clientId,
      environment: credentials.environment === 'live' ? 'live' : 'sandbox',
    };
  }

  async getClientToken(): Promise<{ clientToken: string }> {
    const credentialsConfig = await this.getCredentials();
    const token = await this.getAccessToken();

    const res = await fetch(`${this.getBaseUrl(credentialsConfig.environment)}/v1/identity/generate-token`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Accept-Language': 'en_US',
        'Content-Type': 'application/json',
      },
    });

    if (!res.ok) {
      const text = await res.text();
      this.logger.error(`PayPal client token error: ${text}`);
      throw new InternalServerErrorException('Failed to generate PayPal client token');
    }

    const data = (await res.json()) as PaypalClientTokenResponse;
    return { clientToken: data.client_token };
  }

  private async getCredentials() {
    const settings = await this.getSavedBillingSettings();
    return {
      clientId: settings.paypalClientId || this.config.get<string>('PAYPAL_CLIENT_ID') || '',
      clientSecret: settings.paypalClientSecret || this.config.get<string>('PAYPAL_CLIENT_SECRET') || '',
      environment: settings.environment || this.config.get<string>('PAYPAL_ENVIRONMENT') || 'sandbox',
      webhookSecret: settings.webhookSecret || this.config.get<string>('PAYPAL_WEBHOOK_ID') || '',
    };
  }

  private getBaseUrl(environment: string) {
    return environment === 'live' ? 'https://api-m.paypal.com' : 'https://api-m.sandbox.paypal.com';
  }

  private async getSavedBillingSettings() {
    const setting = await this.prisma.setting.findUnique({ where: { key: 'billing_api_settings' } });
    if (!setting) return {};
    try {
      const parsed = JSON.parse(setting.value) as Record<string, unknown>;
      return {
        paypalClientId: typeof parsed.paypalClientId === 'string' ? parsed.paypalClientId.trim() : '',
        paypalClientSecret: typeof parsed.paypalClientSecret === 'string' ? parsed.paypalClientSecret.trim() : '',
        environment: parsed.environment === 'live' || parsed.environment === 'sandbox' ? parsed.environment : '',
        webhookSecret: typeof parsed.webhookSecret === 'string' ? parsed.webhookSecret.trim() : '',
      };
    } catch {
      return {};
    }
  }

  async getAccessToken(): Promise<string> {
    const credentialsConfig = await this.getCredentials();
    if (!credentialsConfig.clientId || !credentialsConfig.clientSecret) {
      throw new InternalServerErrorException('PayPal API credentials are not configured in Admin Settings.');
    }

    const credentials = Buffer.from(
      `${credentialsConfig.clientId}:${credentialsConfig.clientSecret}`,
    ).toString('base64');

    const res = await fetch(`${this.getBaseUrl(credentialsConfig.environment)}/v1/oauth2/token`, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${credentials}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: 'grant_type=client_credentials',
    });

    if (!res.ok) {
      const text = await res.text();
      this.logger.error(`PayPal token error: ${text}`);
      throw new InternalServerErrorException('Failed to obtain PayPal access token');
    }

    const data = (await res.json()) as PaypalAccessTokenResponse;
    return data.access_token;
  }

  /**
   * Asks PayPal to start saving a PayPal wallet with the saved keys, to learn whether wallet saving (the Vault) is
   * switched on for this app. It is the same request the "connect my PayPal wallet" feature would make. Nothing is
   * saved and nobody is charged: PayPal just returns a setup token that expires unused.
   */
  async checkWalletAccess(returnOrigin: string): Promise<PaypalWalletCheck> {
    const credentials = await this.getCredentials();
    const environment: 'sandbox' | 'live' = credentials.environment === 'live' ? 'live' : 'sandbox';
    const result = (outcome: PaypalWalletCheck['outcome'], paypal: PaypalWalletCheck['paypal'] = null): PaypalWalletCheck => ({
      environment,
      outcome,
      allowed: outcome === 'allowed',
      paypal,
    });

    if (!credentials.clientId || !credentials.clientSecret) return result('no-credentials');

    const base = this.getBaseUrl(environment);
    try {
      const tokenResponse = await fetch(`${base}/v1/oauth2/token`, {
        method: 'POST',
        headers: {
          Authorization: `Basic ${Buffer.from(`${credentials.clientId}:${credentials.clientSecret}`).toString('base64')}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: 'grant_type=client_credentials',
      });
      if (!tokenResponse.ok) {
        return result(tokenResponse.status === 401 || tokenResponse.status === 400 ? 'bad-credentials' : 'error');
      }
      const { access_token: accessToken } = (await tokenResponse.json()) as PaypalAccessTokenResponse;

      const response = await fetch(`${base}/v3/vault/setup-tokens`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
          'PayPal-Request-Id': randomUUID(),
        },
        body: JSON.stringify({
          payment_source: {
            paypal: {
              usage_type: 'MERCHANT',
              experience_context: {
                return_url: `${returnOrigin}/client`,
                cancel_url: `${returnOrigin}/client`,
              },
            },
          },
        }),
      });
      if (response.ok) return result('allowed');

      const body = (await response.json().catch(() => ({}))) as { name?: string; message?: string; debug_id?: string };
      const paypal = { name: body.name ?? null, message: body.message ?? null, debugId: body.debug_id ?? null, status: response.status };
      this.logger.warn(`PayPal wallet check (${environment}): ${response.status} ${body.name ?? ''} ${body.message ?? ''}`);

      if (response.status === 401) return result('bad-credentials', paypal);
      if (response.status === 403 || /NOT_AUTHORIZED|PERMISSION_DENIED|AUTHORIZATION_ERROR|FEATURE_NOT_ENABLED/i.test(body.name ?? '')) {
        return result('not-enabled', paypal);
      }
      if (response.status === 400 || response.status === 422) return result('inconclusive', paypal);
      return result('error', paypal);
    } catch (error) {
      this.logger.error(`PayPal wallet check failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      return result('error');
    }
  }

  // ── Saved wallets (PayPal Vault) ──────────────────────────────────────────

  /** Starts saving a client's PayPal wallet: PayPal returns a setup token and the page the client approves it on. */
  async createWalletSetup(returnUrl: string): Promise<{ setupTokenId: string; approveUrl: string }> {
    const response = await this.paypalRequest('/v3/vault/setup-tokens', 'POST', {
      payment_source: {
        paypal: {
          usage_type: 'MERCHANT',
          experience_context: { return_url: returnUrl, cancel_url: returnUrl },
        },
      },
    }, randomUUID());
    const body = (await response.json().catch(() => ({}))) as {
      id?: string;
      links?: Array<{ href: string; rel: string }>;
      message?: string;
      name?: string;
      details?: PaypalErrorDetail[];
      debug_id?: string;
    };
    if (!response.ok || !body.id) {
      this.logger.error(`PayPal could not start a wallet connection (${response.status}): ${describeFailure(body)}`);
      throw new InternalServerErrorException('PayPal could not start the connection. Please try again.');
    }
    const approveUrl = body.links?.find((link) => link.rel === 'approve' || link.rel === 'payer-action')?.href;
    if (!approveUrl) {
      this.logger.error('PayPal did not return a page to approve the wallet on');
      throw new InternalServerErrorException('PayPal could not start the connection. Please try again.');
    }
    return { setupTokenId: body.id, approveUrl };
  }

  /** Once the client has approved on PayPal, turns the setup token into the wallet we can charge later. */
  async createPaymentToken(setupTokenId: string): Promise<{ vaultId: string; payerEmail: string | null }> {
    const response = await this.paypalRequest(
      '/v3/vault/payment-tokens',
      'POST',
      { payment_source: { token: { id: setupTokenId, type: 'SETUP_TOKEN' } } },
      randomUUID(),
    );
    const body = (await response.json().catch(() => ({}))) as {
      id?: string;
      payment_source?: { paypal?: { email_address?: string } };
      message?: string;
      name?: string;
      details?: PaypalErrorDetail[];
      debug_id?: string;
    };
    if (!response.ok || !body.id) {
      this.logger.warn(`PayPal could not finish the wallet connection (${response.status}): ${describeFailure(body)}`);
      throw new InternalServerErrorException('The PayPal connection was not completed. Please try connecting again.');
    }
    return { vaultId: body.id, payerEmail: body.payment_source?.paypal?.email_address ?? null };
  }

  /** Removes a saved wallet at PayPal. A wallet PayPal no longer knows about counts as removed. */
  async deletePaymentToken(vaultId: string): Promise<void> {
    const response = await this.paypalRequest(`/v3/vault/payment-tokens/${encodeURIComponent(vaultId)}`, 'DELETE');
    if (!response.ok && response.status !== 404) {
      this.logger.warn(`PayPal could not remove a saved wallet (${response.status})`);
    }
  }

  /**
   * Charges a saved wallet for a top-up the client chose. The request id makes a repeated attempt safe: PayPal
   * will not charge twice for the same id.
   */
  async chargeSavedWallet(args: { vaultId: string; amountCents: number; requestId: string; description: string }): Promise<PaypalChargeResult> {
    try {
      const response = await this.paypalRequest(
        '/v2/checkout/orders',
        'POST',
        {
          intent: 'CAPTURE',
          purchase_units: [
            {
              amount: { currency_code: 'USD', value: (args.amountCents / 100).toFixed(2) },
              description: args.description,
              custom_id: args.requestId,
            },
          ],
          payment_source: { paypal: { vault_id: args.vaultId } },
        },
        args.requestId,
      );
      const body = (await response.json().catch(() => ({}))) as {
        id?: string;
        status?: string;
        name?: string;
        message?: string;
        debug_id?: string;
        details?: PaypalErrorDetail[];
        purchase_units?: Array<{ payments?: { captures?: Array<{ id: string; status: string }> } }>;
      };

      if (!response.ok) {
        const issue = body.details?.[0]?.issue ?? body.name ?? `HTTP ${response.status}`;
        const detail = `${issue}${body.details?.[0]?.description ? `: ${body.details[0].description}` : body.message ? `: ${body.message}` : ''}`;
        this.logger.warn(`PayPal wallet charge failed (${response.status}): ${describeFailure(body)}`);
        const declined = response.status === 422 && /INSTRUMENT_DECLINED|PAYER_ACCOUNT|PAYER_CANNOT|TRANSACTION_REFUSED|INSUFFICIENT/i.test(issue);
        return { ok: false, reason: declined ? 'declined' : 'error', detail };
      }

      const capture = body.purchase_units?.[0]?.payments?.captures?.[0];
      if (body.status === 'COMPLETED' && capture?.status === 'COMPLETED' && body.id) {
        return { ok: true, orderId: body.id, captureId: capture.id };
      }
      this.logger.warn(`PayPal wallet charge was not completed immediately (order ${body.id ?? '?'}, ${body.status ?? '?'}, capture ${capture?.status ?? '?'})`);
      return { ok: false, reason: 'pending', detail: `The payment was ${capture?.status ?? body.status ?? 'not completed'}` };
    } catch (error) {
      const detail = describeNetworkError(error);
      this.logger.error(`PayPal wallet charge failed: ${detail}`);
      return { ok: false, reason: 'error', detail };
    }
  }

  /**
   * Sends a request to PayPal. If the connection itself drops (the request never reached PayPal or its answer never
   * came back), it is tried again a couple of times. That is safe: the same PayPal-Request-Id is used each time, so
   * PayPal treats a repeat as the same request and never charges twice.
   */
  private async paypalRequest(path: string, method: 'POST' | 'DELETE', body?: unknown, requestId?: string) {
    const attempts = 3;
    for (let attempt = 1; ; attempt++) {
      try {
        const credentials = await this.getCredentials();
        const accessToken = await this.getAccessToken();
        return await fetch(`${this.getBaseUrl(credentials.environment)}${path}`, {
          method,
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
            ...(requestId ? { 'PayPal-Request-Id': requestId } : {}),
          },
          ...(body === undefined ? {} : { body: JSON.stringify(body) }),
        });
      } catch (error) {
        // PayPal answered with a refusal, or keys are missing: a repeat would get the same answer.
        if (error instanceof HttpException || attempt >= attempts) throw error;
        this.logger.warn(`PayPal request to ${path} failed (${describeNetworkError(error)}); trying again (${attempt} of ${attempts - 1})`);
        await new Promise((resolve) => setTimeout(resolve, 500 * attempt));
      }
    }
  }

  async createOrder(
    orderId: string,
    total: string,
    currency: string,
    returnUrl: string,
    cancelUrl: string,
  ): Promise<{ paypalOrderId: string; approvalUrl: string }> {
    const credentialsConfig = await this.getCredentials();
    const token = await this.getAccessToken();

    const units: PaypalOrderUnit[] = [
      {
        reference_id: orderId,
        amount: { currency_code: currency, value: total },
      },
    ];

    const body = {
      intent: 'CAPTURE',
      purchase_units: units,
      application_context: {
        return_url: returnUrl,
        cancel_url: cancelUrl,
      },
    };

    const res = await fetch(`${this.getBaseUrl(credentialsConfig.environment)}/v2/checkout/orders`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const text = await res.text();
      this.logger.error(`PayPal create order error: ${text}`);
      throw new InternalServerErrorException('Failed to create PayPal order');
    }

    const data = (await res.json()) as PaypalCreateOrderResponse;
    const approvalLink = data.links.find((l) => l.rel === 'approve');
    return {
      paypalOrderId: data.id,
      approvalUrl: approvalLink?.href ?? '',
    };
  }

  async captureOrder(
    paypalOrderId: string,
  ): Promise<{ status: string; payerEmail?: string; captureId?: string }> {
    const credentialsConfig = await this.getCredentials();
    const token = await this.getAccessToken();

    const res = await fetch(
      `${this.getBaseUrl(credentialsConfig.environment)}/v2/checkout/orders/${paypalOrderId}/capture`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      },
    );

    if (!res.ok) {
      const text = await res.text();
      this.logger.error(`PayPal capture error: ${text}`);
      throw new InternalServerErrorException('Failed to capture PayPal order');
    }

    const data = (await res.json()) as PaypalCaptureResponse;
    const captureId = data.purchase_units?.[0]?.payments?.captures?.[0]?.id;

    return {
      status: data.status,
      payerEmail: data.payer?.email_address,
      captureId,
    };
  }

  async verifyWebhookSignature(
    headers: Record<string, string>,
    rawBody: string,
  ): Promise<boolean> {
    const credentialsConfig = await this.getCredentials();
    const webhookId = credentialsConfig.webhookSecret;
    if (!webhookId) {
      this.logger.error('PayPal webhook ID must be configured for webhook signature verification');
      return false;
    }

    const requiredHeaders = [
      'paypal-auth-algo',
      'paypal-cert-url',
      'paypal-transmission-id',
      'paypal-transmission-sig',
      'paypal-transmission-time',
    ] as const;

    const missingHeader = requiredHeaders.find((header) => !headers[header]);
    if (missingHeader) {
      this.logger.error(`Missing PayPal webhook header: ${missingHeader}`);
      return false;
    }

    const token = await this.getAccessToken();

    let webhookEvent: unknown;
    try {
      webhookEvent = JSON.parse(rawBody) as unknown;
    } catch {
      this.logger.error('PayPal webhook verification failed: invalid JSON in rawBody');
      return false;
    }

    const payload = {
      auth_algo: headers['paypal-auth-algo'],
      cert_url: headers['paypal-cert-url'],
      transmission_id: headers['paypal-transmission-id'],
      transmission_sig: headers['paypal-transmission-sig'],
      transmission_time: headers['paypal-transmission-time'],
      webhook_id: webhookId,
      webhook_event: webhookEvent,
    };

    const res = await fetch(
      `${this.getBaseUrl(credentialsConfig.environment)}/v1/notifications/verify-webhook-signature`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      },
    );

    if (!res.ok) {
      const text = await res.text();
      this.logger.error(`PayPal webhook verify error: ${text}`);
      return false;
    }

    const data = (await res.json()) as PaypalWebhookVerifyResponse;
    return data.verification_status === 'SUCCESS';
  }
}
