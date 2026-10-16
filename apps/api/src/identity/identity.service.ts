import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { Role } from '@pl-cms/shared';
import { ensureAdvisorSlug, slugMatchesUsername } from '../billing/advisor-slug';
import { displayNameFromUsername, generateUniqueUsername } from '../common/public-identity';
import { PrismaService } from '../prisma/prisma.service';

/**
 * Brings existing clients and advisors in line with the username-only rule each time the API starts: everyone
 * gets a username, their public display name is that username in readable form (psychic_denise → Psychic Denise), and advisor profile links no longer carry a real name.
 * Running it again changes nothing.
 */
@Injectable()
export class IdentityService implements OnApplicationBootstrap {
  private readonly logger = new Logger(IdentityService.name);

  constructor(private readonly prisma: PrismaService) {}

  async onApplicationBootstrap() {
    try {
      const changed = await this.syncAll();
      if (changed > 0) this.logger.log(`Updated public names for ${changed} account(s) to use usernames`);
    } catch (error) {
      // Never block startup over this: the next restart tries again.
      this.logger.error(`Could not update public names: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  async syncAll(): Promise<number> {
    const users = await this.prisma.user.findMany({
      where: { role: { in: [Role.CLIENT, Role.ADVISOR] } },
      select: {
        id: true,
        role: true,
        username: true,
        clientProfile: { select: { id: true, displayName: true } },
        advisorProfile: { select: { id: true, displayName: true, slug: true } },
      },
    });

    let changed = 0;
    for (const user of users) {
      let touched = false;

      let username = user.username;
      if (!username) {
        username = await generateUniqueUsername(this.prisma, user.role);
        await this.prisma.user.update({ where: { id: user.id }, data: { username } });
        touched = true;
      }

      const shownName = displayNameFromUsername(username);

      if (user.clientProfile && user.clientProfile.displayName !== shownName) {
        await this.prisma.clientProfile.update({ where: { id: user.clientProfile.id }, data: { displayName: shownName } });
        touched = true;
      }

      const advisor = user.advisorProfile;
      if (advisor) {
        if (advisor.displayName !== shownName) {
          await this.prisma.advisorProfile.update({ where: { id: advisor.id }, data: { displayName: shownName } });
          touched = true;
        }
        // The profile link is the username in lowercase with underscores. Rebuild any link made another way.
        if (advisor.slug && !slugMatchesUsername(advisor.slug, username)) {
          await this.prisma.advisorProfile.update({ where: { id: advisor.id }, data: { slug: null } });
          await ensureAdvisorSlug(this.prisma, { id: advisor.id, displayName: shownName, slug: null });
          touched = true;
        }
      }

      if (touched) changed++;
    }
    return changed;
  }
}
