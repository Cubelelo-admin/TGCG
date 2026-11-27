// Line icons for the "Facilities for all participants" list.
// The icon is picked from keywords in the facility's English name, so both events
// get icons automatically; anything unmatched gets a star.

const common = {
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.8,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  "aria-hidden": true,
};

const ICONS: { match: RegExp; icon: React.ReactNode }[] = [
  {
    match: /medal/i,
    icon: (
      <svg {...common}>
        <path d="M8 2h3l2 6M16 2h-3l-1.2 3.6" />
        <circle cx="12" cy="15" r="6" />
        <path d="m12 12 .9 1.9 2 .3-1.5 1.4.4 2-1.8-1-1.8 1 .4-2-1.5-1.4 2-.3z" />
      </svg>
    ),
  },
  {
    match: /chest|bib number|timing chip/i,
    icon: (
      <svg {...common}>
        <rect x="3" y="5" width="18" height="14" rx="2" />
        <path d="M7 10h10M9 14h6" />
        <circle cx="5.5" cy="7.5" r=".6" fill="currentColor" />
        <circle cx="18.5" cy="7.5" r=".6" fill="currentColor" />
      </svg>
    ),
  },
  {
    match: /t-?shirt|tee/i,
    icon: (
      <svg {...common}>
        <path d="M8 3 3 6l2 4 2-1v12h10V9l2 1 2-4-5-3a4 4 0 0 1-8 0Z" />
      </svg>
    ),
  },
  {
    match: /\bbag\b/i,
    icon: (
      <svg {...common}>
        <path d="M5 8h14l-1 13H6Z" />
        <path d="M9 8V6a3 3 0 0 1 6 0v2" />
      </svg>
    ),
  },
  {
    match: /bottle/i,
    icon: (
      <svg {...common}>
        <path d="M10 2h4v3l2 3v12a2 2 0 0 1-2 2h-4a2 2 0 0 1-2-2V8l2-3Z" />
        <path d="M8 12h8M8 16h8" />
      </svg>
    ),
  },
  {
    match: /napkin|towel/i,
    icon: (
      <svg {...common}>
        <path d="M4 4h16v16H4Z" />
        <path d="M4 4l16 16M12 4v6M4 12h6" />
      </svg>
    ),
  },
  {
    match: /clip/i,
    icon: (
      <svg {...common}>
        <path d="M8 7v9a4 4 0 0 0 8 0V6a2.5 2.5 0 0 0-5 0v9a1 1 0 0 0 2 0V7" />
      </svg>
    ),
  },
  {
    match: /certificate/i,
    icon: (
      <svg {...common}>
        <path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h5" />
        <path d="M14 3v5h5M14 3l5 5v3" />
        <path d="M8 9h3M8 13h6" />
        <circle cx="17" cy="16" r="3" />
        <path d="m15.5 18.5-.5 3.5 2-1 2 1-.5-3.5" />
      </svg>
    ),
  },
  {
    match: /track|route|course/i,
    icon: (
      <svg {...common}>
        <path d="M7 21 10 3M17 21 14 3" />
        <path d="M12 6v2M12 11v2M12 16v3" />
      </svg>
    ),
  },
  {
    match: /zumba|warm-?up|music/i,
    icon: (
      <svg {...common}>
        <path d="M9 18V5l11-2v13" />
        <circle cx="6.5" cy="18" r="2.5" />
        <circle cx="17.5" cy="16" r="2.5" />
      </svg>
    ),
  },
  {
    match: /breakfast|food|meal/i,
    icon: (
      <svg {...common}>
        <path d="M4 10h13v4a6 6 0 0 1-6 6h-1a6 6 0 0 1-6-6Z" />
        <path d="M17 11h1.5a2.5 2.5 0 0 1 0 5H16" />
        <path d="M8 3c-1 1.5 1 2.5 0 4M12 3c-1 1.5 1 2.5 0 4" />
      </svg>
    ),
  },
  {
    match: /physio|games|goodies/i,
    icon: (
      <svg {...common}>
        <rect x="3" y="8" width="18" height="4" rx="1" />
        <path d="M5 12v9h14v-9M12 8v13" />
        <path d="M12 8C10 4 6.5 4.5 7.5 7c.5 1 4.5 1 4.5 1s4-0 4.5-1c1-2.5-2.5-3-4.5 1Z" />
      </svg>
    ),
  },
];

const STAR = (
  <svg {...common}>
    <path d="m12 3 2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1-4.4-4.3 6.1-.9Z" />
  </svg>
);

export default function FacilityIcon({ name }: { name: string }) {
  const icon = ICONS.find((i) => i.match.test(name))?.icon ?? STAR;
  return <span className="facility-icon">{icon}</span>;
}
