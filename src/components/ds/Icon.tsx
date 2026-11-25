import type { ReactNode } from 'react';

// Stroke icons on a 24px grid, drawn at 18px by default (the portal's nav/icon size).
const paths = {
  po: <path d="M4 4h16v16H4zM4 9h16M9 4v16" />,
  invoice: <path d="M6 3h9l5 5v13H6zM14 3v5h5M9 13h6M9 17h6" />,
  report: <path d="M5 20V10M10 20V4M15 20v-7M20 20v-4" />,
  sales: <path d="M4 4h16v16H4zM7 15l3-4 3 2 4-5" />,
  soh: <path d="M3 8l9-5 9 5-9 5zM3 8v8l9 5M21 8v4M17 17a3 3 0 1 0 6 0 3 3 0 0 0-6 0" />,
  scorecard: <path d="M4 20h16M6 16v-3M10 16V9M14 16v-5M18 16V6" />,
  offers: <path d="M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM9 8h6M9 11h6M10 8c3 0 3 6 0 6l4 3" />,
  assortment: <path d="M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4zM14 14h6v6h-6z" />,
  code: <path d="M8 7l-5 5 5 5M16 7l5 5-5 5" />,
  settings: <path d="M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z" />,
  help: <path d="M4 14v-2a8 8 0 0 1 16 0v2M4 14h3v6H5a1 1 0 0 1-1-1zM20 14h-3v6h2a1 1 0 0 0 1-1z" />,
  sidebar: <path d="M4 4h16v16H4zM10 4v16M17 10l-2 2 2 2" />,
  chevronDown: <path d="M6 9l6 6 6-6" />,
  chevronUp: <path d="M6 15l6-6 6 6" />,
  chevronRight: <path d="M9 6l6 6-6 6" />,
  chevronLeft: <path d="M15 6l-6 6 6 6" />,
  chevronsLeft: <path d="M11 6l-6 6 6 6M18 6l-6 6 6 6" />,
  chevronsRight: <path d="M13 6l6 6-6 6M6 6l6 6-6 6" />,
  search: <path d="M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14zM20 20l-4-4" />,
  calendar: <path d="M4 6h16v14H4zM4 10h16M8 3v4M16 3v4" />,
  download: <path d="M12 4v11M7 10l5 5 5-5M5 20h14" />,
  upload: <path d="M12 16V5M7 10l5-5 5 5M5 20h14" />,
  filter: <path d="M4 6h16M7 12h10M10 18h4" />,
  funnel: <path d="M4 5h16l-6 7v6l-4 2v-8z" />,
  sort: <path d="M8 9l4-4 4 4M8 15l4 4 4-4" />,
  gear: <path d="M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M4.9 19.1L7 17M17 7l2.1-2.1" />,
  dots: <path d="M12 5h.01M12 12h.01M12 19h.01" />,
  close: <path d="M6 6l12 12M18 6L6 18" />,
  info: <path d="M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 11v5M12 8h.01" />,
  alert: <path d="M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 7v6M12 16h.01" />,
  lock: <path d="M6 11h12v9H6zM8 11V8a4 4 0 0 1 8 0v3" />,
  plus: <path d="M12 5v14M5 12h14" />,
  copy: <path d="M9 9h11v11H9zM5 15V4h11" />,
  external: <path d="M14 4h6v6M20 4l-9 9M18 14v6H4V6h6" />,
  arrowLeft: <path d="M20 12H4M10 6l-6 6 6 6" />,
  arrowRight: <path d="M4 12h16M14 6l6 6-6 6" />,
  check: <path d="M5 12l5 5 9-10" />,
  trash: <path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13" />,
  pencil: <path d="M4 20l4-1 11-11-3-3L5 16zM14 6l3 3" />,
  inbox: <path d="M3 13l3-8h12l3 8v6H3zM3 13h5l1 3h6l1-3h5" />,
  thumbsUp: <path d="M7 11v9H4v-9zM7 11l4-8a2 2 0 0 1 2 2v4h6a2 2 0 0 1 2 2l-2 7a2 2 0 0 1-2 2H7" />,
  thumbsDown: <path d="M7 13V4H4v9zM7 13l4 8a2 2 0 0 0 2-2v-4h6a2 2 0 0 0 2-2l-2-7a2 2 0 0 0-2-2H7" />,
  logout: <path d="M10 4H5v16h5M15 8l4 4-4 4M19 12H9" />,
  drag: <path d="M9 6h.01M15 6h.01M9 12h.01M15 12h.01M9 18h.01M15 18h.01" />,
  user: <path d="M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM4 21c0-4 4-6 8-6s8 2 8 6" />,
  users: <path d="M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM2 21c0-4 3-6 7-6s7 2 7 6M16 3a4 4 0 0 1 0 8M22 21c0-3-2-5-4-6" />,
  profile: <path d="M5 4h14v16H5zM9 9h6M9 13h3M15 16a2 2 0 1 0 0-4 2 2 0 0 0 0 4z" />,
  money: <path d="M3 7h18v10H3zM12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM6 10v4M18 10v4" />,
  file: <path d="M6 3h9l5 5v13H6zM14 3v5h5M9 13h6M9 17h6" />,
  bars: <path d="M6 20V12M12 20V5M18 20v-9" />,
  fileChart: <path d="M6 3h9l5 5v13H6zM14 3v5h5M9 17v-3M12 17v-5M15 17v-2" />,
  box: <path d="M6 4h12v16H6zM9 4v6l3-2 3 2V4" />,
  pin: <path d="M12 21s-7-6-7-11a7 7 0 0 1 14 0c0 5-7 11-7 11zM12 12a2 2 0 1 0 0-4 2 2 0 0 0 0 4z" />,
  send: <path d="M4 12l16-8-6 16-3-7z" />,
  ticket: <path d="M3 7h18v3a2 2 0 0 0 0 4v3H3v-3a2 2 0 0 0 0-4zM10 7v10" />,
  question: <path d="M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM9.5 9a2.5 2.5 0 1 1 3.5 2.3c-.6.3-1 .9-1 1.7M12 17h.01" />,
  sparkle: <path d="M12 3l2 6 6 2-6 2-2 6-2-6-6-2 6-2z" />,
  image: <path d="M4 5h16v14H4zM4 16l5-5 4 4 3-3 4 4M15 9h.01" />,
  link: <path d="M10 14a4 4 0 0 0 6 0l3-3a4 4 0 0 0-6-6l-1 1M14 10a4 4 0 0 0-6 0l-3 3a4 4 0 0 0 6 6l1-1" />,
  truck: <path d="M3 6h11v10H3zM14 10h4l3 3v3h-7M7 19a2 2 0 1 0 0-4 2 2 0 0 0 0 4zM17 19a2 2 0 1 0 0-4 2 2 0 0 0 0 4z" />,
  globe: <path d="M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM3 12h18M12 3c3 3 3 15 0 18M12 3c-3 3-3 15 0 18" />,
  trendUp: <path d="M3 17l6-6 4 4 8-8M15 7h6v6" />,
  checkCircle: <path d="M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM8 12l3 3 5-6" />,

  /* ---- TGCG admin additions (same 24px grid, 1.75 stroke, round caps) ---- */
  home: <path d="M3 11l9-8 9 8M5 9v11h5v-6h4v6h5V9" />,
  dashboard: <path d="M4 4h7v9H4zM13 4h7v5h-7zM13 11h7v9h-7zM4 15h7v5H4z" />,
  registrations: <path d="M9 3h6v3H9zM9 4H5v17h14V4h-4M8 11h8M8 15h8M8 19h5" />,
  userPlus: <path d="M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM2 21c0-4 3-6 7-6s7 2 7 6M19 8v6M16 11h6" />,
  userCheck: <path d="M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM2 21c0-4 3-6 7-6s7 2 7 6M16 11l2 2 4-4" />,
  kit: <path d="M3 7l9-4 9 4v10l-9 4-9-4zM3 7l9 4 9-4M12 11v10M7.5 5l9 4" />,
  package: <path d="M3 7l9-4 9 4v10l-9 4-9-4zM3 7l9 4 9-4M12 11v10M7.5 5l9 4" />,
  barcode: <path d="M3 5v14M6 5v14M10 5v14M13 5v14M17 5v14M21 5v14" />,
  scan: <path d="M4 8V4h4M16 4h4v4M20 16v4h-4M8 20H4v-4M4 12h16" />,
  qr: <path d="M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4zM14 14h2v2h-2zM18 18h2v2h-2zM14 18h2M18 14h2" />,
  configuration: <path d="M4 6h9M17 6h3M4 12h3M11 12h9M4 18h11M19 18h1M15 4v4M9 10v4M17 16v4" />,
  sliders: <path d="M4 6h9M17 6h3M4 12h3M11 12h9M4 18h11M19 18h1M15 4v4M9 10v4M17 16v4" />,
  warning: <path d="M12 3l10 18H2zM12 10v5M12 18h.01" />,
  xCircle: <path d="M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM9 9l6 6M15 9l-6 6" />,
  print: <path d="M7 9V3h10v6M7 18H4v-9h16v9h-3M7 14h10v7H7z" />,
  message: <path d="M4 5h16v11H9l-5 4zM8 9h8M8 12h5" />,
  whatsapp: <path d="M4 20l1.3-4A8.5 8.5 0 1 1 8.4 19zM9 9c.5 3 2.5 5 6 6l1-2-2-1-1 1c-1-.5-1.5-1-2-2l1-1-1-2z" />,
  mail: <path d="M3 5h18v14H3zM3 6l9 7 9-7" />,
  phone: <path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2z" />,
  handover: <path d="M2 14h4l3 2h5a1.5 1.5 0 0 1 0 3H9M6 13v7H2M14 18l5-2.5a1.5 1.5 0 0 1 1.5 2.6L15 21H8M10 3h8v8h-8zM14 3v3" />,
  tag: <path d="M3 12V3h9l9 9-9 9zM7.5 7.5h.01" />,
  label: <path d="M4 6h16v12H4zM8 10h8M8 14h5" />,
  refresh: <path d="M20 11a8 8 0 0 0-14.5-4.5L4 8M4 4v4h4M4 13a8 8 0 0 0 14.5 4.5L20 16M20 20v-4h-4" />,
  undo: <path d="M9 14L4 9l5-5M4 9h10a6 6 0 0 1 0 12h-3" />,
  swap: <path d="M7 4L3 8l4 4M3 8h14M17 12l4 4-4 4M21 16H7" />,
  shirt: <path d="M8 3L3 6l2 5 3-1v11h8V10l3 1 2-5-5-3a4 4 0 0 1-8 0z" />,
  trophy: <path d="M8 4h8v5a4 4 0 0 1-8 0zM8 6H4a4 4 0 0 0 4 4M16 6h4a4 4 0 0 1-4 4M12 13v4M8 21h8M10 17h4v4h-4z" />,
  table: <path d="M4 5h16v14H4zM4 10h16M4 15h16M10 5v14" />,
  chart: <path d="M4 4v16h16M8 8h9M8 12h12M8 16h6" />,
  pie: <path d="M21 12a9 9 0 1 1-9-9v9zM15.5 3.7a9 9 0 0 1 4.8 4.8h-4.8z" />,
  list: <path d="M9 6h11M9 12h11M9 18h11M4 6h.01M4 12h.01M4 18h.01" />,
  menu: <path d="M4 6h16M4 12h16M4 18h16" />,
  minus: <path d="M5 12h14" />,
  clock: <path d="M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 7v5l3 2" />,
  eye: <path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12zM12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z" />,
  eyeOff: <path d="M3 3l18 18M10.6 5.1A10 10 0 0 1 12 5c6 0 10 7 10 7a17 17 0 0 1-3.2 3.9M6.6 6.6A17 17 0 0 0 2 12s4 7 10 7a10 10 0 0 0 5.4-1.6M9.9 9.9a3 3 0 0 0 4.2 4.2" />,
  save: <path d="M5 4h11l4 4v12H5zM8 4v5h7M8 20v-6h8v6" />,
  dotsHorizontal: <path d="M5 12h.01M12 12h.01M19 12h.01" />,
} satisfies Record<string, ReactNode>;

export type IconName = keyof typeof paths;

interface IconProps {
  name: IconName;
  size?: number;
  className?: string;
  strokeWidth?: number;
}

export function Icon({ name, size = 18, className = '', strokeWidth = 1.75 }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={`shrink-0 ${className}`}
    >
      {paths[name]}
    </svg>
  );
}
