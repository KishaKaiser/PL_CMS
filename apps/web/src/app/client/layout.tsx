import { SessionGuard } from '../../components/session-guard';

export default function ClientLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      {children}
      <SessionGuard />
    </>
  );
}
