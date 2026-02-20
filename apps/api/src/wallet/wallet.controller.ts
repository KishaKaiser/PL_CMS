import { Controller, Get, UseGuards, Request } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { WalletService } from './wallet.service';

@Controller('wallet')
@UseGuards(AuthGuard('jwt'))
export class WalletController {
  constructor(private readonly walletService: WalletService) {}

  @Get('balance')
  getBalance(@Request() req: { user: { id: string } }) {
    return this.walletService.getBalance(req.user.id);
  }

  @Get('transactions')
  getTransactions(@Request() req: { user: { id: string } }) {
    return this.walletService.getTransactions(req.user.id);
  }
}
