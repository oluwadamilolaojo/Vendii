const base = { fill: "none", "aria-hidden": true } as const;

export const TickIcon = ({ size = 12 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 16 16" {...base}>
    <path d="M3.2 8.4l3 3 6.6-7" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);
export const BackIcon = () => (
  <svg width="16" height="16" viewBox="0 0 20 20" {...base}>
    <path d="M12.5 4.5L7 10l5.5 5.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);
export const PlusIcon = () => (
  <svg width="15" height="15" viewBox="0 0 20 20" {...base}>
    <path d="M10 4.5v11M4.5 10h11" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
  </svg>
);
export const XIcon = () => (
  <svg width="15" height="15" viewBox="0 0 20 20" {...base}>
    <path d="M5.5 5.5l9 9M14.5 5.5l-9 9" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
  </svg>
);
export const PersonIcon = () => (
  <svg width="14" height="14" viewBox="0 0 16 16" {...base}>
    <circle cx="8" cy="5.6" r="2.4" stroke="currentColor" strokeWidth="1.4" />
    <path d="M3 13c.9-2.2 2.7-3.3 5-3.3S12.1 10.8 13 13" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
  </svg>
);
export const PhotoIcon = () => (
  <svg width="20" height="20" viewBox="0 0 20 20" {...base}>
    <rect x="2" y="4" width="16" height="12" rx="2" stroke="currentColor" strokeWidth="1.4" />
    <circle cx="7" cy="9" r="1.6" stroke="currentColor" strokeWidth="1.4" />
    <path d="M4 15l4-4 2.5 2.5L14 9l2 2" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);
export const DocIcon = () => (
  <svg width="20" height="20" viewBox="0 0 20 20" {...base}>
    <path d="M5 2.5h7l3 3v12H5v-15z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" />
    <path d="M12 2.5v3h3" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" />
  </svg>
);
