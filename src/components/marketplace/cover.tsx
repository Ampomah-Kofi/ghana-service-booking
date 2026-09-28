/**
 * A business's cover: its photo when it has one, otherwise an illustrated cover drawn
 * in SVG (zero image bytes, crisp at any size). Palettes and icons are keyed by category
 * slug for the seed categories; any other category (they're data) gets a stable palette
 * from its slug and a generic sparkle, so new categories never look broken.
 */
type Palette = [string, string];

const PALETTES: Record<string, Palette> = {
  barbers: ["#123a31", "#0f6b4f"],
  "hair-salons": ["#6e3526", "#c27b58"],
  "braids-locs": ["#4f2718", "#a5623b"],
  nails: ["#7e2745", "#d66d8e"],
  makeup: ["#5f2748", "#b8628f"],
  beauty: ["#6d3656", "#c98ba8"],
  "spa-massage": ["#27504a", "#6fa596"],
  "medical-wellness": ["#1b4863", "#5b98b8"],
  "tattoo-piercing": ["#1b1b21", "#4a4a58"],
  fitness: ["#7c3410", "#e07a3a"],
  photography: ["#1f344d", "#5877a0"],
  "home-services": ["#4d3f22", "#a58c54"],
  cleaning: ["#16535f", "#4fa3b3"],
  repairs: ["#2b3646", "#64748b"],
  tutoring: ["#34336d", "#6f6dc1"],
  consulting: ["#252d38", "#5b6b7f"],
  "event-services": ["#7a5d0e", "#d9b03e"],
};
const FALLBACKS: Palette[] = Object.values(PALETTES);

// 24×24 stroke icons (drawn here so no icon library ships to the browser).
const ICONS: Record<string, string[]> = {
  scissors: [
    "M8.1 8.1 12 12",
    "M20 4 8.1 15.9",
    "M14.5 14.5 20 20",
    "M9 6a3 3 0 1 1-6 0 3 3 0 0 1 6 0",
    "M9 18a3 3 0 1 1-6 0 3 3 0 0 1 6 0",
  ],
  comb: ["M4 8h16v3H4z", "M6 11v8", "M9 11v8", "M12 11v8", "M15 11v8", "M18 11v8"],
  braid: ["M9 3c3 3-3 6 0 9s-3 6 0 9", "M15 3c-3 3 3 6 0 9s3 6 0 9"],
  polish: ["M10 3h4v4h-4z", "M8 7h8l1 12a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2z"],
  lipstick: ["M9 21h6V11H9z", "M10 11V6l4-3v8"],
  leaf: ["M12 21c-5-2-8-6-8-11 4 0 7 2 8 5 1-3 4-5 8-5 0 5-3 9-8 11z", "M12 15V6"],
  pen: ["M3 21l4-1 11-11-3-3L4 17z", "M14 6l3-3 4 4-3 3"],
  dumbbell: ["M6 8v8", "M18 8v8", "M3 10v4", "M21 10v4", "M6 12h12"],
  camera: ["M3 8h4l2-3h6l2 3h4v11H3z", "M16 13a4 4 0 1 1-8 0 4 4 0 0 1 8 0"],
  house: ["M3 11l9-8 9 8", "M5 10v10h14V10", "M10 20v-6h4v6"],
  sparkle: [
    "M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z",
    "M19 16l.8 2.2L22 19l-2.2.8L19 22l-.8-2.2L16 19l2.2-.8z",
  ],
  wrench: ["M14.7 6.3a4 4 0 0 0-5.4 5.4L3 18l3 3 6.3-6.3a4 4 0 0 0 5.4-5.4l-2.7 2.7-2.7-2.7z"],
  book: ["M4 5a2 2 0 0 1 2-2h13v16H6a2 2 0 0 0-2 2z", "M4 21V5", "M8 7h7"],
  briefcase: ["M3 7h18v13H3z", "M8 7V5h8v2", "M3 12h18"],
  star: ["M12 3l2.6 5.6 6.1.7-4.5 4.2 1.2 6L12 16.6 6.6 19.5l1.2-6L3.3 9.3l6.1-.7z"],
};
const ICON_FOR: Record<string, string> = {
  barbers: "scissors",
  "hair-salons": "comb",
  "braids-locs": "braid",
  nails: "polish",
  makeup: "lipstick",
  beauty: "sparkle",
  "spa-massage": "leaf",
  "medical-wellness": "leaf",
  "tattoo-piercing": "pen",
  fitness: "dumbbell",
  photography: "camera",
  "home-services": "house",
  cleaning: "sparkle",
  repairs: "wrench",
  tutoring: "book",
  consulting: "briefcase",
  "event-services": "star",
};

function hash(text: string): number {
  let h = 0;
  for (let i = 0; i < text.length; i++) h = (h * 31 + text.charCodeAt(i)) >>> 0;
  return h;
}

export function coverPalette(categorySlug: string | null, seed: string): Palette {
  return (categorySlug && PALETTES[categorySlug]) || FALLBACKS[hash(categorySlug ?? seed) % FALLBACKS.length];
}

export function Cover({
  imageUrl,
  categorySlug,
  seed,
  className = "",
  iconScale = 1,
  eager = false,
}: {
  imageUrl?: string | null;
  categorySlug: string | null;
  /** Used for a stable variation when there's no category (usually the business id). */
  seed: string;
  className?: string;
  iconScale?: number;
  eager?: boolean;
}) {
  if (imageUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element -- pre-sized renditions from upload (Phase 2)
      <img
        src={imageUrl}
        alt=""
        loading={eager ? "eager" : "lazy"}
        fetchPriority={eager ? "high" : undefined}
        className={`size-full object-cover ${className}`}
      />
    );
  }
  const [from, to] = coverPalette(categorySlug, seed);
  const icon = ICONS[(categorySlug && ICON_FOR[categorySlug]) || "sparkle"];
  const id = `g${hash(seed + (categorySlug ?? "")).toString(36)}`;
  const variant = hash(seed) % 3;
  const s = 5.2 * iconScale; // icon scale inside the 400×300 artboard
  return (
    <svg
      viewBox="0 0 400 300"
      preserveAspectRatio="xMidYMid slice"
      aria-hidden="true"
      className={`size-full ${className}`}
    >
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor={from} />
          <stop offset="1" stopColor={to} />
        </linearGradient>
      </defs>
      <rect width="400" height="300" fill={`url(#${id})`} />
      {/* Soft shapes give depth without weight */}
      <circle cx={variant === 0 ? 340 : 60} cy={variant === 2 ? 250 : 40} r="140" fill="#fff" opacity="0.07" />
      <circle cx={variant === 1 ? 330 : 90} cy="270" r="90" fill="#fff" opacity="0.06" />
      <circle cx="200" cy="150" r={70 * iconScale} fill="#fff" opacity="0.1" />
      <g
        transform={`translate(${200 - 12 * s} ${150 - 12 * s}) scale(${s})`}
        fill="none"
        stroke="#fff"
        strokeWidth={1.4}
        strokeLinecap="round"
        strokeLinejoin="round"
        opacity="0.92"
      >
        {icon.map((d) => (
          <path key={d} d={d} />
        ))}
      </g>
    </svg>
  );
}
