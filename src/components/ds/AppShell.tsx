import type { ReactNode } from 'react';

interface AppShellProps {
  topbar: ReactNode;
  sidebar: ReactNode;
  children: ReactNode;
  /** Floating elements such as the support widget. */
  overlay?: ReactNode;
}

/** Full-height sidebar on the left; topbar and a 16px-padded content area on the right. */
export function AppShell({ topbar, sidebar, children, overlay }: AppShellProps) {
  return (
    <div className="flex min-h-screen bg-white text-ink">
      {sidebar}
      <div className="flex min-w-0 flex-1 flex-col">
        {topbar}
        <main className="min-w-0 flex-1 p-4">{children}</main>
      </div>
      {overlay}
    </div>
  );
}
