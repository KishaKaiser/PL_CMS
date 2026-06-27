import { AccountDashboard } from '../../components/account-dashboard';
import { PublicSiteShell } from '../../components/public-site-shell';

export default function AdvisorPage() {
  return (
    <PublicSiteShell>
      <AccountDashboard mode="advisor" />
    </PublicSiteShell>
  );
}
