import { AccountDashboard } from '../../components/account-dashboard';
import { PublicSiteShell } from '../../components/public-site-shell';

export default function ClientPage() {
  return (
    <PublicSiteShell>
      <AccountDashboard mode="client" />
    </PublicSiteShell>
  );
}
