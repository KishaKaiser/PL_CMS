import { Injectable, Logger, InternalServerErrorException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

interface PaypalAccessTokenResponse {
  access_token: string;
  token_type: string;
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

@Injectable()
export class PaypalService {
  private readonly logger = new Logger(PaypalService.name);
  private readonly baseUrl: string;

  constructor(private readonly config: ConfigService) {
    const env = this.config.get<string>('PAYPAL_ENVIRONMENT') ?? 'sandbox';
    this.baseUrl =
      env === 'live'
        ? 'https://api-m.paypal.com'
        : 'https://api-m.sandbox.paypal.com';
  }

  private get clientId(): string {
    return this.config.get<string>('PAYPAL_CLIENT_ID') ?? '';
  }

  private get clientSecret(): string {
    return this.config.get<string>('PAYPAL_CLIENT_SECRET') ?? '';
  }

  async getAccessToken(): Promise<string> {
    const credentials = Buffer.from(
      `${this.clientId}:${this.clientSecret}`,
    ).toString('base64');

    const res = await fetch(`${this.baseUrl}/v1/oauth2/token`, {
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

  async createOrder(
    orderId: string,
    total: string,
    currency: string,
    returnUrl: string,
    cancelUrl: string,
  ): Promise<{ paypalOrderId: string; approvalUrl: string }> {
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

    const res = await fetch(`${this.baseUrl}/v2/checkout/orders`, {
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
    const token = await this.getAccessToken();

    const res = await fetch(
      `${this.baseUrl}/v2/checkout/orders/${paypalOrderId}/capture`,
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
    const webhookId = this.config.get<string>('PAYPAL_WEBHOOK_ID');
    if (!webhookId) {
      const env = this.config.get<string>('PAYPAL_ENVIRONMENT') ?? 'sandbox';
      if (env === 'live') {
        this.logger.error('PAYPAL_WEBHOOK_ID must be configured in production');
        return false;
      }
      this.logger.warn('PAYPAL_WEBHOOK_ID not configured; skipping signature verification (sandbox only)');
      return true;
    }

    const token = await this.getAccessToken();

    const payload = {
      auth_algo: headers['paypal-auth-algo'],
      cert_url: headers['paypal-cert-url'],
      transmission_id: headers['paypal-transmission-id'],
      transmission_sig: headers['paypal-transmission-sig'],
      transmission_time: headers['paypal-transmission-time'],
      webhook_id: webhookId,
      webhook_event: JSON.parse(rawBody) as unknown,
    };

    const res = await fetch(
      `${this.baseUrl}/v1/notifications/verify-webhook-signature`,
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
