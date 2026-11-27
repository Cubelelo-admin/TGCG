import type { ReactNode } from 'react';

interface RoleBadgeProps {
  children: ReactNode;
}

export function RoleBadge({ children }: RoleBadgeProps) {
  return (
    <span className="rounded-4 bg-tint-blue px-1.5 py-0.5 text-10 font-semibold uppercase text-on-tint-blue">
      {children}
    </span>
  );
}
