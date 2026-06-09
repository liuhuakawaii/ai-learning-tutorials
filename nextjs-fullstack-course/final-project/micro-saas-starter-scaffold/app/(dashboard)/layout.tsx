import type { ReactNode } from 'react';

export default function DashboardLayout({ children }: { children: ReactNode }) {
  return (
    <div>
      <nav>Dashboard / Projects / Team / Settings</nav>
      {children}
    </div>
  );
}
