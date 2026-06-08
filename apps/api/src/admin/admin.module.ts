import { Module } from '@nestjs/common';
import { DashboardController } from './admin-dashboard/dashboard.controller';
import { DashboardService } from './admin-dashboard/dashboard.service';
import { MediaController } from './admin-media/media.controller';
import { MediaService } from './admin-media/media.service';
import { PagesController } from './admin-pages/pages.controller';
import { PagesService } from './admin-pages/pages.service';
import { PostsController } from './admin-posts/posts.controller';
import { PostsService } from './admin-posts/posts.service';
import { RevisionsController } from './admin-revisions/revisions.controller';
import { RevisionsService } from './admin-revisions/revisions.service';
import { SettingsController } from './admin-settings/settings.controller';
import { SettingsService } from './admin-settings/settings.service';
import { TaxonomiesController } from './admin-taxonomies/taxonomies.controller';
import { TaxonomiesService } from './admin-taxonomies/taxonomies.service';
import { AdminUsersController } from './admin-users/users.controller';
import { AdminUsersService } from './admin-users/users.service';
import { AuditController } from './audit/audit.controller';
import { AuditService } from './audit/audit.service';

@Module({
  controllers: [
    DashboardController,
    PagesController,
    PostsController,
    RevisionsController,
    AdminUsersController,
    SettingsController,
    AuditController,
    TaxonomiesController,
    MediaController,
  ],
  providers: [
    DashboardService,
    PagesService,
    PostsService,
    RevisionsService,
    AdminUsersService,
    SettingsService,
    AuditService,
    TaxonomiesService,
    MediaService,
  ],
  exports: [AuditService],
})
export class AdminModule {}
