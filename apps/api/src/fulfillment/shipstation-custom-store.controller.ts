import {
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
  HttpStatus,
  Post,
  Query,
  Req,
  Res,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { ShipStationCustomStoreService } from './shipstation-custom-store.service';

@Controller('shipstation/custom-store')
export class ShipStationCustomStoreController {
  constructor(private readonly customStore: ShipStationCustomStoreService) {}

  @Get()
  async handleGet(
    @Headers('authorization') authorization: string | undefined,
    @Query('action') action: string | undefined,
    @Query('start_date') startDate: string | undefined,
    @Query('end_date') endDate: string | undefined,
    @Query('page') page: string | undefined,
    @Req() request: Request,
    @Res() response: Response,
  ) {
    await this.customStore.assertAuthorized(authorization);
    if (action?.toLowerCase() !== 'export') {
      response.status(HttpStatus.BAD_REQUEST).type('text/xml').send(xmlError('Unsupported action.'));
      return;
    }

    const xml = await this.customStore.exportOrders({
      startDate,
      endDate,
      page,
      baseUrl: getBaseUrl(request),
    });
    response.status(HttpStatus.OK).type('text/xml').send(xml);
  }

  @Post()
  @HttpCode(HttpStatus.OK)
  async handlePost(
    @Headers('authorization') authorization: string | undefined,
    @Query('action') action: string | undefined,
    @Query('order_number') orderNumber: string | undefined,
    @Query('order_id') orderId: string | undefined,
    @Query('carrier') carrier: string | undefined,
    @Query('service') service: string | undefined,
    @Query('tracking_number') trackingNumber: string | undefined,
    @Body() body: Record<string, unknown> | undefined,
    @Res() response: Response,
  ) {
    await this.customStore.assertAuthorized(authorization);
    if (action?.toLowerCase() !== 'shipnotify') {
      response.status(HttpStatus.BAD_REQUEST).type('text/xml').send(xmlError('Unsupported action.'));
      return;
    }

    const xml = await this.customStore.handleShipNotify({
      orderNumber: orderNumber || readBodyValue(body, 'OrderNumber'),
      orderId: orderId || readBodyValue(body, 'OrderID'),
      carrier: carrier || readBodyValue(body, 'Carrier'),
      service: service || readBodyValue(body, 'Service'),
      trackingNumber: trackingNumber || readBodyValue(body, 'TrackingNumber'),
    });
    response.status(HttpStatus.OK).type('text/xml').send(xml);
  }
}

function getBaseUrl(request: Request) {
  const forwardedProto = request.header('x-forwarded-proto')?.split(',')[0]?.trim();
  const forwardedHost = request.header('x-forwarded-host')?.split(',')[0]?.trim();
  const protocol = forwardedProto || request.protocol || 'https';
  const host = forwardedHost || request.header('host') || '';
  return `${protocol}://${host}`;
}

function readBodyValue(body: Record<string, unknown> | undefined, key: string) {
  const value = body?.[key] ?? body?.[key.toLowerCase()];
  return typeof value === 'string' ? value : undefined;
}

function xmlError(message: string) {
  return `<?xml version="1.0" encoding="utf-8"?><Error>${message}</Error>`;
}
