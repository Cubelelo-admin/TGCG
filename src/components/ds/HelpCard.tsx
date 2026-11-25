import type { ReactNode } from 'react';

interface HelpCardProps {
  icon: ReactNode;
  iconBg: string;
  /** Icon stroke colour (defaults to inheriting). */
  iconColor?: string;
  title: string;
  description: string;
  onClick?: () => void;
}

/** Topic card: white, 16px radius, padding 32/24, soft shadow; 64px tinted icon tile. */
export function HelpCard({ icon, iconBg, iconColor, title, description, onClick }: HelpCardProps) {
  const Tag = onClick ? 'button' : 'div';
  return (
    <Tag
      type={onClick ? 'button' : undefined}
      onClick={onClick}
      className="flex flex-col items-center rounded-16 bg-white px-6 py-8 text-center shadow-card transition-shadow hover:shadow-dock-xl"
    >
      <div
        data-testid="help-card-icon"
        className="mb-4 flex h-16 w-16 items-center justify-center rounded-16 [&>svg]:h-6 [&>svg]:w-6"
        style={{ background: iconBg, color: iconColor }}
      >
        {icon}
      </div>
      <h4 className="mb-1 text-20 font-medium text-ink">{title}</h4>
      <p className="text-14 text-ink-tertiary">{description}</p>
    </Tag>
  );
}

interface HelpGridProps {
  children: ReactNode;
}

export function HelpGrid({ children }: HelpGridProps) {
  return <div className="mx-auto grid max-w-[1026px] grid-cols-3 gap-3">{children}</div>;
}
