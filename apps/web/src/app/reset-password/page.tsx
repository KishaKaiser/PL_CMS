import type { Metadata } from 'next';
import { Suspense } from 'react';
import { PublicSiteShell } from '../../components/public-site-shell';
import { ResetPasswordForm } from './reset-password-form';

// The link holds a secret: keep it out of search results, and out of the address sent to other sites.
export const metadata: Metadata = { title: 'Choose a new password', robots: { index: false, follow: false }, referrer: 'no-referrer' };

export default function ResetPasswordPage() {
  return (
    <PublicSiteShell showFooter={false}>
      <Suspense>
        <ResetPasswordForm />
      </Suspense>
    </PublicSiteShell>
  );
}
