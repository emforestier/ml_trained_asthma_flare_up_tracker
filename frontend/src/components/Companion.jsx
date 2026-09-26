// The companion: a small cloud creature with a sprout, drawn in SVG so it needs no image files.
// Its mood follows tomorrow's risk: happy (low), uneasy (moderate), worried (high).

const MOOD_COLORS = {
  happy: { body: '#8fdcc0', shade: '#6cc7a6' },
  uneasy: { body: '#f7cf78', shade: '#ebb54f' },
  worried: { body: '#f4a097', shade: '#e87d72' },
};

function Eyes({ mood }) {
  if (mood === 'happy') {
    // Closed, smiling eyes.
    return (
      <g stroke="#1f2a37" strokeWidth="5" strokeLinecap="round" fill="none">
        <path d="M68 104 q10 -12 20 0" />
        <path d="M112 104 q10 -12 20 0" />
      </g>
    );
  }
  return (
    <g>
      <g className="blink">
        <ellipse cx="78" cy="104" rx="7" ry="9" fill="#1f2a37" />
        <circle cx="80" cy="100" r="2.5" fill="#fff" />
      </g>
      <g className="blink">
        <ellipse cx="122" cy="104" rx="7" ry="9" fill="#1f2a37" />
        <circle cx="124" cy="100" r="2.5" fill="#fff" />
      </g>
      <g stroke="#1f2a37" strokeWidth="4" strokeLinecap="round">
        {mood === 'worried' ? (
          <>
            <path d="M66 86 l18 -6" />
            <path d="M134 86 l-18 -6" />
          </>
        ) : (
          <>
            <path d="M68 86 h18" />
            <path d="M114 86 h18" />
          </>
        )}
      </g>
    </g>
  );
}

function Mouth({ mood }) {
  if (mood === 'happy') return <path d="M86 124 q14 16 28 0" stroke="#1f2a37" strokeWidth="5" strokeLinecap="round" fill="none" />;
  if (mood === 'uneasy') return <path d="M88 128 q6 -5 12 0 t12 0" stroke="#1f2a37" strokeWidth="5" strokeLinecap="round" fill="none" />;
  return <ellipse cx="100" cy="130" rx="8" ry="6" fill="#1f2a37" />;
}

export default function Companion({ mood = 'happy', size = 160, label }) {
  const colors = MOOD_COLORS[mood] || MOOD_COLORS.happy;
  return (
    <svg
      className={`companion mood-${mood}`}
      width={size}
      height={size}
      viewBox="0 0 200 200"
      role="img"
      aria-label={label || `Your companion looks ${mood}`}
    >
      <ellipse className="shadow" cx="100" cy="188" rx="52" ry="8" fill="#1f2a37" />
      <g className="bob">
        <g className="sprout">
          <path d="M100 58 q0 -14 0 -20" stroke="#3f9a6e" strokeWidth="5" strokeLinecap="round" fill="none" />
          <path d="M100 42 q-20 -14 -26 2 q16 8 26 -2z" fill="#56b884" />
          <path d="M100 38 q18 -16 26 -2 q-14 10 -26 2z" fill="#6fcb97" />
        </g>
        {/* Cloud-shaped body: overlapping circles with a flat base. */}
        <g className="body" fill={colors.body}>
          <circle cx="100" cy="100" r="46" />
          <circle cx="62" cy="118" r="34" />
          <circle cx="138" cy="118" r="34" />
          <rect x="44" y="118" width="112" height="52" rx="26" />
        </g>
        <path d="M50 150 q50 26 100 0 v4 q0 18 -26 18 h-48 q-26 0 -26 -18z" fill={colors.shade} opacity="0.55" />
        <circle cx="62" cy="126" r="9" fill="#ff8fa3" opacity="0.45" />
        <circle cx="138" cy="126" r="9" fill="#ff8fa3" opacity="0.45" />
        <Eyes mood={mood} />
        <Mouth mood={mood} />
        {mood === 'worried' && <path className="sweat" d="M150 78 q7 11 0 16 q-7 -5 0 -16z" fill="#7cc3f0" />}
      </g>
    </svg>
  );
}
