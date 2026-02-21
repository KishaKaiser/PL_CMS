import { Module } from '@nestjs/common';
import { ConfigModule as NestConfigModule } from '@nestjs/config';

@Module({
  imports: [
    NestConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env'],
      validate: (config: Record<string, string>) => {
        // Keep this list small + truly required for the API to boot safely.
        // (Feature-specific vars like PAYPAL_*, SMTP_*, SHIPSTATION_* can be validated
        // inside their modules when/if those features are enabled.)
        const required = ['DATABASE_URL', 'JWT_ACCESS_SECRET', 'JWT_REFRESH_SECRET'];
        for (const key of required) {
          if (!config[key]) {
            throw new Error(`Missing required environment variable: ${key}`);
          }
        }
        return config;
      },
    }),
  ],
})
export class ConfigModule {}
