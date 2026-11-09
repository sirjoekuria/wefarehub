type P = { className?: string };
const base = (p: P) => ({ className: p.className ?? "w-4 h-4", fill: "none", stroke: "currentColor", strokeWidth: 1.9, strokeLinecap: "round" as const, strokeLinejoin: "round" as const, viewBox: "0 0 24 24" });

export const IconBike = (p: P) => (
  <svg {...base(p)}>
    <circle cx="5.5" cy="17" r="3.2" />
    <circle cx="18.5" cy="17" r="3.2" />
    <path d="M5.5 17 9 9h6l3.5 8M9 9 7.5 6h-3M12 17l-3-8" />
  </svg>
);
export const IconDash = (p: P) => (
  <svg {...base(p)}>
    <rect x="3.5" y="3.5" width="7" height="7" rx="1.5" />
    <rect x="13.5" y="3.5" width="7" height="5" rx="1.5" />
    <rect x="3.5" y="13.5" width="7" height="5" rx="1.5" />
    <rect x="13.5" y="11.5" width="7" height="9" rx="1.5" />
  </svg>
);
export const IconUsers = (p: P) => (
  <svg {...base(p)}>
    <circle cx="9" cy="8" r="3.2" />
    <path d="M3.5 19c.6-3 2.8-4.6 5.5-4.6s4.9 1.6 5.5 4.6M15.5 5.4a3.2 3.2 0 1 1 .6 6M17.5 14.6c2 .4 3.4 1.8 3.9 4" />
  </svg>
);
export const IconInbox = (p: P) => (
  <svg {...base(p)}>
    <path d="M4 13l2.2-7A2 2 0 0 1 8.1 4.4h7.8a2 2 0 0 1 1.9 1.6L20 13v5a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2z" />
    <path d="M4 13h4.5a3.5 3.5 0 0 0 7 0H20" />
  </svg>
);
export const IconStages = (p: P) => (
  <svg {...base(p)}>
    <path d="M12 21s-6.5-5.5-6.5-10A6.5 6.5 0 0 1 12 4.5 6.5 6.5 0 0 1 18.5 11c0 4.5-6.5 10-6.5 10z" />
    <circle cx="12" cy="10.8" r="2.3" />
  </svg>
);
export const IconForm = (p: P) => (
  <svg {...base(p)}>
    <rect x="4.5" y="3.5" width="15" height="17" rx="2" />
    <path d="M8.5 8h7M8.5 12h7M8.5 16h4" />
  </svg>
);
export const IconReport = (p: P) => (
  <svg {...base(p)}>
    <path d="M6 3.5h9l3.5 3.5v13.5H6z" />
    <path d="M9 13v4M12 10v7M15 14.5V17" />
  </svg>
);
export const IconCog = (p: P) => (
  <svg {...base(p)}>
    <circle cx="12" cy="12" r="3" />
    <path d="M12 3.5v2.2M12 18.3v2.2M20.5 12h-2.2M5.7 12H3.5M18 6l-1.6 1.6M7.6 16.4 6 18M18 18l-1.6-1.6M7.6 7.6 6 6" />
  </svg>
);
export const IconShield = (p: P) => (
  <svg {...base(p)}>
    <path d="M12 3.5 19 6v5.5c0 4.6-3 7.7-7 9-4-1.3-7-4.4-7-9V6z" />
    <path d="m9 11.8 2.1 2.1L15.3 9.7" />
  </svg>
);
export const IconIdCard = (p: P) => (
  <svg {...base(p)}>
    <rect x="3.5" y="5.5" width="17" height="13" rx="2" />
    <circle cx="8.5" cy="11" r="1.8" />
    <path d="M6.2 15.5c.4-1.4 1.3-2 2.3-2s1.9.6 2.3 2M14 10h4M14 13h4" />
  </svg>
);
export const IconBell = (p: P) => (
  <svg {...base(p)}>
    <path d="M6 16v-5a6 6 0 1 1 12 0v5l1.5 2.5h-15z" />
    <path d="M10 20.5a2 2 0 0 0 4 0" />
  </svg>
);
export const IconFlow = (p: P) => (
  <svg {...base(p)}>
    <circle cx="6" cy="6" r="2.4" />
    <circle cx="18" cy="12" r="2.4" />
    <circle cx="6" cy="18" r="2.4" />
    <path d="M8 7.2c4 1.5 4 2.1 7.6 3.4M8 16.8c4-1.5 4-2.1 7.6-3.4" />
  </svg>
);
export const IconArrow = (p: P) => (
  <svg {...base(p)}>
    <path d="M5 12h14M13 6l6 6-6 6" />
  </svg>
);
export const IconPlus = (p: P) => (
  <svg {...base(p)}>
    <path d="M12 5v14M5 12h14" />
  </svg>
);
export const IconX = (p: P) => (
  <svg {...base(p)}>
    <path d="M6 6l12 12M18 6 6 18" />
  </svg>
);
export const IconCheck = (p: P) => (
  <svg {...base(p)}>
    <path d="m5 12.5 4.5 4.5L19 7.5" />
  </svg>
);
export const IconLink = (p: P) => (
  <svg {...base(p)}>
    <path d="M9.5 14.5 14.5 9.5M8 12l-2.5 2.5a3.5 3.5 0 0 0 5 5L13 17M16 12l2.5-2.5a3.5 3.5 0 0 0-5-5L11 7" />
  </svg>
);
export const IconTransfer = (p: P) => (
  <svg {...base(p)}>
    <path d="M4 8h13M14 4.5 17.5 8 14 11.5M20 16H7M10 12.5 6.5 16l3.5 3.5" />
  </svg>
);
export const IconLogout = (p: P) => (
  <svg {...base(p)}>
    <path d="M14 4.5H6.5v15H14M10.5 12H21M17.5 8.5 21 12l-3.5 3.5" />
  </svg>
);
export const IconSearch = (p: P) => (
  <svg {...base(p)}>
    <circle cx="10.5" cy="10.5" r="5.5" />
    <path d="m15 15 5 5" />
  </svg>
);
export const IconCard = (p: P) => (
  <svg {...base(p)}>
    <rect x="3.5" y="6" width="17" height="12.5" rx="2" />
    <path d="M3.5 10h17M7 15h4" />
  </svg>
);
export const IconWarn = (p: P) => (
  <svg {...base(p)}>
    <path d="M12 4 2.8 19.5h18.4z" />
    <path d="M12 10v4M12 16.8v.4" />
  </svg>
);
export const IconChevron = (p: P) => (
  <svg {...base(p)}>
    <path d="m9 6 6 6-6 6" />
  </svg>
);
export const IconMenu = (p: P) => (
  <svg {...base(p)}>
    <path d="M4 7h16M4 12h16M4 17h16" />
  </svg>
);
export const IconPrint = (p: P) => (
  <svg {...base(p)}>
    <path d="M7 8V3.5h10V8M7 17H4.5V9.5h15V17H17" />
    <rect x="7" y="14.5" width="10" height="6" rx="1" />
  </svg>
);
export const IconDownload = (p: P) => (
  <svg {...base(p)}>
    <path d="M12 4v11M7.5 11 12 15.5 16.5 11M4.5 19.5h15" />
  </svg>
);
