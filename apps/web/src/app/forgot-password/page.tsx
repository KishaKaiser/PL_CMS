import type { Metadata } from 'next';
import { PublicSiteShell } from '../../components/public-site-shell';
import { ForgotPasswordForm } from './forgot-password-form';

export const metadata: Metadata = { title: 'Forgot your password?', robots: { index: false, follow: false } };

export default function ForgotPasswordPage() {
  return (
    <PublicSiteShell showFooter={false}>
      <ForgotPasswordForm />
    </PublicSiteShell>
  );
}
