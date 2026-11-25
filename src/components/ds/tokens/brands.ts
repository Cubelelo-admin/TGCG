export type BrandId = 'cubelelo' | 'drift' | 'tinkerbox';

export interface BrandTokens {
  name: string;
  accent: string;
  accentSoft: string;
  accentStrong: string;
}

export const BRANDS: Record<BrandId, BrandTokens> = {
  cubelelo: {
    name: 'Cubelelo',
    accent: '#FF9800',
    accentSoft: '#FFF3E0',
    accentStrong: '#C96F00',
  },
  drift: {
    name: 'Drift',
    accent: '#D32737',
    accentSoft: '#FCE9EA',
    accentStrong: '#A31D2A',
  },
  tinkerbox: {
    name: 'Tinkerbox',
    accent: '#5F259E',
    accentSoft: '#F1E9F9',
    accentStrong: '#47186F',
  },
};
