import { Module } from '@nestjs/common';
import { PagesController } from './admin-pages/pages.controller';
import { PagesService } from './admin-pages/pages.service';
import { PostsController } from './admin-posts/posts.controller';
import { PostsService } from './admin-posts/posts.service';
import { AdminUsersController } from './admin-users/users.controller';
import { AdminUsersService } from './admin-users/users.service';
import { SettingsController } from './admin-settings/settings.controller';
import { SettingsService } from './admin-settings/settings.service';
import { AuditController } from './audit/audit.controller';
import { AuditService } from './audit/audit.service';
import { TaxonomiesController } from './admin-taxonomies/taxonomies.controller';
import { TaxonomiesService } from './admin-taxonomies/taxonomies.service';

@Module({
  controllers: [
    PagesController,
    PostsController,
    AdminUsersController,
    SettingsController,
    AuditController,
    TaxonomiesController,
  ],
  providers: [PagesService, PostsService, AdminUsersService, SettingsService, AuditService, TaxonomiesService],
  exports: [AuditService],
})
export class AdminModule {}
