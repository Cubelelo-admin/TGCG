import type { CSSProperties, ReactNode } from 'react';
import { BRANDS, type BrandId } from './tokens/brands';

interface BrandProviderProps {
  brand: BrandId;
  children: ReactNode;
}

/** Sets --accent / --accent-soft / --accent-strong for the subtree (read by bg-accent, text-accent-strong, ...). Server-safe. */
export function BrandProvider({ brand, children }: BrandProviderProps) {
  const tokens = BRANDS[brand];
  const style: CSSProperties = {
    ['--accent' as string]: tokens.accent,
    ['--accent-soft' as string]: tokens.accentSoft,
    ['--accent-strong' as string]: tokens.accentStrong,
  };

  return (
    <div data-testid="brand-root" data-brand={brand} style={style}>
      {children}
    </div>
  );
}
