import { Injectable, Logger, InternalServerErrorException } from '@nestjs/common';
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
