import { SessionGuard } from '../../components/session-guard';

export default function AdvisorLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      {children}
      <SessionGuard />
    </>
  );
}
