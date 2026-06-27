import { Suspense } from 'react';
import { PublicSiteShell } from '../../components/public-site-shell';
import { LoginForm } from './login-form';

export default function LoginPage() {
  return (
    <PublicSiteShell showFooter={false}>
      <Suspense>
        <LoginForm />
      </Suspense>
    </PublicSiteShell>
  );
}
