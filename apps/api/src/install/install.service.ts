import {
  ConflictException,
  Injectable,
  InternalServerErrorException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { spawn } from 'child_process';
import * as path from 'path';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../prisma/prisma.service';
import { RunInstallDto } from './install.dto';

@Injectable()
export class InstallService {
  // NOTE: isRunning is an in-memory guard that prevents concurrent runs on a
  // single instance. The DB-level lock is the admin-user check: a second call
  // returns 409 as soon as an ADMIN row exists.
  private isRunning = false;

  constructor(private readonly prisma: PrismaService) {}

  async getStatus() {
    let dbConnected = false;
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      dbConnected = true;
    } catch {
      // db not reachable
    }

    let hasAdmin = false;
    if (dbConnected) {
      try {
        const count = await this.prisma.user.count({ where: { role: 'ADMIN' } });
        hasAdmin = count > 0;
      } catch {
        // tables may not exist yet
      }
    }

    return {
      installed: hasAdmin,
      hasAdmin,
      db: { connected: dbConnected },
    };
  }

  async runInstall(dto: RunInstallDto) {
    if (this.isRunning) {
      throw new ConflictException('Installation is already in progress');
    }
    this.isRunning = true;

    try {
      // 1. Verify DB connectivity
      try {
        await this.prisma.$queryRaw`SELECT 1`;
      } catch {
        throw new ServiceUnavailableException('Database is not reachable');
      }

      // 2. Run Prisma migrations (safe, idempotent)
      await this.runMigrations();

      // 3. Check if already installed (admin exists = installed)
      const adminCount = await this.prisma.user.count({ where: { role: 'ADMIN' } });
      if (adminCount > 0) {
        throw new ConflictException(
          'Installation is already complete. An admin user already exists.',
        );
      }

      // 4. Seed baseline data
      await this.seedDefaultData();

      // 5. Create first admin user
      const passwordHash = await bcrypt.hash(dto.password, 12);
      const user = await this.prisma.user.create({
        data: {
          email: dto.email,
          passwordHash,
          name: dto.name ?? 'Admin',
          role: 'ADMIN',
        },
      });

      return {
        success: true,
        message: 'Installation complete.',
        userId: user.id,
      };
    } finally {
      this.isRunning = false;
    }
  }

  private runMigrations(): Promise<void> {
    return new Promise((resolve, reject) => {
      const schemaPath = path.resolve(
        process.cwd(),
        'packages/db/prisma/schema.prisma',
      );
      const child = spawn(
        'npx',
        ['prisma', 'migrate', 'deploy', `--schema=${schemaPath}`],
        {
          stdio: 'inherit',
          // Only pass the variables required by Prisma to avoid unnecessary env exposure
          env: { PATH: process.env.PATH, DATABASE_URL: process.env.DATABASE_URL },
        },
      );
      child.on('close', (code) => {
        if (code === 0) {
          resolve();
        } else {
          reject(
            new InternalServerErrorException(
              `Prisma migrate deploy failed with exit code ${code}`,
            ),
          );
        }
      });
      child.on('error', (err) => {
        reject(
          new InternalServerErrorException(
            `Failed to spawn migration process: ${err.message}`,
          ),
        );
      });
    });
  }

  private async seedDefaultData(): Promise<void> {
    const settings: { key: string; value: string }[] = [
      { key: 'site_name', value: 'Psychic Link CMS' },
      { key: 'site_currency', value: 'USD' },
    ];

    for (const s of settings) {
      await this.prisma.setting.upsert({
        where: { key: s.key },
        update: {},
        create: s,
      });
    }

    const modules: { name: string; version: string; enabled: boolean }[] = [
      { name: 'billing', version: '1.0.0', enabled: true },
      { name: 'checkout', version: '1.0.0', enabled: true },
      { name: 'fulfillment', version: '1.0.0', enabled: true },
    ];

    for (const m of modules) {
      await this.prisma.module.upsert({
        where: { name: m.name },
        update: {},
        create: m,
      });
    }
  }
}
