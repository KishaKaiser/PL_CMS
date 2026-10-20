import { Module } from '@nestjs/common';
import { AdminAdvisorsController } from './admin-advisors/advisors.controller';
import { AdminAdvisorsService } from './admin-advisors/advisors.service';
import { DashboardController } from './admin-dashboard/dashboard.controller';
import { DashboardService } from './admin-dashboard/dashboard.service';
import { MediaController } from './admin-media/media.controller';
import { MediaService } from './admin-media/media.service';
import { ModulesController } from './admin-modules/modules.controller';
import { ModulesService } from './admin-modules/modules.service';
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
import { AdminCallsController } from './admin-calls/calls.controller';
import { AdminCallsService } from './admin-calls/calls.service';
import { AdminPhonePromptsController } from './admin-phone-prompts/phone-prompts.controller';
import { AdminPayoutsController } from './admin-payouts/payouts.controller';
import { AdminReviewsController } from './admin-reviews/reviews.controller';
import { AdminReviewsService } from './admin-reviews/reviews.service';
import { AdminUsersController } from './admin-users/users.controller';
import { AdminUsersService } from './admin-users/users.service';
import { AuditController } from './audit/audit.controller';
import { AuditService } from './audit/audit.service';
import { ThemeBuilderController } from './theme-builder/theme-builder.controller';
import { ThemeBuilderService } from './theme-builder/theme-builder.service';
import { BillingModule } from '../billing/billing.module';
import { PayoutsModule } from '../payouts/payouts.module';
import { TelephonyModule } from '../telephony/telephony.module';
import { DefaultContentModule } from '../bootstrap/default-content.module';

@Module({
  imports: [DefaultContentModule, BillingModule, TelephonyModule, PayoutsModule],
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
    ModulesController,
    ThemeBuilderController,
    AdminAdvisorsController,
    AdminReviewsController,
    AdminCallsController,
    AdminPhonePromptsController,
    AdminPayoutsController,
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
    ModulesService,
    ThemeBuilderService,
    AdminAdvisorsService,
    AdminReviewsService,
    AdminCallsService,
  ],
  exports: [AuditService, PostsService],
})
export class AdminModule {}
