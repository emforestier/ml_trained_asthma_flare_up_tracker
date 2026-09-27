// The emblem on the big round menu button: teal top, white bottom, a band across the middle and
// a wind swirl in the center badge. Breezy's own take on a location game's menu ball.
export default function MenuEmblem({ size = 68 }) {
  return (
    <svg className="menu-emblem" width={size} height={size} viewBox="0 0 64 64" aria-hidden="true">
      <defs>
        <linearGradient id="emblem-top" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#7fd9b6" />
          <stop offset="100%" stopColor="#3f9a8c" />
        </linearGradient>
        <clipPath id="emblem-circle">
          <circle cx="32" cy="32" r="32" />
        </clipPath>
      </defs>
      <g clipPath="url(#emblem-circle)">
        <rect width="64" height="64" fill="#ffffff" />
        <rect width="64" height="32" fill="url(#emblem-top)" />
        <rect y="29" width="64" height="6" fill="#2f5f63" />
        <ellipse cx="22" cy="13" rx="12" ry="6" fill="#ffffff" opacity="0.35" />
      </g>
      <circle cx="32" cy="32" r="12.5" fill="#ffffff" stroke="#2f5f63" strokeWidth="4.5" />
      <g className="emblem-swirl" fill="none" stroke="#3f9a8c" strokeWidth="2.2" strokeLinecap="round">
        <path d="M25.5 29.5 h8 a2.6 2.6 0 1 0 -2.6 -2.6" />
        <path d="M25.5 33.5 h11.5 a2.6 2.6 0 1 1 -2.6 2.6" />
      </g>
    </svg>
  );
}
